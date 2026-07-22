from __future__ import annotations

import unittest
from pathlib import Path

from syka_world_bridge.contracts import WorldEvent
from syka_world_bridge.reducer import WorldReducer
from syka_world_bridge.registry import load_registry


ROOT = Path(__file__).resolve().parents[1]


def event(event_id: str, profile: str, event_type: str, **kwargs) -> WorldEvent:
    return WorldEvent(
        event_id=event_id,
        occurred_at="2026-07-15T12:00:00Z",
        profile_id=profile,
        session_id="session-1",
        type=event_type,
        **kwargs,
    )


class ReducerTests(unittest.TestCase):
    def setUp(self):
        self.reducer = WorldReducer(load_registry(ROOT / "config" / "characters.json"))

    def character(self, profile: str) -> dict:
        snapshot = self.reducer.snapshot("now")
        return next(item for item in snapshot["characters"] if item["profile_id"] == profile)

    def test_activity_moves_character_to_its_workplace(self):
        self.reducer.apply(event("1", "elen", "activity.started", task_summary="Preparar campaña"))
        state = self.character("elen")
        self.assertEqual(state["status"], "working")
        self.assertEqual(state["destination"], "marketing-studio")
        self.assertEqual(state["task_summary"], "Preparar campaña")

    def test_tool_family_changes_animation_without_storing_arguments(self):
        self.reducer.apply(event("1", "zerny", "tool.started", tool_family="crm"))
        state = self.character("zerny")
        self.assertEqual(state["animation"], "organizing")
        self.assertEqual(state["tool_family"], "crm")

    def test_completion_exposes_a_visible_done_state_before_settling(self):
        self.reducer.apply(event("1", "astrelis", "activity.started"))
        self.reducer.apply(event("2", "astrelis", "activity.completed"))
        state = self.character("astrelis")
        self.assertEqual(state["status"], "done")
        self.assertEqual(state["animation"], "celebrate")
        self.assertEqual(state["last_outcome"], "completed")

        self.reducer.apply(event("3", "astrelis", "activity.settled"))
        state = self.character("astrelis")
        self.assertEqual(state["status"], "idle")
        self.assertEqual(state["destination"], "town")

    def test_waiting_and_resume_are_first_class_states(self):
        self.reducer.apply(event("1", "elen", "activity.started"))
        self.reducer.apply(
            event("2", "elen", "activity.waiting", metadata={"reason": "approval"})
        )
        self.assertEqual(self.character("elen")["status"], "waiting")
        self.assertEqual(self.character("elen")["waiting_reason"], "approval")

        self.reducer.apply(event("3", "elen", "activity.resumed"))
        self.assertEqual(self.character("elen")["status"], "working")
        self.assertIsNone(self.character("elen")["waiting_reason"])

    def test_failure_and_interruption_keep_the_outcome_visible(self):
        self.reducer.apply(event("1", "default", "activity.failed"))
        self.assertEqual(self.character("default")["status"], "error")
        self.assertEqual(self.character("default")["last_outcome"], "failed")

        self.reducer.apply(event("2", "zerny", "activity.interrupted"))
        self.assertEqual(self.character("zerny")["status"], "interrupted")
        self.assertEqual(self.character("zerny")["last_outcome"], "interrupted")

    def test_older_event_cannot_overwrite_newer_state(self):
        newer = event("new", "elen", "activity.completed")
        object.__setattr__(newer, "occurred_at", "2026-07-15T12:01:00Z")
        older = event("old", "elen", "activity.started")
        self.assertTrue(self.reducer.apply(newer))
        self.assertFalse(self.reducer.apply(older))
        self.assertEqual(self.character("elen")["status"], "done")

    def test_duplicate_event_is_idempotent(self):
        item = event("same", "default", "activity.started")
        self.assertTrue(self.reducer.apply(item))
        self.assertFalse(self.reducer.apply(item))

    def test_unknown_profile_is_never_assigned_to_syka(self):
        self.assertFalse(self.reducer.apply(event("1", "mystery", "activity.started")))
        self.assertEqual(self.character("default")["status"], "idle")
        self.assertEqual(len(self.reducer.unassigned_events), 1)

    def test_concurrent_session_end_does_not_hide_other_active_session(self):
        first = event("a-start", "elen", "activity.started")
        object.__setattr__(first, "session_id", "session-a")
        second = event("b-start", "elen", "activity.started")
        object.__setattr__(second, "session_id", "session-b")
        object.__setattr__(second, "occurred_at", "2026-07-15T12:00:01Z")
        first_done = event("a-done", "elen", "activity.completed")
        object.__setattr__(first_done, "session_id", "session-a")
        object.__setattr__(first_done, "occurred_at", "2026-07-15T12:00:02Z")

        self.reducer.apply(first)
        self.reducer.apply(second)
        self.reducer.apply(first_done)
        state = self.character("elen")
        self.assertEqual(state["status"], "working")
        self.assertEqual(state["active_session_count"], 1)
        self.assertEqual(state["dominant_session_id"], "session-b")
        self.assertEqual(state["last_outcome"], "completed")

    def test_dominant_session_is_deterministic_and_waiting_has_priority(self):
        a = event("a", "default", "activity.started")
        object.__setattr__(a, "session_id", "session-a")
        b = event("b", "default", "activity.waiting", metadata={"reason": "approval"})
        object.__setattr__(b, "session_id", "session-b")
        self.reducer.apply(a)
        self.reducer.apply(b)
        state = self.character("default")
        self.assertEqual(state["dominant_session_id"], "session-b")
        self.assertEqual(state["status"], "waiting")
        self.assertEqual(state["active_session_count"], 2)

    def test_official_plugin_takes_precedence_over_session_fallback(self):
        official = event("official", "zerny", "activity.started")
        fallback = event(
            "fallback",
            "zerny",
            "activity.completed",
            source="hermes-session-sqlite",
        )
        object.__setattr__(fallback, "occurred_at", "2026-07-15T12:00:01Z")
        self.assertTrue(self.reducer.apply(official))
        self.assertFalse(self.reducer.apply(fallback))
        state = self.character("zerny")
        self.assertEqual(state["status"], "working")
        self.assertEqual(state["active_source"], "hermes-plugin")


if __name__ == "__main__":
    unittest.main()
