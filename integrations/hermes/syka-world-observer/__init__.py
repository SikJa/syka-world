"""Passive Hermes lifecycle observer for Syka World.

The plugin never registers tools, commands, middleware, or behavior-changing
callbacks. It only appends privacy-minimized events to a local spool.
"""

from __future__ import annotations

import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path


_LOCK = threading.Lock()
_SECRET = re.compile(
    r"(?i)(?:sk|key|token|secret|password)[-_:= ]+[A-Za-z0-9_./+\-=]{8,}"
)
_URL = re.compile(r"https?://\S+")
_WHITESPACE = re.compile(r"\s+")


def _root_from_home(home: Path) -> Path:
    if home.parent.name.lower() == "profiles":
        return home.parent.parent
    return home


def _summary(value: str | None, limit: int = 140) -> str | None:
    text = _WHITESPACE.sub(" ", value or "").strip()
    if not text:
        return None
    text = _SECRET.sub("[redacted]", text)
    text = _URL.sub("[link]", text)
    if len(text) > limit:
        text = text[: limit - 1].rstrip() + "…"
    return text


def _tool_family(tool_name: str | None) -> str:
    name = (tool_name or "").lower()
    if any(term in name for term in ("browser", "playwright", "chrome", "web")):
        return "browser"
    if any(term in name for term in ("terminal", "shell", "command", "exec")):
        return "terminal"
    if any(term in name for term in ("file", "read", "write", "patch", "edit")):
        return "files"
    if any(term in name for term in ("search", "research", "fetch", "extract")):
        return "research"
    if any(term in name for term in ("mail", "telegram", "slack", "message", "calendar")):
        return "communication"
    if any(term in name for term in ("crm", "kanban", "contact", "lead")):
        return "crm"
    if any(term in name for term in ("code", "git", "test", "lint")):
        return "code"
    return "other"


def register(ctx):
    profile_id = str(ctx.profile_name or "default")
    hermes_home = Path(os.environ.get("HERMES_HOME") or Path.home() / ".hermes")
    spool = _root_from_home(hermes_home) / "syka-world" / "events"
    spool_file = spool / f"{profile_id}-{os.getpid()}.jsonl"

    def emit(event_type: str, session_id: str = "", **fields) -> None:
        try:
            spool.mkdir(parents=True, exist_ok=True)
            event = {
                "schema": "syka.world.event.v1",
                "event_id": str(uuid.uuid4()),
                "occurred_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "profile_id": profile_id,
                "session_id": str(session_id or fields.pop("task_id", "") or "unknown"),
                "type": event_type,
                "source": "hermes-plugin",
                **{key: value for key, value in fields.items() if value is not None},
            }
            line = json.dumps(event, ensure_ascii=False, separators=(",", ":")) + "\n"
            with _LOCK, spool_file.open("a", encoding="utf-8") as handle:
                handle.write(line)
                handle.flush()
        except Exception:
            # Observability must never interfere with the agent.
            return

    def on_session_start(session_id="", model="", platform="", **kwargs):
        emit("session.started", session_id, metadata={"platform": platform})

    def pre_llm_call(session_id="", user_message="", platform="", **kwargs):
        emit(
            "activity.started",
            session_id,
            activity="thinking",
            task_summary=_summary(user_message),
            metadata={"platform": platform},
        )
        return None

    def pre_tool_call(tool_name="", task_id="", session_id="", **kwargs):
        emit(
            "tool.started",
            session_id or task_id,
            tool_family=_tool_family(tool_name),
            metadata={"tool_name": _summary(tool_name, 60)},
        )
        return None

    def post_tool_call(tool_name="", task_id="", session_id="", duration_ms=0, **kwargs):
        emit(
            "tool.finished",
            session_id or task_id,
            tool_family=_tool_family(tool_name),
            metadata={"tool_name": _summary(tool_name, 60), "duration_ms": int(duration_ms or 0)},
        )

    def on_session_end(
        session_id="", task_id="", completed=False, interrupted=False, platform="", **kwargs
    ):
        if interrupted:
            event_type = "activity.interrupted"
        elif completed:
            event_type = "activity.completed"
        else:
            event_type = "activity.failed"
        emit(event_type, session_id or task_id, metadata={"platform": platform})

    def pre_approval_request(session_key="", surface="", **kwargs):
        emit(
            "activity.waiting",
            session_key,
            activity="waiting",
            metadata={"reason": "approval", "surface": _summary(surface, 30)},
        )

    def post_approval_response(session_key="", surface="", choice="", **kwargs):
        emit(
            "activity.resumed",
            session_key,
            activity="thinking",
            metadata={
                "reason": "approval_resolved",
                "surface": _summary(surface, 30),
                "choice": _summary(choice, 30),
            },
        )

    ctx.register_hook("on_session_start", on_session_start)
    ctx.register_hook("pre_llm_call", pre_llm_call)
    ctx.register_hook("pre_tool_call", pre_tool_call)
    ctx.register_hook("post_tool_call", post_tool_call)
    ctx.register_hook("on_session_end", on_session_end)
    ctx.register_hook("pre_approval_request", pre_approval_request)
    ctx.register_hook("post_approval_response", post_approval_response)
