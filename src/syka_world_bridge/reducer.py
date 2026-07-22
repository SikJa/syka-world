from __future__ import annotations

from copy import deepcopy
from datetime import datetime

from .contracts import CharacterState, SessionActivity, WorldEvent


TOOL_ANIMATIONS = {
    "browser": "using-computer",
    "code": "typing",
    "communication": "using-phone",
    "crm": "organizing",
    "files": "reading",
    "research": "thinking",
    "terminal": "typing",
}


class WorldReducer:
    def __init__(self, characters: dict[str, CharacterState]):
        self._characters = deepcopy(characters)
        self._seen: set[str] = set()
        self._sessions: dict[tuple[str, str], SessionActivity] = {}
        self.unassigned_events: list[dict] = []

    def apply(self, event: WorldEvent) -> bool:
        if event.event_id in self._seen:
            return False
        self._seen.add(event.event_id)

        character = self._characters.get(event.profile_id)
        if character is None:
            self.unassigned_events.append(event.to_dict())
            self.unassigned_events = self.unassigned_events[-100:]
            return False

        key = (event.profile_id, event.session_id)
        session = self._sessions.setdefault(
            key,
            SessionActivity(
                profile_id=event.profile_id,
                session_id=event.session_id,
                source=event.source,
            ),
        )

        # Ordering is per session. A delayed event from one session must not
        # erase its newer state, while another concurrent session remains free
        # to contribute its own timeline.
        if session.updated_at and _timestamp(event.occurred_at) < _timestamp(session.updated_at):
            return False

        # Once the official observer has spoken for a session, delayed fallback
        # rows cannot replace it. The fallback may bootstrap the same session
        # first; official events are always allowed to take ownership later.
        if session.source != "hermes-session-sqlite" and event.source == "hermes-session-sqlite":
            return False
        character.last_signal_at = event.occurred_at
        if event.source == "hermes-session-sqlite":
            character.presence = "degraded"
            character.degraded_reason = "plugin_unavailable_or_recovering"
        elif event.source != "bridge-recovery":
            character.presence = "online"
            character.degraded_reason = None
        if event.source != "hermes-session-sqlite":
            session.source = event.source
        session.updated_at = event.occurred_at
        session.last_event_id = event.event_id

        if event.type == "activity.started":
            session.active = True
            session.status = "working"
            session.activity = event.activity or "thinking"
            session.task_summary = event.task_summary
            session.tool_family = None
            session.waiting_reason = None
        elif event.type == "activity.waiting":
            session.active = True
            session.status = "waiting"
            session.activity = "waiting"
            session.tool_family = None
            session.waiting_reason = str(event.metadata.get("reason") or "approval")
        elif event.type == "activity.resumed":
            session.active = True
            session.status = "working"
            session.activity = "thinking"
            session.tool_family = None
            session.waiting_reason = None
        elif event.type == "tool.started":
            session.active = True
            session.status = "working"
            session.activity = "using-tool"
            session.tool_family = event.tool_family or "other"
            session.waiting_reason = None
        elif event.type == "tool.finished":
            session.active = True
            session.status = "working"
            session.activity = "thinking"
        elif event.type == "activity.completed":
            session.active = False
            session.status = "done"
            session.activity = "completed"
            session.tool_family = None
            session.waiting_reason = None
            session.last_outcome = "completed"
            character.last_outcome = "completed"
            character.last_outcome_at = event.occurred_at
        elif event.type == "activity.interrupted":
            session.active = False
            session.status = "interrupted"
            session.activity = "interrupted"
            session.tool_family = None
            session.waiting_reason = None
            session.last_outcome = "interrupted"
            character.last_outcome = "interrupted"
            character.last_outcome_at = event.occurred_at
        elif event.type == "activity.failed":
            session.active = False
            session.status = "error"
            session.activity = "error"
            session.tool_family = None
            session.waiting_reason = None
            session.last_outcome = "failed"
            character.last_outcome = "failed"
            character.last_outcome_at = event.occurred_at
        elif event.type == "activity.settled":
            session.active = False
            session.status = "idle"
            session.activity = "roaming"
            session.tool_family = None
            session.waiting_reason = None
        elif event.type == "profile.offline":
            character.presence = "offline"
        elif event.type == "profile.unknown":
            character.presence = "unknown"

        self._aggregate_character(character, terminal_event=event)
        return True

    def _aggregate_character(self, character: CharacterState, terminal_event: WorldEvent) -> None:
        sessions = [
            item for (profile, _), item in self._sessions.items() if profile == character.profile_id
        ]
        active = [item for item in sessions if item.active]
        character.active_session_count = len(active)

        if active:
            dominant = max(active, key=_session_priority)
            character.dominant_session_id = dominant.session_id
            character.session_id = dominant.session_id
            character.last_event_id = dominant.last_event_id
            character.updated_at = dominant.updated_at
            character.active_source = dominant.source
            character.status = dominant.status
            character.activity = dominant.activity
            character.destination = character.workplace
            character.task_summary = dominant.task_summary
            character.tool_family = dominant.tool_family
            character.waiting_reason = dominant.waiting_reason
            if dominant.status == "waiting":
                character.animation = "waiting"
            elif dominant.activity == "using-tool":
                character.animation = TOOL_ANIMATIONS.get(dominant.tool_family or "other", "working")
            else:
                character.animation = "thinking"
            return

        character.dominant_session_id = None
        character.active_source = terminal_event.source
        character.session_id = terminal_event.session_id
        character.last_event_id = terminal_event.event_id
        character.updated_at = terminal_event.occurred_at
        character.tool_family = None
        character.waiting_reason = None

        if terminal_event.type == "activity.completed":
            character.status = "done"
            character.activity = "completed"
            character.destination = character.workplace
            character.animation = "celebrate"
            character.last_outcome = "completed"
            character.last_outcome_at = terminal_event.occurred_at
        elif terminal_event.type == "activity.interrupted":
            character.status = "interrupted"
            character.activity = "interrupted"
            character.destination = character.workplace
            character.animation = "confused"
            character.last_outcome = "interrupted"
            character.last_outcome_at = terminal_event.occurred_at
        elif terminal_event.type == "activity.failed":
            character.status = "error"
            character.activity = "error"
            character.destination = character.workplace
            character.animation = "error"
            character.last_outcome = "failed"
            character.last_outcome_at = terminal_event.occurred_at
        elif character.presence == "offline":
            character.status = "offline"
            character.activity = "offline"
            character.destination = character.home
            character.animation = "sleep"
            character.task_summary = None
        elif terminal_event.type in {"activity.settled", "profile.online", "session.started"}:
            character.status = "idle"
            character.activity = "roaming"
            character.destination = "town"
            character.animation = "walk"
            character.task_summary = None

    def snapshot(self, generated_at: str) -> dict:
        return {
            "schema": "syka.world.state.v1",
            "generated_at": generated_at,
            "characters": [state.to_dict() for state in self._characters.values()],
            "diagnostics": {"unassigned_event_count": len(self.unassigned_events)},
        }

    def session_snapshot(self) -> list[dict]:
        return [
            value.to_dict()
            for _, value in sorted(self._sessions.items(), key=lambda item: item[0])
        ]

    def export_checkpoint(self) -> dict:
        return {
            "seen_event_ids": sorted(self._seen)[-10000:],
            "characters": {
                profile: state.to_dict() for profile, state in self._characters.items()
            },
            "sessions": [item.to_dict() for item in self._sessions.values()],
        }

    def restore_checkpoint(self, payload: dict) -> None:
        self._seen = {str(item) for item in payload.get("seen_event_ids", [])}
        for profile, value in payload.get("characters", {}).items():
            if profile in self._characters:
                allowed = CharacterState.__dataclass_fields__
                self._characters[profile] = CharacterState(
                    **{key: item for key, item in value.items() if key in allowed}
                )
        self._sessions = {}
        allowed = SessionActivity.__dataclass_fields__
        for value in payload.get("sessions", []):
            session = SessionActivity(
                **{key: item for key, item in value.items() if key in allowed}
            )
            self._sessions[(session.profile_id, session.session_id)] = session


def _timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _session_priority(session: SessionActivity) -> tuple[int, datetime, str]:
    state_priority = {
        "waiting": 3,
        "working": 2,
        "idle": 1,
    }
    when = _timestamp(session.updated_at or "1970-01-01T00:00:00Z")
    return (state_priority.get(session.status, 0), when, session.session_id)
