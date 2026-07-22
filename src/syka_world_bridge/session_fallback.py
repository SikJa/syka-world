from __future__ import annotations

import hashlib
import sqlite3
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Iterable

from .contracts import WorldEvent


FALLBACK_SOURCE = "hermes-session-sqlite"


@dataclass(frozen=True)
class SessionDatabase:
    profile_id: str
    path: Path


@dataclass
class FallbackDiagnostics:
    profile_id: str
    path: str
    available: bool = False
    cursor: int = 0
    last_scan_at: str | None = None
    last_error: str | None = None
    emitted_events: int = 0

    def to_dict(self) -> dict:
        return {
            "profile_id": self.profile_id,
            "path": self.path,
            "available": self.available,
            "cursor": self.cursor,
            "last_scan_at": self.last_scan_at,
            "last_error": self.last_error,
            "emitted_events": self.emitted_events,
        }


class SQLiteSessionFallback:
    """Read privacy-safe lifecycle metadata from confirmed Hermes state.db files.

    The reader never selects message content, reasoning, tool arguments, model
    prompts, or assistant responses. It is intended for recovery/degraded mode;
    the official Hermes observer remains authoritative in the reducer.
    """

    def __init__(
        self,
        databases: Iterable[SessionDatabase],
        allowed_sources: tuple[str, ...] = ("desktop",),
        bootstrap_window_seconds: float = 600.0,
        now: Callable[[], datetime] | None = None,
    ):
        self.databases = tuple(databases)
        self.allowed_sources = tuple(allowed_sources)
        self.bootstrap_window_seconds = bootstrap_window_seconds
        self._now = now or (lambda: datetime.now(timezone.utc))
        self._cursors: dict[str, int] = {}
        self._diagnostics = {
            item.profile_id: FallbackDiagnostics(item.profile_id, str(item.path))
            for item in self.databases
        }

    def scan_once(self) -> list[WorldEvent]:
        events: list[WorldEvent] = []
        for database in self.databases:
            diagnostic = self._diagnostics[database.profile_id]
            diagnostic.last_scan_at = _iso(self._now())
            if not database.path.is_file():
                diagnostic.available = False
                diagnostic.last_error = "state_db_missing"
                continue
            try:
                connection = sqlite3.connect(
                    f"file:{database.path.as_posix()}?mode=ro", uri=True, timeout=0.5
                )
                try:
                    connection.row_factory = sqlite3.Row
                    self._validate_schema(connection)
                    rows = self._read_rows(connection, database.profile_id)
                finally:
                    connection.close()
                diagnostic.available = True
                diagnostic.last_error = None
                converted = self._convert_rows(database.profile_id, rows)
                events.extend(converted)
                diagnostic.emitted_events += len(converted)
            except (OSError, sqlite3.Error, ValueError) as exc:
                diagnostic.available = False
                diagnostic.last_error = f"{type(exc).__name__}: {exc}"
        return events

    def _validate_schema(self, connection: sqlite3.Connection) -> None:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sessions','messages')"
            )
        }
        if tables != {"sessions", "messages"}:
            raise ValueError("unsupported Hermes session schema")

    def _read_rows(self, connection: sqlite3.Connection, profile_id: str) -> list[sqlite3.Row]:
        cursor_exists = profile_id in self._cursors
        cursor = self._cursors.get(profile_id, 0)
        if not cursor_exists:
            maximum = int(connection.execute("SELECT COALESCE(MAX(id), 0) FROM messages").fetchone()[0])
            # Bootstrap only a short recent tail so an in-flight Desktop turn
            # can be recovered without replaying private work history.
            cutoff = self._now().timestamp() - self.bootstrap_window_seconds
            query_cursor = max(0, maximum - 250)
        else:
            cutoff = 0.0
            query_cursor = cursor

        placeholders = ",".join("?" for _ in self.allowed_sources)
        sql = f"""
            SELECT m.id, m.session_id, m.role, m.tool_name, m.timestamp,
                   m.finish_reason, (m.tool_calls IS NOT NULL) AS has_tool_calls,
                   s.source AS session_source
              FROM messages AS m
              JOIN sessions AS s ON s.id = m.session_id
             WHERE m.id > ?
               AND m.timestamp >= ?
               AND s.source IN ({placeholders})
             ORDER BY m.id ASC
        """
        rows = list(connection.execute(sql, (query_cursor, cutoff, *self.allowed_sources)))
        maximum_seen = int(connection.execute("SELECT COALESCE(MAX(id), 0) FROM messages").fetchone()[0])
        self._cursors[profile_id] = max(cursor, maximum_seen)
        self._diagnostics[profile_id].cursor = self._cursors[profile_id]
        return rows

    def _convert_rows(self, profile_id: str, rows: list[sqlite3.Row]) -> list[WorldEvent]:
        result: list[WorldEvent] = []
        for row in rows:
            occurred = datetime.fromtimestamp(float(row["timestamp"]), timezone.utc)
            common = {
                "profile_id": profile_id,
                "session_id": str(row["session_id"]),
                "source": FALLBACK_SOURCE,
                "occurred_at": _iso(occurred),
                "metadata": {"session_source": str(row["session_source"]), "recovery": True},
            }
            role = str(row["role"] or "")
            finish_reason = str(row["finish_reason"] or "")
            if role == "user":
                result.append(
                    WorldEvent(
                        event_id=_event_id(profile_id, int(row["id"]), "started"),
                        type="activity.started",
                        activity="thinking",
                        **common,
                    )
                )
            elif role == "tool":
                family = _tool_family(row["tool_name"])
                result.append(
                    WorldEvent(
                        event_id=_event_id(profile_id, int(row["id"]), "tool-started"),
                        type="tool.started",
                        tool_family=family,
                        **common,
                    )
                )
                result.append(
                    WorldEvent(
                        event_id=_event_id(profile_id, int(row["id"]), "tool-finished"),
                        type="tool.finished",
                        tool_family=family,
                        **{**common, "occurred_at": _iso(occurred + timedelta(microseconds=1))},
                    )
                )
            elif role == "assistant" and not int(row["has_tool_calls"]):
                event_type = "activity.failed" if finish_reason in {"error", "failed"} else "activity.completed"
                result.append(
                    WorldEvent(
                        event_id=_event_id(profile_id, int(row["id"]), "terminal"),
                        type=event_type,
                        **common,
                    )
                )
        return result

    def export_checkpoint(self) -> dict:
        return {"cursors": dict(self._cursors)}

    def restore_checkpoint(self, payload: dict) -> None:
        self._cursors = {
            str(profile): max(0, int(cursor))
            for profile, cursor in payload.get("cursors", {}).items()
        }
        for profile, cursor in self._cursors.items():
            if profile in self._diagnostics:
                self._diagnostics[profile].cursor = cursor

    def diagnostics(self) -> list[dict]:
        return [item.to_dict() for _, item in sorted(self._diagnostics.items())]


def discover_session_databases(hermes_root: Path, profiles: Iterable[str]) -> list[SessionDatabase]:
    result = []
    for profile in profiles:
        path = (
            hermes_root / "state.db"
            if profile == "default"
            else hermes_root / "profiles" / profile / "state.db"
        )
        result.append(SessionDatabase(profile, path))
    return result


def _event_id(profile_id: str, message_id: int, phase: str) -> str:
    raw = f"{profile_id}:{message_id}:{phase}".encode("utf-8")
    return "fallback-" + hashlib.sha256(raw).hexdigest()[:24]


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _tool_family(tool_name: str | None) -> str:
    name = (tool_name or "").lower()
    groups = (
        ("browser", ("browser", "playwright", "chrome", "web")),
        ("terminal", ("terminal", "shell", "command", "exec")),
        ("files", ("file", "read", "write", "patch", "edit", "search_files")),
        ("research", ("search", "research", "fetch", "extract")),
        ("communication", ("mail", "telegram", "slack", "message", "calendar")),
        ("crm", ("crm", "kanban", "contact", "lead")),
        ("code", ("code", "git", "test", "lint")),
    )
    for family, terms in groups:
        if any(term in name for term in terms):
            return family
    return "other"
