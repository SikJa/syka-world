from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from .reducer import WorldReducer
from .registry import load_registry
from .runtime import WorldRuntime
from .server import serve
from .session_fallback import SQLiteSessionFallback, discover_session_databases


def default_hermes_root() -> Path:
    configured = os.environ.get("HERMES_HOME")
    if configured:
        return Path(configured).expanduser()
    local = os.environ.get("LOCALAPPDATA")
    if local:
        return Path(local) / "hermes"
    return Path.home() / ".hermes"


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def build_runtime(
    registry_path: Path,
    spool_dir: Path,
    checkpoint_path: Path | None = None,
    hermes_root: Path | None = None,
    fallback_enabled: bool = True,
) -> WorldRuntime:
    registry = load_registry(registry_path)
    root = hermes_root or default_hermes_root()
    fallback = (
        SQLiteSessionFallback(discover_session_databases(root, registry.keys()))
        if fallback_enabled
        else None
    )
    return WorldRuntime(
        WorldReducer(registry),
        spool_dir,
        checkpoint_path=checkpoint_path or root / "syka-world" / "bridge-checkpoint-v1.json",
        session_fallback=fallback,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Passive Hermes observer for Syka World")
    parser.add_argument("--registry", type=Path, default=project_root() / "config" / "characters.json")
    parser.add_argument("--spool", type=Path, default=default_hermes_root() / "syka-world" / "events")
    parser.add_argument(
        "--checkpoint",
        type=Path,
        default=default_hermes_root() / "syka-world" / "bridge-checkpoint-v1.json",
    )
    parser.add_argument("--no-session-fallback", action="store_true")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--once", action="store_true", help="Read current events and print one snapshot")
    args = parser.parse_args()

    runtime = build_runtime(
        args.registry,
        args.spool,
        checkpoint_path=args.checkpoint,
        fallback_enabled=not args.no_session_fallback,
    )
    if args.once:
        runtime.scan_once()
        print(json.dumps(runtime.snapshot(), ensure_ascii=False, indent=2))
        return
    serve(runtime, args.host, args.port)


if __name__ == "__main__":
    main()
