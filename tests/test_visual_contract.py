from __future__ import annotations

import json
import unittest
from pathlib import Path

from syka_world_bridge.runtime import DEFAULT_TERMINAL_STATE_SECONDS


ROOT = Path(__file__).resolve().parents[1]


class VisualContractTests(unittest.TestCase):
    def test_visual_contract_covers_every_canonical_state_and_tool_family(self):
        payload = json.loads((ROOT / "config" / "visual-states.json").read_text(encoding="utf-8"))
        self.assertEqual(payload["schema"], "syka.world.visual-states.v1")
        self.assertEqual(
            set(payload["states"]),
            {"idle", "thinking", "using-tool", "waiting", "done", "interrupted", "error", "offline"},
        )
        self.assertEqual(
            set(payload["tool_animations"]),
            {"browser", "code", "communication", "crm", "files", "research", "terminal", "other"},
        )
        self.assertGreater(payload["terminal_display_seconds"], 0)
        self.assertEqual(payload["terminal_display_seconds"], DEFAULT_TERMINAL_STATE_SECONDS)


if __name__ == "__main__":
    unittest.main()
