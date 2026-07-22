from __future__ import annotations

import json
from pathlib import Path

from .contracts import CharacterState


def load_registry(path: Path) -> dict[str, CharacterState]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schema") != "syka.world.characters.v1":
        raise ValueError("Unsupported character registry schema")

    result: dict[str, CharacterState] = {}
    for entry in payload.get("characters", []):
        profile_id = str(entry["profile_id"])
        if profile_id in result:
            raise ValueError(f"Duplicate profile_id in registry: {profile_id}")
        result[profile_id] = CharacterState(
            character_id=str(entry["character_id"]),
            display_name=str(entry["display_name"]),
            profile_id=profile_id,
            home=str(entry["home"]),
            workplace=str(entry["workplace"]),
        )
    return result

