from __future__ import annotations

import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from syka_world_bridge.session_fallback import SessionDatabase, SQLiteSessionFallback


def make_database(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.executescript(
        """
        CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            started_at REAL NOT NULL,
            ended_at REAL,
            end_reason TEXT
        );
        CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT,
            tool_name TEXT,
            timestamp REAL NOT NULL,
            finish_reason TEXT,
            tool_calls TEXT
        );
        """
    )
    return connection


class SessionFallbackTests(unittest.TestCase):
    def test_reads_only_lifecycle_metadata_and_maps_desktop_turn(self):
        now = datetime(2026, 7, 16, 2, 0, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "state.db"
            connection = make_database(path)
            connection.execute(
                "INSERT INTO sessions(id, source, started_at) VALUES(?,?,?)",
                ("desk-1", "desktop", now.timestamp()),
            )
            rows = [
                ("desk-1", "user", "SECRET PROMPT", None, now.timestamp(), None, None),
                ("desk-1", "assistant", "PRIVATE ANSWER", None, now.timestamp() + 1, "tool_calls", "PRIVATE ARGS"),
                ("desk-1", "tool", "PRIVATE RESULT", "search_files", now.timestamp() + 2, None, None),
                ("desk-1", "assistant", "FINAL PRIVATE", None, now.timestamp() + 3, "stop", None),
            ]
            connection.executemany(
                "INSERT INTO messages(session_id,role,content,tool_name,timestamp,finish_reason,tool_calls) VALUES(?,?,?,?,?,?,?)",
                rows,
            )
            connection.commit()
            connection.close()

            fallback = SQLiteSessionFallback(
                [SessionDatabase("default", path)], now=lambda: now
            )
            events = fallback.scan_once()
            self.assertEqual(
                [item.type for item in events],
                ["activity.started", "tool.started", "tool.finished", "activity.completed"],
            )
            serialized = " ".join(str(item.to_dict()) for item in events)
            self.assertNotIn("SECRET", serialized)
            self.assertNotIn("PRIVATE", serialized)
            self.assertEqual(events[1].tool_family, "files")
            self.assertEqual(events[0].source, "hermes-session-sqlite")

    def test_ignores_non_desktop_sources_and_is_incremental(self):
        now = datetime(2026, 7, 16, 2, 0, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "state.db"
            connection = make_database(path)
            connection.execute(
                "INSERT INTO sessions(id,source,started_at) VALUES('telegram-1','telegram',?)",
                (now.timestamp(),),
            )
            connection.execute(
                "INSERT INTO messages(session_id,role,timestamp) VALUES('telegram-1','user',?)",
                (now.timestamp(),),
            )
            connection.commit()
            connection.close()
            fallback = SQLiteSessionFallback(
                [SessionDatabase("elen", path)], now=lambda: now
            )
            self.assertEqual(fallback.scan_once(), [])
            self.assertEqual(fallback.scan_once(), [])

    def test_missing_or_wrong_schema_becomes_degraded_diagnostic(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "missing.db"
            fallback = SQLiteSessionFallback([SessionDatabase("zerny", missing)])
            self.assertEqual(fallback.scan_once(), [])
            diagnostic = fallback.diagnostics()[0]
            self.assertFalse(diagnostic["available"])
            self.assertEqual(diagnostic["last_error"], "state_db_missing")
