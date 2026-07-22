from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable


MANIFEST_SCHEMA = "syka.world.spool-archive.v1"


@dataclass(frozen=True)
class ArchiveCandidate:
    path: str
    size_bytes: int
    modified_at: str
    pid: int | None
    reason: str


def plan_archive(
    spool_dir: Path,
    *,
    older_than_days: int = 14,
    now: datetime | None = None,
    process_alive: Callable[[int], bool] | None = None,
) -> list[ArchiveCandidate]:
    """Return inactive old spool files. This function never changes the filesystem."""
    if older_than_days < 1:
        raise ValueError("older_than_days must be at least 1")
    current = now or datetime.now(timezone.utc)
    cutoff = current - timedelta(days=older_than_days)
    alive = process_alive or _is_process_alive
    candidates: list[ArchiveCandidate] = []
    for path in sorted(spool_dir.glob("*.jsonl")) if spool_dir.exists() else []:
        stat = path.stat()
        modified = datetime.fromtimestamp(stat.st_mtime, timezone.utc)
        if modified > cutoff:
            continue
        pid = _pid_from_name(path.name)
        if pid is not None and alive(pid):
            continue
        candidates.append(
            ArchiveCandidate(
                path=str(path.resolve()),
                size_bytes=stat.st_size,
                modified_at=modified.isoformat().replace("+00:00", "Z"),
                pid=pid,
                reason=f"inactive_and_older_than_{older_than_days}_days",
            )
        )
    return candidates


def archive_candidates(
    candidates: list[ArchiveCandidate], archive_dir: Path, *, now: datetime | None = None
) -> Path:
    """Move candidates into a dated archive and write a checksummed restore manifest."""
    stamp = (now or datetime.now(timezone.utc)).strftime("%Y%m%dT%H%M%SZ")
    destination = archive_dir / stamp
    destination.mkdir(parents=True, exist_ok=False)
    entries: list[dict] = []
    for candidate in candidates:
        source = Path(candidate.path).resolve()
        target = destination / source.name
        if target.exists():
            raise FileExistsError(target)
        digest = _sha256(source)
        shutil.move(str(source), str(target))
        entries.append(
            {
                **asdict(candidate),
                "archived_path": str(target.resolve()),
                "sha256": digest,
            }
        )
    manifest = destination / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "schema": MANIFEST_SCHEMA,
                "created_at": (now or datetime.now(timezone.utc)).isoformat().replace("+00:00", "Z"),
                "entries": entries,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return manifest


def restore_archive(manifest_path: Path) -> int:
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    if payload.get("schema") != MANIFEST_SCHEMA:
        raise ValueError("unsupported archive manifest")
    restored = 0
    for entry in payload.get("entries", []):
        source = Path(entry["archived_path"]).resolve()
        target = Path(entry["path"]).resolve()
        if not source.exists():
            raise FileNotFoundError(source)
        if target.exists():
            raise FileExistsError(target)
        if _sha256(source) != entry["sha256"]:
            raise ValueError(f"checksum mismatch: {source.name}")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(target))
        restored += 1
    return restored


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _pid_from_name(name: str) -> int | None:
    stem = Path(name).stem
    tail = stem.rsplit("-", 1)[-1]
    return int(tail) if tail.isdigit() else None


def _is_process_alive(pid: int) -> bool:
    if os.name == "nt":
        import ctypes

        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        ctypes.windll.kernel32.CloseHandle(handle)
        return True
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Plan or reversibly archive inactive bridge spools")
    parser.add_argument("spool", type=Path)
    parser.add_argument("--older-than-days", type=int, default=14)
    parser.add_argument("--archive-dir", type=Path)
    parser.add_argument("--apply", action="store_true", help="Move candidates; default is dry-run")
    parser.add_argument("--restore", type=Path, help="Restore one manifest instead of planning")
    args = parser.parse_args()
    if args.restore:
        print(json.dumps({"restored": restore_archive(args.restore)}))
        return
    candidates = plan_archive(args.spool, older_than_days=args.older_than_days)
    result: dict = {"mode": "dry-run", "candidates": [asdict(item) for item in candidates]}
    if args.apply:
        if args.archive_dir is None:
            parser.error("--archive-dir is required with --apply")
        result = {
            "mode": "archived",
            "manifest": str(archive_candidates(candidates, args.archive_dir)),
            "count": len(candidates),
        }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
