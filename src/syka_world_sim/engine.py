from __future__ import annotations

import json
from dataclasses import fields
from pathlib import Path
from typing import Iterable

from .contracts import (
    SAVE_SCHEMA,
    BridgeSignal,
    Building,
    Character,
    Inventory,
    Mission,
    Needs,
    Progression,
    Relationship,
    SimulationMetrics,
    SimulationState,
    WorldClock,
)


class SimulationEngine:
    def __init__(self, config: dict, state: SimulationState):
        if config.get("schema") != "syka.world.balance.v1":
            raise ValueError("unsupported balance schema")
        self.config = config
        self.state = state
        self._signals: dict[int, list[BridgeSignal]] = {}

    @classmethod
    def new(cls, config: dict, characters_config: dict, seed: int = 1) -> "SimulationEngine":
        starting = int(config["currency"]["starting_balance"])
        roles = {
            "default": "direction",
            "elen": "marketing",
            "astrelis": "commercial",
            "zerny": "construction-crm",
        }
        characters = {}
        buildings = {
            "plaza": Building("plaza", "public", 12),
            "cafe": Building("cafe", "social", 8),
        }
        for value in characters_config["characters"]:
            character = Character(
                character_id=value["character_id"],
                profile_id=value["profile_id"],
                role=roles[value["profile_id"]],
                home=value["home"],
                workplace=value["workplace"],
                location=value["home"],
                balance=starting,
            )
            characters[character.profile_id] = character
            buildings[character.home] = Building(character.home, "residential", 2)
            buildings[character.workplace] = Building(character.workplace, "workspace", 4)
        state = SimulationState(
            seed=seed,
            clock=WorldClock(minute_of_day=int(config["simulation"]["day_start_hour"]) * 60),
            characters=characters,
            buildings=buildings,
            relationships=[
                Relationship(a.character_id, b.character_id)
                for index, a in enumerate(characters.values())
                for b in list(characters.values())[index + 1 :]
            ],
            missions=[
                Mission("daily-meaningful-routines", "daily", 2),
                Mission("weekly-community-life", "weekly", 40),
            ],
        )
        return cls(config, state)

    def schedule_signals(self, signals: Iterable[BridgeSignal]) -> None:
        for signal in signals:
            self._signals.setdefault(signal.minute, []).append(signal)

    def run_minutes(self, minutes: int) -> SimulationState:
        tick = int(self.config["simulation"]["tick_minutes"])
        if minutes < 0 or minutes % tick:
            raise ValueError(f"minutes must be a non-negative multiple of {tick}")
        for _ in range(minutes // tick):
            self._tick(tick)
        return self.state

    def run_days(self, days: int) -> SimulationState:
        return self.run_minutes(days * 24 * 60)

    def _tick(self, minutes: int) -> None:
        absolute = self.state.clock.total_minutes
        for signal in sorted(self._signals.pop(absolute, []), key=lambda item: item.signal_id):
            self._apply_bridge_signal(signal)

        for character in self.state.characters.values():
            previous = character.action
            action, location = self._choose_action(character)
            if action != previous:
                character.action_minutes = 0
            character.action = action
            character.location = location
            character.action_minutes += minutes
            self._update_needs(character, minutes)
            self._record_activity(character, minutes)
            self._reward_action_interval(character, previous, minutes)

        previous_day = self.state.clock.day
        self.state.clock.total_minutes += minutes
        self.state.clock.minute_of_day += minutes
        if self.state.clock.minute_of_day >= 24 * 60:
            self.state.clock.minute_of_day -= 24 * 60
            self.state.clock.day += 1
        if self.state.clock.day != previous_day:
            self._close_day()

    def _choose_action(self, character: Character) -> tuple[str, str]:
        if character.active_bridge_session:
            if character.bridge_status == "waiting":
                return "hermes-waiting", character.workplace
            return "hermes-work", character.workplace

        needs = character.needs
        hour = self.state.clock.hour
        if needs.energy < 20 or hour < 7 or hour >= 22:
            return "sleep", character.home
        if needs.social < 20:
            return "socialize", "plaza"
        if needs.focus < 20:
            return "restore-focus", "cafe"
        if 7 <= hour < 9:
            return "morning-routine", "cafe"
        if 9 <= hour < 12 or 14 <= hour < 17:
            return "professional-practice", character.workplace
        if 12 <= hour < 14:
            return "socialize", "cafe"
        if 17 <= hour < 20:
            return "community-life", "plaza"
        if 20 <= hour < 22:
            return "personalize-home", character.home
        self.state.metrics.idle_decisions += 1
        return "idle", character.home

    def _update_needs(self, character: Character, minutes: int) -> None:
        hours = minutes / 60
        needs = character.needs
        rates = self.config["needs"]
        if character.action == "sleep":
            needs.energy += 14 * hours
            needs.comfort += 4 * hours
        else:
            needs.energy -= float(rates["energy_decay_awake_per_hour"]) * hours
            needs.comfort -= float(rates["comfort_decay_per_hour"]) * hours
        if character.action in {"professional-practice", "hermes-work"}:
            needs.focus -= float(rates["focus_decay_active_per_hour"]) * hours
        elif character.action in {"restore-focus", "morning-routine", "personalize-home"}:
            needs.focus += 10 * hours
        if character.action in {"socialize", "community-life"}:
            needs.social += 12 * hours
            needs.mood += 6 * hours
        else:
            needs.social -= float(rates["social_decay_per_hour"]) * hours
            needs.mood -= float(rates["mood_decay_per_hour"]) * hours
        if character.action == "personalize-home":
            needs.comfort += 10 * hours
            needs.mood += 4 * hours
        if character.action == "hermes-waiting":
            needs.focus += 2 * hours
        needs.clamp()
        for name in fields(Needs):
            if getattr(needs, name.name) < float(rates["critical_threshold"]):
                key = f"{character.character_id}:{name.name}"
                self.state.metrics.needs_below_critical[key] = (
                    self.state.metrics.needs_below_critical.get(key, 0) + minutes
                )

    def _record_activity(self, character: Character, minutes: int) -> None:
        metrics = self.state.metrics
        key = f"{character.character_id}:{character.action}"
        metrics.activity_minutes[key] = metrics.activity_minutes.get(key, 0) + minutes
        metrics.building_minutes[character.location] = (
            metrics.building_minutes.get(character.location, 0) + minutes
        )

    def _reward_action_interval(self, character: Character, previous: str, minutes: int) -> None:
        interval = int(self.config["simulation"]["action_reward_interval_minutes"])
        if character.action != previous or character.action_minutes % interval:
            return
        currency = self.config["currency"]
        progression = self.config["progression"]
        if character.action == "professional-practice":
            self._income(character, "local-practice", int(currency["local_practice_reward"]))
            self._xp(character, int(progression["local_practice_xp"]), professional=True)
            character.meaningful_actions_today += 1
        elif character.action == "community-life":
            self._income(character, "community", int(currency["community_reward"]))
            self._xp(character, int(progression["social_xp"]), professional=False)
            character.meaningful_actions_today += 1
            self._advance_weekly_mission()

    def _apply_bridge_signal(self, signal: BridgeSignal) -> None:
        character = self.state.characters.get(signal.profile_id)
        if character is None:
            return
        metrics = self.state.metrics
        metrics.event_counts[signal.type] = metrics.event_counts.get(signal.type, 0) + 1
        if signal.type == "activity.started":
            if signal.session_id not in character.active_bridge_sessions:
                character.active_bridge_sessions.append(signal.session_id)
            character.active_bridge_session = signal.session_id
            character.bridge_status = "working"
            character.action_minutes = 0
            metrics.hermes_tasks_started += 1
        elif signal.type == "activity.waiting" and character.active_bridge_session == signal.session_id:
            character.bridge_status = "waiting"
        elif signal.type == "activity.resumed" and character.active_bridge_session == signal.session_id:
            character.bridge_status = "working"
        elif signal.type == "activity.completed":
            was_active = signal.session_id in character.active_bridge_sessions
            character.active_bridge_sessions = [
                item for item in character.active_bridge_sessions if item != signal.session_id
            ]
            character.active_bridge_session = (
                character.active_bridge_sessions[-1] if character.active_bridge_sessions else None
            )
            character.bridge_status = "working" if character.active_bridge_session else None
            if not was_active:
                return
            full_limit = int(self.config["currency"]["hermes_daily_full_reward_limit"])
            reward = (
                int(self.config["currency"]["hermes_completion_reward"])
                if character.hermes_rewards_today < full_limit
                else int(self.config["currency"]["hermes_reduced_reward"])
            )
            self._income(character, "hermes-completion", reward)
            self._xp(character, int(self.config["progression"]["hermes_completion_xp"]), True)
            character.hermes_rewards_today += 1
            character.meaningful_actions_today += 1
            metrics.hermes_tasks_completed += 1
        elif signal.type in {"activity.failed", "activity.interrupted"}:
            character.active_bridge_sessions = [
                item for item in character.active_bridge_sessions if item != signal.session_id
            ]
            character.active_bridge_session = (
                character.active_bridge_sessions[-1] if character.active_bridge_sessions else None
            )
            character.bridge_status = "working" if character.active_bridge_session else None
            metrics.hermes_tasks_failed += 1

    def _close_day(self) -> None:
        currency = self.config["currency"]
        for character in self.state.characters.values():
            self._expense(character, "living", int(currency["daily_living_cost"]))
            if character.meaningful_actions_today >= 2:
                self._income(character, "daily-mission", int(currency["daily_mission_reward"]))
            character.hermes_rewards_today = 0
            character.meaningful_actions_today = 0
            character.daily_mission_claimed = False
        upkeep = int(currency["town_upkeep_per_character"]) * len(self.state.characters)
        self.state.town_balance -= upkeep
        self.state.metrics.expenses_by_sink["town-upkeep"] = (
            self.state.metrics.expenses_by_sink.get("town-upkeep", 0) + upkeep
        )
        if self.state.clock.day and self.state.clock.day % 7 == 0:
            weekly = next(item for item in self.state.missions if item.cadence == "weekly")
            if weekly.progress >= weekly.target:
                for character in self.state.characters.values():
                    self._income(character, "weekly-mission", int(currency["weekly_mission_reward"]))
            for character in self.state.characters.values():
                decor_cost = int(currency["weekly_decor_cost"])
                reserve = int(currency["spending_reserve"])
                if character.balance - decor_cost >= reserve:
                    self._expense(character, "decor-collection", decor_cost)
                    character.inventory.items["decor-token"] = (
                        character.inventory.items.get("decor-token", 0) + 1
                    )
            weekly.progress = 0
            weekly.completed = False

    def _advance_weekly_mission(self) -> None:
        mission = next(item for item in self.state.missions if item.cadence == "weekly")
        mission.progress += 1
        mission.completed = mission.progress >= mission.target

    def _income(self, character: Character, source: str, amount: int) -> None:
        character.balance += amount
        self.state.metrics.income_by_source[source] = (
            self.state.metrics.income_by_source.get(source, 0) + amount
        )

    def _expense(self, character: Character, sink: str, amount: int) -> None:
        charged = min(character.balance, amount)
        character.balance -= charged
        self.state.metrics.expenses_by_sink[sink] = (
            self.state.metrics.expenses_by_sink.get(sink, 0) + charged
        )

    def _xp(self, character: Character, amount: int, professional: bool) -> None:
        character.progression.general_xp += amount
        if professional:
            character.progression.professional_xp += amount
        per_level = int(self.config["progression"]["xp_per_level"])
        character.progression.level = 1 + character.progression.general_xp // per_level

    def save(self, path: Path) -> None:
        payload = {"schema": SAVE_SCHEMA, "state": self.state.to_dict()}
        temporary = path.with_suffix(path.suffix + ".tmp")
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    @classmethod
    def load(cls, config: dict, path: Path) -> "SimulationEngine":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("schema") != SAVE_SCHEMA:
            raise ValueError("unsupported save schema")
        value = payload["state"]
        characters = {}
        for profile, item in value["characters"].items():
            item = dict(item)
            item["needs"] = Needs(**item["needs"])
            item["inventory"] = Inventory(**item["inventory"])
            item["progression"] = Progression(**item["progression"])
            characters[profile] = Character(**item)
        state = SimulationState(
            seed=value["seed"],
            clock=WorldClock(**value["clock"]),
            characters=characters,
            buildings={key: Building(**item) for key, item in value["buildings"].items()},
            relationships=[Relationship(**item) for item in value["relationships"]],
            missions=[Mission(**item) for item in value["missions"]],
            town_balance=value["town_balance"],
            metrics=SimulationMetrics(**value["metrics"]),
        )
        return cls(config, state)
