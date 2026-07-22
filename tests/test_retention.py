from __future__ import annotations

import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from syka_world_bridge.retention import archive_candidates, plan_archive, restore_archive


class RetentionTests(unittest.TestCase):
    def test_plan_is_dry_run_and_skips_recent_or_live_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old = root / "elen-100.jsonl"
            live = root / "zerny-200.jsonl"
            recent = root / "default-300.jsonl"
            for path in (old, live, recent):
                path.write_text("{}\n", encoding="utf-8")
            old_time = datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp()
            os.utime(old, (old_time, old_time))
            os.utime(live, (old_time, old_time))
            candidates = plan_archive(
                root,
                older_than_days=14,
                now=datetime(2026, 2, 1, tzinfo=timezone.utc),
                process_alive=lambda pid: pid == 200,
            )
            self.assertEqual([Path(item.path).name for item in candidates], ["elen-100.jsonl"])
            self.assertTrue(old.exists())
            self.assertTrue(live.exists())
            self.assertTrue(recent.exists())

    def test_archive_has_checksum_manifest_and_is_reversible(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            spool = root / "spool"
            spool.mkdir()
            path = spool / "elen-100.jsonl"
            path.write_text(json.dumps({"event_id": "safe"}) + "\n", encoding="utf-8")
            old_time = datetime(2026, 1, 1, tzinfo=timezone.utc).timestamp()
            os.utime(path, (old_time, old_time))
            now = datetime(2026, 2, 1, tzinfo=timezone.utc)
            candidates = plan_archive(
                spool, older_than_days=14, now=now, process_alive=lambda _: False
            )
            manifest = archive_candidates(candidates, root / "archive", now=now)
            self.assertFalse(path.exists())
            payload = json.loads(manifest.read_text(encoding="utf-8"))
            self.assertEqual(payload["schema"], "syka.world.spool-archive.v1")
            self.assertEqual(len(payload["entries"][0]["sha256"]), 64)
            self.assertEqual(restore_archive(manifest), 1)
            self.assertTrue(path.exists())


if __name__ == "__main__":
    unittest.main()
