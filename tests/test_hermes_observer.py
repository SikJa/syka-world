from __future__ import annotations

import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "integrations" / "hermes" / "syka-world-observer" / "__init__.py"


class FakeContext:
    profile_name = "elen"

    def __init__(self):
        self.hooks = {}

    def register_hook(self, name, callback):
        self.hooks[name] = callback


class ObserverTests(unittest.TestCase):
    def test_observer_emits_sanitized_events_and_no_behavior(self):
        spec = importlib.util.spec_from_file_location("syka_world_observer_test", PLUGIN)
        module = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(module)

        with tempfile.TemporaryDirectory() as tmp:
            previous = os.environ.get("HERMES_HOME")
            os.environ["HERMES_HOME"] = tmp
            try:
                context = FakeContext()
                self.assertIsNone(module.register(context))
                result = context.hooks["pre_llm_call"](
                    session_id="session-1",
                    user_message="Analiza https://example.com con token=supersecretvalue123",
                    platform="desktop",
                )
                self.assertIsNone(result)
            finally:
                if previous is None:
                    os.environ.pop("HERMES_HOME", None)
                else:
                    os.environ["HERMES_HOME"] = previous

            files = list((Path(tmp) / "syka-world" / "events").glob("*.jsonl"))
            self.assertEqual(len(files), 1)
            payload = json.loads(files[0].read_text(encoding="utf-8"))
            self.assertEqual(payload["profile_id"], "elen")
            self.assertEqual(payload["type"], "activity.started")
            self.assertNotIn("example.com", payload["task_summary"])
            self.assertNotIn("supersecretvalue123", payload["task_summary"])
            self.assertNotIn("conversation_history", payload)

    def test_observer_classifies_waiting_completion_failure_and_interrupt(self):
        spec = importlib.util.spec_from_file_location("syka_world_observer_lifecycle_test", PLUGIN)
        module = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(module)

        with tempfile.TemporaryDirectory() as tmp:
            previous = os.environ.get("HERMES_HOME")
            os.environ["HERMES_HOME"] = tmp
            try:
                context = FakeContext()
                module.register(context)
                context.hooks["pre_approval_request"](
                    session_key="session-1", surface="gateway", command="private command"
                )
                context.hooks["post_approval_response"](
                    session_key="session-1", surface="gateway", choice="once"
                )
                context.hooks["on_session_end"](
                    session_id="session-1", completed=True, platform="desktop"
                )
                context.hooks["on_session_end"](
                    session_id="session-2", completed=False, interrupted=True, platform="desktop"
                )
                context.hooks["on_session_end"](
                    session_id="session-3", completed=False, interrupted=False, platform="desktop"
                )
            finally:
                if previous is None:
                    os.environ.pop("HERMES_HOME", None)
                else:
                    os.environ["HERMES_HOME"] = previous

            path = next((Path(tmp) / "syka-world" / "events").glob("*.jsonl"))
            events = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
            self.assertEqual(
                [item["type"] for item in events],
                [
                    "activity.waiting",
                    "activity.resumed",
                    "activity.completed",
                    "activity.interrupted",
                    "activity.failed",
                ],
            )
            self.assertNotIn("private command", path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
