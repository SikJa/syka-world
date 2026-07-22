from __future__ import annotations

import json
import os
import re
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from .contracts import CHECKPOINT_SCHEMA, WorldEvent, utc_now
from .reducer import WorldReducer
from .session_fallback import SQLiteSessionFallback


DEFAULT_TERMINAL_STATE_SECONDS = 6.0


class WorldRuntime:
    def __init__(
        self,
        reducer: WorldReducer,
        spool_dir: Path,
        terminal_state_seconds: float = DEFAULT_TERMINAL_STATE_SECONDS,
        process_alive: Callable[[int], bool] | None = None,
        checkpoint_path: Path | None = None,
        session_fallback: SQLiteSessionFallback | None = None,
    ):
        self.reducer = reducer
        self.spool_dir = spool_dir
        self.events: list[dict] = []
        self.errors: list[str] = []
        self._offsets: dict[Path, int] = {}
        self._last_source: dict[tuple[str, str], Path] = {}
        self._terminal_state_seconds = terminal_state_seconds
        self._process_alive = process_alive or _is_process_alive
        self.checkpoint_path = checkpoint_path
        self.session_fallback = session_fallback
        self.checkpoint_status = "disabled" if checkpoint_path is None else "new"
        self.checkpoint_updated_at: str | None = None
        self._lock = threading.RLock()
        self._condition = threading.Condition(self._lock)
        self._stop = threading.Event()
        self._load_checkpoint()

    def ingest(self, event: WorldEvent, source_path: Path | None = None) -> bool:
        with self._condition:
            changed = self.reducer.apply(event)
            if changed:
                if source_path is not None:
                    self._last_source[(event.profile_id, event.session_id)] = source_path
                self.events.append(event.to_dict())
                self.events = self.events[-2000:]
                self._condition.notify_all()
            return changed

    def scan_once(self) -> int:
        self.spool_dir.mkdir(parents=True, exist_ok=True)
        count = 0
        pending: list[tuple[WorldEvent, Path]] = []
        for path in sorted(self.spool_dir.glob("*.jsonl")):
            offset = self._offsets.get(path, 0)
            try:
                size = path.stat().st_size
                if size < offset:
                    offset = 0
                with path.open("r", encoding="utf-8") as handle:
                    handle.seek(offset)
                    while True:
                        line_start = handle.tell()
                        raw = handle.readline()
                        if not raw:
                            break
                        # A writer can be between write() and flush(). Keep an
                        # incomplete final line for the next scan.
                        if not raw.endswith("\n"):
                            handle.seek(line_start)
                            break
                        raw = raw.strip()
                        if not raw:
                            continue
                        try:
                            event = WorldEvent.from_dict(json.loads(raw))
                            pending.append((event, path))
                        except (ValueError, json.JSONDecodeError) as exc:
                            self.errors.append(f"{path.name}: {exc}")
                            self.errors = self.errors[-100:]
                    self._offsets[path] = handle.tell()
            except OSError as exc:
                self.errors.append(f"{path.name}: {exc}")
                self.errors = self.errors[-100:]

        pending.sort(key=lambda item: (_event_time(item[0]), item[0].event_id))
        for event, source_path in pending:
            if self.ingest(event, source_path):
                count += 1

        if self.session_fallback is not None:
            for event in self.session_fallback.scan_once():
                if self.ingest(event):
                    count += 1

        count += self.reconcile()
        self._save_checkpoint()
        return count

    def reconcile(self) -> int:
        """Recover dead workers and expire short terminal animations."""
        count = 0
        snapshot = self.reducer.snapshot(utc_now())
        now = datetime.now(timezone.utc)

        for session in self.reducer.session_snapshot():
            if not session["active"] or session["source"] == "hermes-session-sqlite":
                continue
            source = self._last_source.get((session["profile_id"], session["session_id"]))
            if source is None:
                continue
            pid = _pid_from_spool(source)
            if pid is not None and not self._process_alive(pid):
                character = {
                    "profile_id": session["profile_id"],
                    "session_id": session["session_id"],
                }
                if self.ingest(
                    _synthetic_event(character, "activity.interrupted", "observer_process_ended")
                ):
                    count += 1

        for character in snapshot["characters"]:
            status = character["status"]
            if status in {"done", "interrupted", "error"} and character.get("updated_at"):
                age = (now - _event_time_value(character["updated_at"])).total_seconds()
                if age >= self._terminal_state_seconds:
                    if self.ingest(_synthetic_event(character, "activity.settled", "visual_timeout")):
                        count += 1
        return count

    def run_poller(self, interval: float = 0.25) -> None:
        while not self._stop.is_set():
            try:
                self.scan_once()
            except Exception as exc:
                # A recovery diagnostic must never stop live ingestion.
                with self._lock:
                    self.errors.append(f"poller: {type(exc).__name__}: {exc}")
                    self.errors = self.errors[-100:]
            self._stop.wait(interval)

    def start(self) -> threading.Thread:
        thread = threading.Thread(target=self.run_poller, name="syka-world-spool", daemon=True)
        thread.start()
        return thread

    def stop(self) -> None:
        self._stop.set()
        with self._condition:
            self._condition.notify_all()

    def snapshot(self) -> dict:
        with self._lock:
            return self.reducer.snapshot(utc_now())

    def diagnostics(self) -> dict:
        with self._lock:
            return {
                "schema": "syka.world.bridge-diagnostics.v1",
                "generated_at": utc_now(),
                "checkpoint": {
                    "status": self.checkpoint_status,
                    "path": str(self.checkpoint_path) if self.checkpoint_path else None,
                    "updated_at": self.checkpoint_updated_at,
                },
                "spool": {
                    "path": str(self.spool_dir),
                    "files": len(list(self.spool_dir.glob("*.jsonl")))
                    if self.spool_dir.exists()
                    else 0,
                    "tracked_offsets": len(self._offsets),
                },
                "fallback": self.session_fallback.diagnostics()
                if self.session_fallback is not None
                else [],
                "sessions": self.reducer.session_snapshot(),
                "errors": list(self.errors[-20:]),
            }

    def events_after(self, event_id: str | None) -> list[dict]:
        with self._lock:
            if not event_id:
                return list(self.events)
            for index, event in enumerate(self.events):
                if event["event_id"] == event_id:
                    return list(self.events[index + 1 :])
            return list(self.events)

    def wait_for_events(self, event_id: str | None, timeout: float = 15.0) -> list[dict]:
        deadline = time.monotonic() + timeout
        with self._condition:
            while True:
                events = self.events_after(event_id)
                if events or self._stop.is_set():
                    return events
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return []
                self._condition.wait(remaining)

    def _load_checkpoint(self) -> None:
        if self.checkpoint_path is None or not self.checkpoint_path.exists():
            return
        try:
            payload = json.loads(self.checkpoint_path.read_text(encoding="utf-8"))
            if payload.get("schema") != CHECKPOINT_SCHEMA:
                raise ValueError("unsupported checkpoint schema")
            self._offsets = {
                Path(path): max(0, int(offset))
                for path, offset in payload.get("spool_offsets", {}).items()
            }
            self._last_source = {
                tuple(key.split("|", 1)): Path(path)
                for key, path in payload.get("last_sources", {}).items()
                if "|" in key
            }
            self.reducer.restore_checkpoint(payload.get("reducer", {}))
            if self.session_fallback is not None:
                self.session_fallback.restore_checkpoint(payload.get("fallback", {}))
            self.checkpoint_status = "loaded"
            self.checkpoint_updated_at = payload.get("saved_at")
        except (OSError, ValueError, json.JSONDecodeError, TypeError) as exc:
            self.errors.append(f"checkpoint: {type(exc).__name__}: {exc}")
            self.checkpoint_status = "corrupt_replay"
            self._offsets = {}

    def _save_checkpoint(self) -> None:
        if self.checkpoint_path is None:
            return
        saved_at = utc_now()
        payload = {
            "schema": CHECKPOINT_SCHEMA,
            "saved_at": saved_at,
            "spool_offsets": {str(path): offset for path, offset in self._offsets.items()},
            "last_sources": {
                f"{profile}|{session}": str(path)
                for (profile, session), path in self._last_source.items()
            },
            "reducer": self.reducer.export_checkpoint(),
            "fallback": self.session_fallback.export_checkpoint()
            if self.session_fallback is not None
            else {},
        }
        try:
            self.checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.checkpoint_path.with_suffix(self.checkpoint_path.suffix + ".tmp")
            temporary.write_text(
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            os.replace(temporary, self.checkpoint_path)
            self.checkpoint_status = "saved"
            self.checkpoint_updated_at = saved_at
        except OSError as exc:
            self.errors.append(f"checkpoint-write: {type(exc).__name__}: {exc}")
            self.errors = self.errors[-100:]
            self.checkpoint_status = "write_error"


_PID_SUFFIX = re.compile(r"-(\d+)\.jsonl$")


def _pid_from_spool(path: Path) -> int | None:
    match = _PID_SUFFIX.search(path.name)
    return int(match.group(1)) if match else None


def _is_process_alive(pid: int) -> bool:
    if os.name == "nt":
        # os.kill(pid, 0) is unreliable on Windows and can raise SystemError
        # while an OSError is still set. Querying a process handle is stable
        # and requires no third-party dependency.
        import ctypes

        process_query_limited_information = 0x1000
        handle = ctypes.windll.kernel32.OpenProcess(
            process_query_limited_information, False, pid
        )
        if not handle:
            return False
        ctypes.windll.kernel32.CloseHandle(handle)
        return True
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _event_time(event: WorldEvent) -> datetime:
    return _event_time_value(event.occurred_at)


def _event_time_value(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _synthetic_event(character: dict, event_type: str, reason: str) -> WorldEvent:
    return WorldEvent(
        event_id=f"bridge-{uuid.uuid4()}",
        occurred_at=utc_now(),
        profile_id=character["profile_id"],
        session_id=character.get("session_id") or "unknown",
        type=event_type,
        source="bridge-recovery",
        metadata={"reason": reason},
    )
