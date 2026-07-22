"""Run one harmless turn through a Hermes Desktop-compatible local backend.

The dashboard token is read from ``HERMES_DASHBOARD_SESSION_TOKEN`` so it never
appears in the process arguments or validation output.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from typing import Any

import websockets


async def validate(port: int, profile: str, prompt: str, cwd: str) -> dict[str, Any]:
    token = os.environ.get("HERMES_DASHBOARD_SESSION_TOKEN")
    if not token:
        raise RuntimeError("HERMES_DASHBOARD_SESSION_TOKEN is required")

    uri = f"ws://127.0.0.1:{port}/api/ws?token={token}"
    event_types: list[str] = []
    responses: dict[str, Any] = {}

    async with websockets.connect(uri, max_size=16 * 1024 * 1024) as socket:
        await socket.send(
            json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": "create",
                    "method": "session.create",
                    "params": {"profile": profile, "source": "desktop", "cwd": cwd},
                }
            )
        )

        session_id: str | None = None
        deadline = time.monotonic() + 180
        submitted = False
        completed = False

        while time.monotonic() < deadline and not completed:
            timeout = max(0.1, deadline - time.monotonic())
            raw = await asyncio.wait_for(socket.recv(), timeout=timeout)
            frame = json.loads(raw)

            if frame.get("id") == "create":
                if frame.get("error"):
                    raise RuntimeError(f"session.create failed: {frame['error']}")
                responses["create"] = "ok"
                result = frame.get("result") or {}
                session_id = result.get("session_id")
                if not session_id:
                    raise RuntimeError("session.create returned no session_id")
                await socket.send(
                    json.dumps(
                        {
                            "jsonrpc": "2.0",
                            "id": "submit",
                            "method": "prompt.submit",
                            "params": {"session_id": session_id, "text": prompt},
                        }
                    )
                )
                submitted = True
                continue

            if frame.get("id") == "submit":
                if frame.get("error"):
                    raise RuntimeError(f"prompt.submit failed: {frame['error']}")
                responses["submit"] = "ok"
                continue

            event = frame.get("params") if frame.get("method") else None
            if not isinstance(event, dict):
                continue
            event_type = str(event.get("type") or "")
            if event_type:
                event_types.append(event_type)
            if event.get("session_id") == session_id and event_type == "message.complete":
                completed = True

        if not submitted:
            raise RuntimeError("prompt was not submitted")
        if not completed:
            raise TimeoutError("Hermes turn did not complete within 180 seconds")

    return {
        "profile": profile,
        "session_created": responses.get("create") == "ok",
        "prompt_submitted": responses.get("submit") == "ok",
        "turn_completed": completed,
        "event_types": sorted(set(event_types)),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--profile", required=True)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--cwd", required=True)
    args = parser.parse_args()

    try:
        result = asyncio.run(validate(args.port, args.profile, args.prompt, args.cwd))
    except Exception as exc:  # validation CLI: concise, machine-readable failure
        print(json.dumps({"profile": args.profile, "ok": False, "error": str(exc)}))
        return 1

    print(json.dumps({"ok": True, **result}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
