from __future__ import annotations

import argparse
import json
from pathlib import Path

from .engine import SimulationEngine
from .scenarios import required_scenarios


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def summarize(engine: SimulationEngine, scenario_id: str) -> dict:
    state = engine.state
    incomes = sum(state.metrics.income_by_source.values())
    expenses = sum(state.metrics.expenses_by_sink.values())
    return {
        "scenario": scenario_id,
        "schema": state.schema,
        "days": state.clock.day,
        "total_minutes": state.clock.total_minutes,
        "balances": {
            item.character_id: item.balance for item in state.characters.values()
        },
        "levels": {
            item.character_id: item.progression.level for item in state.characters.values()
        },
        "professional_xp": {
            item.character_id: item.progression.professional_xp
            for item in state.characters.values()
        },
        "income_total": incomes,
        "expense_total": expenses,
        "net_currency_change": incomes - expenses,
        "income_by_source": state.metrics.income_by_source,
        "expenses_by_sink": state.metrics.expenses_by_sink,
        "hermes": {
            "started": state.metrics.hermes_tasks_started,
            "completed": state.metrics.hermes_tasks_completed,
            "failed_or_interrupted": state.metrics.hermes_tasks_failed,
        },
        "critical_need_minutes": sum(state.metrics.needs_below_critical.values()),
        "idle_decisions": state.metrics.idle_decisions,
        "top_buildings": sorted(
            state.metrics.building_minutes.items(), key=lambda item: item[1], reverse=True
        )[:8],
    }


def main() -> None:
    root = project_root()
    parser = argparse.ArgumentParser(description="Run deterministic Syka World scenarios")
    parser.add_argument("--scenario", default="all")
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()
    config = load_json(root / "config" / "game-balance.v1.json")
    characters = load_json(root / "config" / "characters.json")
    scenarios = required_scenarios()
    if args.scenario != "all":
        scenarios = tuple(item for item in scenarios if item.scenario_id == args.scenario)
        if not scenarios:
            raise SystemExit(f"unknown scenario: {args.scenario}")
    result = []
    for scenario in scenarios:
        engine = SimulationEngine.new(config, characters, seed=scenario.seed)
        engine.schedule_signals(scenario.signals)
        engine.run_days(scenario.days)
        result.append({**summarize(engine, scenario.scenario_id), "description": scenario.description})
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))


if __name__ == "__main__":
    main()
