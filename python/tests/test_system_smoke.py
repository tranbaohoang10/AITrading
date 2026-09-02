"""PB-025 smoke boundary tests; no API, database or external service is started."""
from __future__ import annotations

import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import smoke_system  # noqa: E402


class SystemSmokeBoundaryTests(unittest.TestCase):
    def test_snapshot_hash_is_canonical_and_sensitive(self):
        left = {"b": [2, 3], "a": "synthetic"}
        right = json.loads('{"a":"synthetic","b":[2,3]}')
        self.assertEqual(smoke_system.snapshot_hash(left),
                         smoke_system.snapshot_hash(right))
        right["b"][1] = 4
        self.assertNotEqual(smoke_system.snapshot_hash(left),
                            smoke_system.snapshot_hash(right))

    def test_owned_harness_and_report_paths_fail_closed(self):
        with tempfile.TemporaryDirectory(prefix="pb025-path-") as folder:
            root = Path(folder)
            owned = root / "tmp/pg-test-owned"
            (owned / "data").mkdir(parents=True)
            (owned / "data/PG_VERSION").write_text("17", encoding="utf-8")
            (owned / "password").write_text("ephemeral", encoding="utf-8")
            report = root / "specs/PB-025/test-evidence/system-smoke.json"
            with patch.object(smoke_system, "ROOT", root):
                self.assertEqual(smoke_system.validate_paths(str(owned), str(report)),
                                 (owned.resolve(), report.resolve()))
                with self.assertRaisesRegex(RuntimeError, "owned cluster"):
                    smoke_system.validate_paths(str(root / "tmp/not-owned"),
                                                str(report))
                with self.assertRaisesRegex(RuntimeError, "inside the repository"):
                    smoke_system.validate_paths(str(owned),
                                                str(root.parent / "outside.json"))
                with self.assertRaisesRegex(RuntimeError, "JSON report"):
                    smoke_system.validate_paths(str(owned),
                                                str(root / "report.txt"))


if __name__ == "__main__":
    unittest.main()
