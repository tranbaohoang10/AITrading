"""PB-026 readiness verifier fail-closed tests; no network or service."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import verify_readiness as readiness  # noqa: E402


class ReadinessVerifierTests(unittest.TestCase):
    def test_duplicate_malformed_and_nonfinite_json_fail_closed(self):
        with tempfile.TemporaryDirectory(prefix="pb026-json-") as folder:
            root = Path(folder)
            for raw in ('{"a":1,"a":2}', '{', '{"a":NaN}'):
                (root / "value.json").write_text(raw, encoding="utf-8")
                with self.assertRaises(readiness.ReadinessFailure):
                    readiness.read_json(root, "value.json")

    def test_path_traversal_symlink_and_oversize_are_rejected(self):
        with tempfile.TemporaryDirectory(prefix="pb026-path-") as folder:
            root = Path(folder)
            (root / "ok.txt").write_text("ok", encoding="utf-8")
            self.assertEqual(readiness.safe_path(root, "ok.txt"),
                             (root / "ok.txt").resolve())
            with self.assertRaises(readiness.ReadinessFailure):
                readiness.safe_path(root, "../outside")
            (root / "large.txt").write_bytes(b"x" * 5)
            with self.assertRaises(readiness.ReadinessFailure):
                readiness.safe_path(root, "large.txt", 4)
            try:
                (root / "link.txt").symlink_to(root / "ok.txt")
            except OSError:
                return
            with self.assertRaises(readiness.ReadinessFailure):
                readiness.safe_path(root, "link.txt")

    def test_backlog_missing_duplicate_order_state_and_publication_reject(self):
        def row(number: int, status: str = "DONE", issue: str | None = None,
                acceptance: str = "Delivered abc1234; CI123 SUCCESS") -> str:
            pb = f"PB-{number:03d}"
            issue = issue if issue is not None else f"[#1](https://x/issues/{number})"
            return f"| {pb} | f | d | P1 | {status} | {issue} | {acceptance} | s | t |"

        lines = []
        for number in range(1, 28):
            if number in (20, 21):
                lines.append(row(number, "DEFERRED_OPTIONAL", "not created", "deferred"))
            elif number == 26:
                lines.append(row(number, "IN_PROGRESS"))
            else:
                lines.append(row(number))
        parsed = readiness.parse_backlog("\n".join(lines))
        self.assertEqual(len(parsed), 27)
        for mutated in (lines[:-1], lines + [lines[-1]], lines[:3] + [lines[4], lines[3]] + lines[5:]):
            with self.assertRaises(readiness.ReadinessFailure):
                readiness.parse_backlog("\n".join(mutated))
        parsed[0]["acceptance"] = "no publication"
        with tempfile.TemporaryDirectory(prefix="pb026-backlog-") as folder:
            root = Path(folder)
            for number in set(range(1, 28)) - {20, 21}:
                base = root / f"specs/PB-{number:03d}"
                (base / "test-evidence").mkdir(parents=True)
                for name in ("spec.md", "design.md", "test-cases.md"):
                    (base / name).write_text("x", encoding="utf-8")
                (base / "test-evidence/result.md").write_text("x", encoding="utf-8")
            with self.assertRaisesRegex(readiness.ReadinessFailure, "publication"):
                readiness.validate_backlog(root, parsed)

    def test_migration_name_hash_and_extra_file_are_bound(self):
        with tempfile.TemporaryDirectory(prefix="pb026-migration-") as folder:
            root = Path(folder)
            directory = root / "backend/src/main/resources/db/migration"
            directory.mkdir(parents=True)
            ledger = {}
            for number in range(1, 18):
                name = f"V{number}__m.sql"
                data = f"-- {number}\n".encode()
                (directory / name).write_bytes(data)
                ledger[name] = hashlib.sha256(data).hexdigest()
            (root / "docs").mkdir()
            payload = {"schemaVersion": 1, "algorithm": "SHA-256", "migrations": ledger}
            (root / "docs/readiness-migrations.json").write_text(
                json.dumps(payload), encoding="utf-8")
            self.assertEqual(readiness.validate_migrations(root)[0], 17)
            (directory / "V7__m.sql").write_bytes(b"-- 7\r\n")
            self.assertEqual(readiness.validate_migrations(root)[0], 17)
            (directory / "V7__m.sql").write_text("tampered", encoding="utf-8")
            with self.assertRaisesRegex(readiness.ReadinessFailure, "mismatch"):
                readiness.validate_migrations(root)

    def test_secret_shapes_fail_without_reporting_the_value(self):
        with tempfile.TemporaryDirectory(prefix="pb026-secret-") as folder:
            path = Path(folder) / "source.txt"
            value = "AIza" + "A" * 31
            path.write_text(value, encoding="utf-8")
            with self.assertRaises(readiness.ReadinessFailure) as failure:
                readiness.scan_secret_shapes([path])
            self.assertNotIn(value, str(failure.exception))

    def test_markdown_and_json_are_deterministic(self):
        report = {"passed": True, "deferredOptional": ["PB-020", "PB-021"],
                  "unexplainedGaps": 0}
        self.assertEqual(readiness.markdown(report), readiness.markdown(dict(report)))
        left = json.dumps(report, sort_keys=True, separators=(",", ":"))
        right = json.dumps(dict(reversed(list(report.items()))), sort_keys=True,
                           separators=(",", ":"))
        self.assertEqual(left, right)


if __name__ == "__main__":
    unittest.main()
