from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from syka_world_sim.engine import SimulationEngine
from syka_world_sim.scenarios import required_scenarios


ROOT = Path(__file__).resolve().parents[1]


class SimulationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.config = json.loads((ROOT / "config" / "game-balance.v1.json").read_text(encoding="utf-8"))
        cls.characters = json.loads((ROOT / "config" / "characters.json").read_text(encoding="utf-8"))

    def engine(self, seed: int = 1) -> SimulationEngine:
        return SimulationEngine.new(self.config, self.characters, seed=seed)

    def test_same_seed_and_inputs_are_deterministic(self):
        first = self.engine(42)
        second = self.engine(42)
        first.run_days(7)
        second.run_days(7)
        self.assertEqual(first.state.to_dict(), second.state.to_dict())

    def test_world_progresses_without_hermes(self):
        engine = self.engine()
        engine.run_days(1)
        self.assertGreater(sum(engine.state.metrics.income_by_source.values()), 0)
        self.assertTrue(
            all(item.progression.general_xp > 0 for item in engine.state.characters.values())
        )
        self.assertEqual(engine.state.metrics.hermes_tasks_started, 0)

    def test_thirty_days_complete_with_bounded_needs_and_nonnegative_balances(self):
        engine = self.engine(17)
        scenario = next(item for item in required_scenarios() if item.scenario_id == "normal-30d")
        engine.schedule_signals(scenario.signals)
        engine.run_days(30)
        self.assertEqual(engine.state.clock.day, 30)
        for character in engine.state.characters.values():
            self.assertGreaterEqual(character.balance, 0)
            for value in character.needs.__dict__.values():
                self.assertGreaterEqual(value, 0)
                self.assertLessEqual(value, 100)

    def test_concurrent_bridge_sessions_keep_work_active_until_both_end(self):
        scenario = next(item for item in required_scenarios() if item.scenario_id == "concurrent-elen-1d")
        engine = self.engine()
        engine.schedule_signals(scenario.signals)
        engine.run_minutes(255)
        elen = engine.state.characters["elen"]
        self.assertEqual(elen.active_bridge_sessions, ["b"])
        self.assertEqual(elen.action, "hermes-work")
        engine.run_minutes(60)
        self.assertEqual(elen.active_bridge_sessions, [])

    def test_failed_and_interrupted_tasks_have_no_direct_currency_penalty(self):
        scenario = next(item for item in required_scenarios() if item.scenario_id == "interruptions-1d")
        engine = self.engine()
        starting = {profile: item.balance for profile, item in engine.state.characters.items()}
        engine.schedule_signals(scenario.signals)
        engine.run_minutes(315)
        self.assertNotIn("error", engine.state.metrics.expenses_by_sink)
        self.assertNotIn("interrupted", engine.state.metrics.expenses_by_sink)
        self.assertGreaterEqual(engine.state.characters["default"].balance, starting["default"])

    def test_hermes_rewards_use_diminishing_returns(self):
        scenario = next(item for item in required_scenarios() if item.scenario_id == "overloaded-zerny-1d")
        engine = self.engine()
        engine.schedule_signals(scenario.signals)
        engine.run_days(1)
        self.assertEqual(engine.state.metrics.hermes_tasks_completed, 8)
        self.assertEqual(engine.state.metrics.income_by_source["hermes-completion"], 24)

    def test_save_load_roundtrip_preserves_future_determinism(self):
        first = self.engine(99)
        first.run_days(2)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "save.json"
            first.save(path)
            restored = SimulationEngine.load(self.config, path)
            first.run_days(2)
            restored.run_days(2)
            self.assertEqual(first.state.to_dict(), restored.state.to_dict())


if __name__ == "__main__":
    unittest.main()
