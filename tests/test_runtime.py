from __future__ import annotations

import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from syka_world_bridge.reducer import WorldReducer
from syka_world_bridge.registry import load_registry
from syka_world_bridge.runtime import WorldRuntime


ROOT = Path(__file__).resolve().parents[1]


class RuntimeTests(unittest.TestCase):
    def test_spool_is_incremental_and_replay_safe(self):
        with tempfile.TemporaryDirectory() as tmp:
            spool = Path(tmp)
            event = {
                "schema": "syka.world.event.v1",
                "event_id": "evt-1",
                "occurred_at": "2026-07-15T12:00:00Z",
                "profile_id": "elen",
                "session_id": "session-1",
                "type": "activity.started",
                "task_summary": "Preparar campaña",
            }
            (spool / "elen-1.jsonl").write_text(json.dumps(event) + "\n", encoding="utf-8")
            runtime = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")),
                spool,
                terminal_state_seconds=10**12,
                process_alive=lambda pid: True,
            )
            self.assertEqual(runtime.scan_once(), 1)
            self.assertEqual(runtime.scan_once(), 0)
            self.assertEqual(len(runtime.events), 1)

    def test_incomplete_last_line_is_retried_instead_of_lost(self):
        with tempfile.TemporaryDirectory() as tmp:
            spool = Path(tmp)
            path = spool / "elen-10.jsonl"
            payload = {
                "schema": "syka.world.event.v1",
                "event_id": "evt-partial",
                "occurred_at": "2026-07-15T12:00:00Z",
                "profile_id": "elen",
                "session_id": "session-1",
                "type": "activity.started",
            }
            path.write_text(json.dumps(payload), encoding="utf-8")
            runtime = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")),
                spool,
                process_alive=lambda pid: True,
            )
            self.assertEqual(runtime.scan_once(), 0)
            with path.open("a", encoding="utf-8") as handle:
                handle.write("\n")
            self.assertEqual(runtime.scan_once(), 1)

    def test_replay_orders_events_across_process_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            spool = Path(tmp)
            started = {
                "schema": "syka.world.event.v1",
                "event_id": "evt-start",
                "occurred_at": "2026-07-15T12:00:00Z",
                "profile_id": "elen",
                "session_id": "session-1",
                "type": "activity.started",
            }
            completed = {
                **started,
                "event_id": "evt-complete",
                "occurred_at": "2026-07-15T12:01:00Z",
                "type": "activity.completed",
            }
            (spool / "z-later-2.jsonl").write_text(json.dumps(started) + "\n", encoding="utf-8")
            (spool / "a-earlier-3.jsonl").write_text(json.dumps(completed) + "\n", encoding="utf-8")
            runtime = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")),
                spool,
                terminal_state_seconds=10**12,
                process_alive=lambda pid: True,
            )
            self.assertEqual(runtime.scan_once(), 2)
            state = next(c for c in runtime.snapshot()["characters"] if c["profile_id"] == "elen")
            self.assertEqual(state["status"], "done")

    def test_dead_observer_recovers_a_character_left_working(self):
        with tempfile.TemporaryDirectory() as tmp:
            spool = Path(tmp)
            payload = {
                "schema": "syka.world.event.v1",
                "event_id": "evt-orphan",
                "occurred_at": "2026-07-15T12:00:00Z",
                "profile_id": "zerny",
                "session_id": "session-1",
                "type": "activity.started",
            }
            (spool / "zerny-999999.jsonl").write_text(json.dumps(payload) + "\n", encoding="utf-8")
            runtime = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")),
                spool,
                process_alive=lambda pid: False,
            )
            self.assertEqual(runtime.scan_once(), 2)
            state = next(c for c in runtime.snapshot()["characters"] if c["profile_id"] == "zerny")
            self.assertEqual(state["status"], "interrupted")
            self.assertEqual(state["last_outcome"], "interrupted")

    def test_terminal_state_settles_back_to_ambient_life(self):
        with tempfile.TemporaryDirectory() as tmp:
            spool = Path(tmp)
            payload = {
                "schema": "syka.world.event.v1",
                "event_id": "evt-done",
                "occurred_at": "2026-07-15T12:00:00Z",
                "profile_id": "default",
                "session_id": "session-1",
                "type": "activity.completed",
            }
            (spool / "default-10.jsonl").write_text(json.dumps(payload) + "\n", encoding="utf-8")
            runtime = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")),
                spool,
                terminal_state_seconds=0,
                process_alive=lambda pid: True,
            )
            self.assertEqual(runtime.scan_once(), 2)
            state = next(c for c in runtime.snapshot()["characters"] if c["profile_id"] == "default")
            self.assertEqual(state["status"], "idle")
            self.assertEqual(state["last_outcome"], "completed")

    def test_poller_survives_a_reconciliation_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            runtime = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")), Path(tmp)
            )
            calls = 0

            def scan():
                nonlocal calls
                calls += 1
                if calls == 1:
                    raise RuntimeError("temporary recovery failure")
                runtime.stop()
                return 0

            with patch.object(runtime, "scan_once", side_effect=scan):
                runtime.run_poller(interval=0)

            self.assertEqual(calls, 2)
            self.assertIn("temporary recovery failure", runtime.errors[0])

    def test_checkpoint_restores_state_and_offsets_without_replay(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spool = root / "events"
            spool.mkdir()
            checkpoint = root / "checkpoint.json"
            payload = {
                "schema": "syka.world.event.v1",
                "event_id": "evt-checkpoint",
                "occurred_at": "2026-07-15T12:00:00Z",
                "profile_id": "elen",
                "session_id": "session-1",
                "type": "activity.started",
            }
            (spool / "elen-1.jsonl").write_text(json.dumps(payload) + "\n", encoding="utf-8")
            first = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")),
                spool,
                checkpoint_path=checkpoint,
                process_alive=lambda pid: True,
            )
            self.assertEqual(first.scan_once(), 1)
            second = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")),
                spool,
                checkpoint_path=checkpoint,
                process_alive=lambda pid: True,
            )
            self.assertEqual(second.checkpoint_status, "loaded")
            self.assertEqual(second.scan_once(), 0)
            state = next(c for c in second.snapshot()["characters"] if c["profile_id"] == "elen")
            self.assertEqual(state["status"], "working")

    def test_corrupt_checkpoint_falls_back_to_safe_replay(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spool = root / "events"
            spool.mkdir()
            checkpoint = root / "checkpoint.json"
            checkpoint.write_text("{broken", encoding="utf-8")
            payload = {
                "schema": "syka.world.event.v1",
                "event_id": "evt-replay",
                "occurred_at": "2026-07-15T12:00:00Z",
                "profile_id": "default",
                "session_id": "session-1",
                "type": "activity.started",
            }
            (spool / "default-1.jsonl").write_text(json.dumps(payload) + "\n", encoding="utf-8")
            runtime = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")),
                spool,
                checkpoint_path=checkpoint,
                process_alive=lambda pid: True,
            )
            self.assertEqual(runtime.checkpoint_status, "corrupt_replay")
            self.assertEqual(runtime.scan_once(), 1)
            self.assertTrue(any("checkpoint" in item for item in runtime.errors))

    def test_truncated_spool_replays_without_duplicate_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            spool = Path(tmp)
            path = spool / "elen-10.jsonl"
            payload = {
                "schema": "syka.world.event.v1",
                "event_id": "evt-stable",
                "occurred_at": "2026-07-15T12:00:00Z",
                "profile_id": "elen",
                "session_id": "session-1",
                "type": "activity.started",
            }
            path.write_text(json.dumps(payload) + "\n", encoding="utf-8")
            runtime = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")),
                spool,
                process_alive=lambda pid: True,
            )
            self.assertEqual(runtime.scan_once(), 1)
            path.write_text(json.dumps(payload) + "\n", encoding="utf-8")
            self.assertEqual(runtime.scan_once(), 0)
            self.assertEqual(len(runtime.events), 1)

    def test_corrupt_jsonl_line_is_isolated_and_next_event_survives(self):
        with tempfile.TemporaryDirectory() as tmp:
            spool = Path(tmp)
            valid = {
                "schema": "syka.world.event.v1",
                "event_id": "evt-after-corruption",
                "occurred_at": "2026-07-15T12:00:00Z",
                "profile_id": "elen",
                "session_id": "session-1",
                "type": "activity.started",
            }
            (spool / "elen-1.jsonl").write_text(
                "this is not json\n" + json.dumps(valid) + "\n", encoding="utf-8"
            )
            runtime = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")),
                spool,
                process_alive=lambda pid: True,
            )
            self.assertEqual(runtime.scan_once(), 1)
            self.assertTrue(any("Expecting value" in item for item in runtime.errors))
            state = next(c for c in runtime.snapshot()["characters"] if c["profile_id"] == "elen")
            self.assertEqual(state["status"], "working")

    def test_plugin_absent_uses_available_fallback(self):
        class ControlledFallback:
            def __init__(self):
                self.sent = False

            def scan_once(self):
                if self.sent:
                    return []
                self.sent = True
                from syka_world_bridge.contracts import WorldEvent

                return [
                    WorldEvent(
                        event_id="fallback-only",
                        occurred_at="2026-07-15T12:00:00Z",
                        profile_id="astrelis",
                        session_id="desktop-1",
                        type="activity.started",
                        source="hermes-session-sqlite",
                    )
                ]

            def diagnostics(self):
                return [{"profile_id": "astrelis", "available": True}]

            def export_checkpoint(self):
                return {}

            def restore_checkpoint(self, payload):
                return None

        with tempfile.TemporaryDirectory() as tmp:
            runtime = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")),
                Path(tmp),
                session_fallback=ControlledFallback(),
            )
            self.assertEqual(runtime.scan_once(), 1)
            state = next(
                item for item in runtime.snapshot()["characters"] if item["profile_id"] == "astrelis"
            )
            self.assertEqual(state["status"], "working")
            self.assertEqual(state["presence"], "degraded")
            self.assertEqual(state["active_source"], "hermes-session-sqlite")


if __name__ == "__main__":
    unittest.main()
