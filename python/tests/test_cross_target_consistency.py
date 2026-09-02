"""PB-017 verifier tests use copied synthetic evidence, never target execution."""
from __future__ import annotations

from contextlib import contextmanager
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from verify_cross_target import (  # noqa: E402
    EvidenceError,
    markdown_report,
    numbers_match,
    verify_manifest,
)


class CrossTargetConsistencyTests(unittest.TestCase):
    @contextmanager
    def evidence_copy(self):
        manifest_path = ROOT / "specs/PB-017/evidence-manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory(prefix="pb017-", dir=ROOT / "tmp") as folder:
            root = Path(folder)
            paths = {"specs/PB-017/evidence-manifest.json"}
            paths.update([manifest["pineTargetManifest"], manifest["pineRuntimeVerification"],
                          manifest["mql5TargetManifest"], manifest["mql5RuntimeVerification"]])
            for fixture in manifest["fixtures"]:
                paths.update(
                    [fixture["python"], fixture["pineFixture"], fixture["pineEvidence"]["source"],
                     fixture["mql5Csv"], fixture["mql5Log"]]
                )
            for relative in paths:
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / relative, target)
            yield root, root / "specs/PB-017/evidence-manifest.json"

    def mutate_manifest(self, path: Path, callback):
        manifest = json.loads(path.read_text(encoding="utf-8"))
        callback(manifest)
        path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    def test_eight_actual_evidence_sets_pass_and_report_is_deterministic(self):
        report = verify_manifest()
        self.assertEqual(report["status"], "PASS")
        self.assertEqual(report["summary"], {
            "fixtures": 8, "bars": 51, "pineAssertionValuesCompared": 1359,
            "pineRawFieldComparisons": 764, "mql5ActualFieldsCompared": 1410,
            "unexplainedDivergences": 0,
        })
        modes = {item["pineEvidenceMode"] for item in report["fixtures"]}
        self.assertEqual(modes, {"RAW_COMPACT", "RAW_LEGACY_COMPACT", "ASSERTION_CERTIFIED_RUNTIME"})
        first_json = json.dumps(report, sort_keys=True)
        self.assertEqual(first_json, json.dumps(verify_manifest(), sort_keys=True))
        self.assertEqual(markdown_report(report), markdown_report(verify_manifest()))

    def test_path_name_duplicate_json_and_size_boundaries_fail_closed(self):
        with self.evidence_copy() as (root, path):
            self.mutate_manifest(path, lambda m: m["fixtures"][0].__setitem__("python", "../causal-all-indicators.json"))
            with self.assertRaisesRegex(EvidenceError, "escapes"):
                verify_manifest(path, root)
        with self.evidence_copy() as (root, path):
            self.mutate_manifest(path, lambda m: m["fixtures"][1].__setitem__("name", m["fixtures"][0]["name"]))
            with self.assertRaisesRegex(EvidenceError, "unique and sorted"):
                verify_manifest(path, root)
        with self.evidence_copy() as (root, path):
            original = path.read_text(encoding="utf-8")
            path.write_text(original.replace('{\n  "schemaVersion"', '{\n  "schemaVersion": "1.0.0",\n  "schemaVersion"', 1), encoding="utf-8")
            with self.assertRaisesRegex(EvidenceError, "Duplicate JSON key"):
                verify_manifest(path, root)
        with self.evidence_copy() as (root, path):
            huge = root / "specs/PB-017/huge.txt"
            huge.write_bytes(b"x" * (2 * 1024 * 1024 + 1))
            self.mutate_manifest(path, lambda m: m["fixtures"][0]["pineEvidence"].__setitem__("source", "specs/PB-017/huge.txt"))
            with self.assertRaisesRegex(EvidenceError, "exceeds"):
                verify_manifest(path, root)

    def test_hash_assertion_csv_and_mql5_substitution_are_rejected(self):
        with self.evidence_copy() as (root, path):
            self.mutate_manifest(path, lambda m: m["fixtures"][0].__setitem__("pineFixtureSha256", "0" * 64))
            with self.assertRaisesRegex(EvidenceError, "SHA-256"):
                verify_manifest(path, root)
        with self.evidence_copy() as (root, path):
            manifest = json.loads(path.read_text(encoding="utf-8"))
            item = manifest["fixtures"][0]
            pine = root / item["pineFixture"]
            changed = pine.read_text(encoding="utf-8").replace("expected_sim_balance = array.from(1000.0", "expected_sim_balance = array.from(1001.0", 1)
            pine.write_text(changed, encoding="utf-8", newline="\n")
            item["pineFixtureSha256"] = hashlib.sha256(pine.read_bytes()).hexdigest()
            path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
            with self.assertRaisesRegex(EvidenceError, "Pine expected numeric mismatch"):
                verify_manifest(path, root)
        with self.evidence_copy() as (root, path):
            manifest = json.loads(path.read_text(encoding="utf-8"))
            csv_path = root / manifest["fixtures"][0]["mql5Csv"]
            csv_path.write_text(csv_path.read_text(encoding="utf-8").replace(",100,", ",101,", 1), encoding="utf-8")
            with self.assertRaisesRegex(EvidenceError, "CSV OHLCV mismatch"):
                verify_manifest(path, root)
        with self.evidence_copy() as (root, path):
            manifest = json.loads(path.read_text(encoding="utf-8"))
            log = root / manifest["fixtures"][0]["mql5Log"]
            log.write_text(log.read_text(encoding="utf-8").replace("|balance=1000", "|balance=1001", 1), encoding="utf-8")
            with self.assertRaisesRegex(EvidenceError, "MQL5 evidence mismatch"):
                verify_manifest(path, root)

    def test_pine_runtime_evidence_missing_duplicate_and_value_tamper_fail(self):
        with self.evidence_copy() as (root, path):
            manifest = json.loads(path.read_text(encoding="utf-8"))
            item = next(item for item in manifest["fixtures"] if item["name"] == "hand-next-open")
            source = root / item["pineEvidence"]["source"]
            source.write_text(source.read_text(encoding="utf-8").replace(item["pineEvidence"]["assertionMarker"], "missing", 1), encoding="utf-8")
            with self.assertRaisesRegex(EvidenceError, "completion/assertion"):
                verify_manifest(path, root)
        with self.evidence_copy() as (root, path):
            manifest = json.loads(path.read_text(encoding="utf-8"))
            item = next(item for item in manifest["fixtures"] if item["name"] == "simultaneous-entries")
            source = root / item["pineEvidence"]["source"]
            text = source.read_text(encoding="utf-8")
            source.write_text(text + text, encoding="utf-8")
            with self.assertRaisesRegex(EvidenceError, "duplicate Pine compact"):
                verify_manifest(path, root)
        with self.evidence_copy() as (root, path):
            manifest = json.loads(path.read_text(encoding="utf-8"))
            item = next(item for item in manifest["fixtures"] if item["name"] == "simultaneous-entries")
            source = root / item["pineEvidence"]["source"]
            source.write_text(source.read_text(encoding="utf-8").replace("balance=1000", "balance=1001", 1), encoding="utf-8")
            with self.assertRaisesRegex(EvidenceError, "accounting mismatch"):
                verify_manifest(path, root)
        for old, new, message in [
            ("bar=1,", "bar=7,", "fields/order"),
            ("balance=1000,equity=1000", "balance=1000,balance=1000,equity=1000", "duplicate Pine trace field"),
            (" | DATASET_END: cancelledPending=0; openSide=0", "", "completion/assertion"),
        ]:
            with self.subTest(message=message), self.evidence_copy() as (root, path):
                manifest = json.loads(path.read_text(encoding="utf-8"))
                item = next(item for item in manifest["fixtures"] if item["name"] == "simultaneous-entries")
                source = root / item["pineEvidence"]["source"]
                source.write_text(source.read_text(encoding="utf-8").replace(old, new, 1), encoding="utf-8")
                with self.assertRaisesRegex(EvidenceError, message):
                    verify_manifest(path, root)

    def test_target_manifest_and_completed_runtime_status_are_bound(self):
        with self.evidence_copy() as (root, path):
            manifest = json.loads(path.read_text(encoding="utf-8"))
            target = root / manifest["mql5TargetManifest"]
            data = json.loads(target.read_text(encoding="utf-8"))
            data[0]["runtimeStatus"] = "NOT_RUN"
            target.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(EvidenceError, "MQL5 target manifest"):
                verify_manifest(path, root)
        with self.evidence_copy() as (root, path):
            manifest = json.loads(path.read_text(encoding="utf-8"))
            status = root / manifest["pineRuntimeVerification"]
            data = json.loads(status.read_text(encoding="utf-8"))
            data["featureDoD"] = False
            status.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(EvidenceError, "PB-015 official runtime"):
                verify_manifest(path, root)

    def test_numeric_tolerance_boundary_and_nonfinite_values(self):
        self.assertTrue(numbers_match(Decimal("1.0000000100009"), Decimal("1")))
        self.assertFalse(numbers_match(Decimal("1.000000010002"), Decimal("1")))
        self.assertTrue(numbers_match(None, None))
        self.assertFalse(numbers_match(None, 0))
        for value in ["NaN", "Infinity", "-Infinity"]:
            with self.subTest(value=value), self.assertRaisesRegex(EvidenceError, "Nonfinite"):
                numbers_match(value, 0)


if __name__ == "__main__":
    unittest.main()
