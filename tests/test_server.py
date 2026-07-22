from __future__ import annotations

import json
import tempfile
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

from syka_world_bridge.reducer import WorldReducer
from syka_world_bridge.contracts import WorldEvent
from syka_world_bridge.registry import load_registry
from syka_world_bridge.runtime import WorldRuntime
from syka_world_bridge.server import make_handler


ROOT = Path(__file__).resolve().parents[1]


class ServerTests(unittest.TestCase):
    def test_health_and_state_endpoints(self):
        with tempfile.TemporaryDirectory() as tmp:
            runtime = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")), Path(tmp)
            )
            server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(runtime))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                base = f"http://127.0.0.1:{server.server_port}"
                with urllib.request.urlopen(base + "/health") as response:
                    health = json.load(response)
                with urllib.request.urlopen(base + "/api/world/state") as response:
                    state = json.load(response)
                with urllib.request.urlopen(base + "/api/world/diagnostics") as response:
                    diagnostics = json.load(response)
                self.assertTrue(health["ok"])
                self.assertEqual(state["schema"], "syka.world.state.v1")
                self.assertEqual(len(state["characters"]), 4)
                self.assertEqual(diagnostics["schema"], "syka.world.bridge-diagnostics.v1")
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)

    def test_event_client_can_disconnect_and_resume_after_last_event_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            runtime = WorldRuntime(
                WorldReducer(load_registry(ROOT / "config" / "characters.json")), Path(tmp)
            )
            server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(runtime))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                base = f"http://127.0.0.1:{server.server_port}"
                first = WorldEvent(
                    event_id="before-disconnect",
                    occurred_at="2026-07-15T12:00:00Z",
                    profile_id="elen",
                    session_id="session-1",
                    type="activity.started",
                )
                runtime.ingest(first)
                with urllib.request.urlopen(base + "/api/world/events") as response:
                    initial = json.load(response)
                self.assertEqual(initial["events"][-1]["event_id"], "before-disconnect")

                second = WorldEvent(
                    event_id="while-disconnected",
                    occurred_at="2026-07-15T12:00:01Z",
                    profile_id="elen",
                    session_id="session-1",
                    type="tool.started",
                    tool_family="browser",
                )
                runtime.ingest(second)
                with urllib.request.urlopen(
                    base + "/api/world/events?after=before-disconnect"
                ) as response:
                    resumed = json.load(response)
                self.assertEqual(
                    [item["event_id"] for item in resumed["events"]], ["while-disconnected"]
                )
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
