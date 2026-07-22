from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


EVENT_SCHEMA = "syka.world.event.v1"
STATE_SCHEMA = "syka.world.state.v1"
CHECKPOINT_SCHEMA = "syka.world.bridge-checkpoint.v1"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class WorldEvent:
    event_id: str
    occurred_at: str
    profile_id: str
    session_id: str
    type: str
    source: str = "hermes-plugin"
    activity: str | None = None
    task_summary: str | None = None
    tool_family: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    schema: str = EVENT_SCHEMA

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> "WorldEvent":
        if value.get("schema") != EVENT_SCHEMA:
            raise ValueError(f"Unsupported event schema: {value.get('schema')!r}")
        required = ("event_id", "occurred_at", "profile_id", "session_id", "type")
        missing = [key for key in required if not value.get(key)]
        if missing:
            raise ValueError(f"Missing event fields: {', '.join(missing)}")
        return cls(
            event_id=str(value["event_id"]),
            occurred_at=str(value["occurred_at"]),
            profile_id=str(value["profile_id"]),
            session_id=str(value["session_id"]),
            type=str(value["type"]),
            source=str(value.get("source") or "hermes-plugin"),
            activity=value.get("activity"),
            task_summary=value.get("task_summary"),
            tool_family=value.get("tool_family"),
            metadata=dict(value.get("metadata") or {}),
        )

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class CharacterState:
    character_id: str
    display_name: str
    profile_id: str
    home: str
    workplace: str
    status: str = "idle"
    activity: str = "roaming"
    destination: str = "town"
    animation: str = "walk"
    task_summary: str | None = None
    tool_family: str | None = None
    waiting_reason: str | None = None
    last_outcome: str | None = None
    last_outcome_at: str | None = None
    session_id: str | None = None
    last_event_id: str | None = None
    updated_at: str | None = None
    presence: str = "unknown"
    last_signal_at: str | None = None
    active_source: str | None = None
    active_session_count: int = 0
    dominant_session_id: str | None = None
    degraded_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class SessionActivity:
    """Privacy-safe activity state for one Hermes session."""

    profile_id: str
    session_id: str
    status: str = "idle"
    activity: str = "roaming"
    tool_family: str | None = None
    task_summary: str | None = None
    waiting_reason: str | None = None
    source: str = "unknown"
    active: bool = False
    updated_at: str | None = None
    last_event_id: str | None = None
    last_outcome: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
