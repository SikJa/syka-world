from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


SIMULATION_SCHEMA = "syka.world.simulation.v1"
SAVE_SCHEMA = "syka.world.save.v1"
BRIDGE_SIGNAL_SCHEMA = "syka.world.bridge-signal.v1"


@dataclass
class WorldClock:
    day: int = 0
    minute_of_day: int = 7 * 60
    total_minutes: int = 0

    @property
    def hour(self) -> float:
        return self.minute_of_day / 60


@dataclass
class Needs:
    energy: float = 80.0
    focus: float = 75.0
    mood: float = 75.0
    social: float = 65.0
    comfort: float = 70.0

    def clamp(self) -> None:
        for name in self.__dataclass_fields__:
            setattr(self, name, min(100.0, max(0.0, float(getattr(self, name)))))


@dataclass
class Inventory:
    items: dict[str, int] = field(default_factory=dict)


@dataclass
class Progression:
    level: int = 1
    general_xp: int = 0
    professional_xp: int = 0
    reputation: int = 0
    affinity: int = 0


@dataclass
class Character:
    character_id: str
    profile_id: str
    role: str
    home: str
    workplace: str
    location: str
    action: str = "idle"
    action_minutes: int = 0
    needs: Needs = field(default_factory=Needs)
    inventory: Inventory = field(default_factory=Inventory)
    progression: Progression = field(default_factory=Progression)
    balance: int = 40
    active_bridge_session: str | None = None
    active_bridge_sessions: list[str] = field(default_factory=list)
    bridge_status: str | None = None
    hermes_rewards_today: int = 0
    meaningful_actions_today: int = 0
    daily_mission_claimed: bool = False


@dataclass
class Building:
    building_id: str
    kind: str
    capacity: int
    level: int = 1


@dataclass
class Relationship:
    first_character_id: str
    second_character_id: str
    affinity: int = 0


@dataclass
class Mission:
    mission_id: str
    cadence: str
    target: int
    progress: int = 0
    completed: bool = False


@dataclass(frozen=True)
class BridgeSignal:
    signal_id: str
    profile_id: str
    session_id: str
    type: str
    minute: int
    tool_family: str | None = None
    schema: str = BRIDGE_SIGNAL_SCHEMA


@dataclass
class SimulationMetrics:
    activity_minutes: dict[str, int] = field(default_factory=dict)
    income_by_source: dict[str, int] = field(default_factory=dict)
    expenses_by_sink: dict[str, int] = field(default_factory=dict)
    building_minutes: dict[str, int] = field(default_factory=dict)
    event_counts: dict[str, int] = field(default_factory=dict)
    needs_below_critical: dict[str, int] = field(default_factory=dict)
    idle_decisions: int = 0
    hermes_tasks_started: int = 0
    hermes_tasks_completed: int = 0
    hermes_tasks_failed: int = 0


@dataclass
class SimulationState:
    seed: int
    clock: WorldClock
    characters: dict[str, Character]
    buildings: dict[str, Building]
    relationships: list[Relationship]
    missions: list[Mission]
    town_balance: int = 0
    metrics: SimulationMetrics = field(default_factory=SimulationMetrics)
    schema: str = SIMULATION_SCHEMA

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
