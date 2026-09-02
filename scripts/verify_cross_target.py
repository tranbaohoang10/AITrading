"""Fail-closed Python/Pine/MQL5 consistency verifier for PB-017.

Only allowlisted repository evidence is read. This tool does not execute Pine,
MQL5, user code, network requests, brokers or shell commands.
"""
from __future__ import annotations

import argparse
import csv
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
from pathlib import Path
import re
from typing import Any

from verify_mql5_trace import expected_rows, verify as verify_mql5


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "specs/PB-017/evidence-manifest.json"
MAX_MANIFEST = 256 * 1024
MAX_JSON = 2 * 1024 * 1024
MAX_SOURCE = 512 * 1024
MAX_LOG = 2 * 1024 * 1024
MAX_FIXTURES = 8
ABS_TOL = Decimal("1e-8")
REL_TOL = Decimal("1e-12")
NAME_RE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")
HEX64_RE = re.compile(r"[0-9a-f]{64}\Z")

BASE_ARRAYS = {
    "expected_longEntry": ("exact", "longEntry"),
    "expected_shortEntry": ("exact", "shortEntry"),
    "expected_longExit": ("exact", "longExit"),
    "expected_shortExit": ("exact", "shortExit"),
    "expected_sim_balance": ("number", "balance"),
    "expected_sim_equity": ("number", "equity"),
    "expected_sim_side": ("exact", "side"),
    "expected_sim_entrySide": ("exact", "entrySide"),
    "expected_sim_entrySignalBar": ("exact", "entrySignalBar"),
    "expected_sim_entryFill": ("number", "entryFill"),
    "expected_sim_entryCost": ("number", "entryCost"),
    "expected_sim_exitSide": ("exact", "exitSide"),
    "expected_sim_exitSignalBar": ("exact", "exitSignalBar"),
    "expected_sim_exitFill": ("number", "exitFill"),
    "expected_sim_exitCost": ("number", "exitCost"),
    "expected_sim_exitReason": ("exact", "exitReason"),
    "expected_sim_signal": ("exact", "signal"),
    "expected_sim_skipOpen": ("exact", "skipOpen"),
    "expected_sim_skip": ("exact", "skip"),
    "expected_sim_quantity": ("number", "quantity"),
    "expected_sim_closedNet": ("number", "closedNet"),
}

FULL_EXACT_FIELDS = {
    "bar": "index", "signal": "signal", "entry": "entrySide",
    "entrySignalBar": "entrySignalBar", "skipOpen": "skipOpen",
    "skipClose": "skip", "exit": "exitSide", "exitReason": "exitReason",
    "exitSignalBar": "exitSignalBar",
}
FULL_NUMBER_FIELDS = {
    "entryFill": "entryFill", "entryFee": "entryCost", "quantity": "quantity",
    "exitFill": "exitFill", "exitFee": "exitCost", "closedNet": "closedNet",
    "balance": "balance", "equity": "equity",
}


class EvidenceError(ValueError):
    pass


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def strict_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise EvidenceError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json_bytes(data: bytes) -> Any:
    try:
        return json.loads(data.decode("utf-8-sig"), object_pairs_hook=strict_object)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise EvidenceError("Invalid UTF-8 JSON evidence") from exc


def safe_path(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise EvidenceError("Evidence paths must be nonempty repository-relative POSIX paths")
    candidate = Path(relative)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise EvidenceError("Evidence path escapes repository root")
    resolved_root = root.resolve()
    resolved = (resolved_root / candidate).resolve()
    if not resolved.is_relative_to(resolved_root):
        raise EvidenceError("Evidence path escapes repository root")
    return resolved


def read_limited(path: Path, maximum: int) -> bytes:
    if not path.is_file():
        raise EvidenceError(f"Missing evidence file: {path.name}")
    size = path.stat().st_size
    if size > maximum:
        raise EvidenceError(f"Evidence file exceeds {maximum} bytes: {path.name}")
    return path.read_bytes()


def finite_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        number = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise EvidenceError(f"Invalid numeric value: {value}") from exc
    if not number.is_finite():
        raise EvidenceError("Nonfinite numeric evidence")
    return number


def numbers_match(actual: Any, expected: Any) -> bool:
    a, b = finite_decimal(actual), finite_decimal(expected)
    if a is None or b is None:
        return a is None and b is None
    return abs(a - b) <= ABS_TOL + abs(b) * REL_TOL


def parse_pine_value(token: str, kind: str) -> int | Decimal | None:
    token = token.strip()
    if token in {"float(na)", "na"}:
        return None
    if kind == "int":
        if not re.fullmatch(r"-?\d+", token):
            raise EvidenceError("Invalid Pine integer expected value")
        return int(token)
    return finite_decimal(token)


def parse_pine_arrays(source: str) -> dict[str, tuple[str, list[Any]]]:
    pattern = re.compile(
        r"^var array<(int|float)>\s+(expected_[A-Za-z0-9_]+)\s*=\s*array\.from\(([^\r\n]*)\)$",
        re.MULTILINE,
    )
    arrays: dict[str, tuple[str, list[Any]]] = {}
    for kind, name, body in pattern.findall(source):
        if name in arrays:
            raise EvidenceError(f"Duplicate Pine expected array: {name}")
        arrays[name] = (kind, [parse_pine_value(token, kind) for token in body.split(",")])
    if not arrays:
        raise EvidenceError("Pinned Pine fixture has no expected arrays")
    return arrays


def pine_expected_for_array(name: str, fixture: dict[str, Any], rows: list[Any]) -> tuple[str, list[Any]]:
    if name in BASE_ARRAYS:
        category, key = BASE_ARRAYS[name]
        slot = 0 if category == "exact" else 1
        return category, [row[slot][key] for row in rows]
    indicator = re.fullmatch(r"expected_f_at_i(\d+)__0_", name)
    if indicator:
        index = int(indicator.group(1))
        nodes = fixture["request"]["dsl"]["indicators"]
        if index >= len(nodes):
            raise EvidenceError("Pine indicator array index is out of range")
        key = nodes[index]["id"]
        return "number", [bar["indicators"][key] for bar in fixture["reference"]["bars"]]
    pivot = re.fullmatch(r"expected_i(\d+)_x2", name)
    if pivot:
        index = int(pivot.group(1))
        nodes = fixture["request"]["dsl"]["indicators"]
        if index >= len(nodes) or not nodes[index]["type"].startswith("PIVOT_"):
            raise EvidenceError("Unexpected Pine pivot confirmation array")
        key = nodes[index]["id"]
        retained: int | None = None
        values: list[int | None] = []
        for bar in fixture["reference"]["bars"]:
            point = bar["pivotConfirmations"][key]
            if point is not None:
                retained = int(point["originalIndex"])
            values.append(retained)
        return "exact-nullable", values
    raise EvidenceError(f"Unexpected Pine expected array: {name}")


def verify_pine_fixture(source: bytes, expected_sha: str, fixture: dict[str, Any], rows: list[Any]) -> dict[str, Any]:
    if not HEX64_RE.fullmatch(expected_sha) or sha256(source) != expected_sha:
        raise EvidenceError("Pinned Pine fixture SHA-256 mismatch")
    text = source.decode("utf-8")
    dsl_hash = fixture["reference"]["runCard"]["dslHash"]
    if text.count(f"DSL SHA256 {dsl_hash}") != 1:
        raise EvidenceError("Pinned Pine fixture DSL provenance mismatch")
    arrays = parse_pine_arrays(text)
    expected_names = set(BASE_ARRAYS)
    for index, node in enumerate(fixture["request"]["dsl"]["indicators"]):
        expected_names.add(f"expected_f_at_i{index}__0_")
        if node["type"].startswith("PIVOT_"):
            expected_names.add(f"expected_i{index}_x2")
    if set(arrays) != expected_names:
        raise EvidenceError("Missing or unexpected pinned Pine assertion array")
    comparisons = 0
    for name, (kind, actual_values) in arrays.items():
        category, expected_values = pine_expected_for_array(name, fixture, rows)
        if len(actual_values) != len(rows) or len(expected_values) != len(rows):
            raise EvidenceError(f"Pine expected array length mismatch: {name}")
        for index, (actual, expected) in enumerate(zip(actual_values, expected_values)):
            comparisons += 1
            if category == "number":
                if not numbers_match(actual, expected):
                    raise EvidenceError(f"Pine expected numeric mismatch {name}[{index}]")
            else:
                normalized = None if expected is None else int(expected)
                if actual != normalized:
                    raise EvidenceError(f"Pine expected decision mismatch {name}[{index}]")
    return {"assertionArrays": len(arrays), "assertionValues": comparisons, "sha256": expected_sha}


def verify_csv(csv_bytes: bytes, fixture: dict[str, Any]) -> str:
    try:
        text = csv_bytes.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise EvidenceError("MQL5 CSV is not UTF-8") from exc
    reader = csv.DictReader(io.StringIO(text))
    fields = ["timestamp", "open", "high", "low", "close", "volume"]
    if reader.fieldnames != fields:
        raise EvidenceError("MQL5 CSV header mismatch")
    rows = list(reader)
    candles = fixture["request"]["dataset"]["candles"]
    if len(rows) != len(candles):
        raise EvidenceError("MQL5 CSV row count mismatch")
    for index, (row, candle) in enumerate(zip(rows, candles)):
        if row["timestamp"] != candle["timestamp"]:
            raise EvidenceError(f"MQL5 CSV timestamp mismatch row {index}")
        for field in fields[1:]:
            if finite_decimal(row[field]) != finite_decimal(candle[field]):
                raise EvidenceError(f"MQL5 CSV OHLCV mismatch row {index}/{field}")
    return sha256(csv_bytes)


def decode_log(raw: bytes) -> str:
    try:
        return raw.decode("utf-16") if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise EvidenceError("Target log encoding is invalid") from exc


def parse_fields(text: str, separator: str = ",") -> dict[str, str]:
    fields: dict[str, str] = {}
    for token in text.split(separator):
        key, found, value = token.strip().partition("=")
        if not found or not key or key in fields:
            raise EvidenceError("Malformed or duplicate Pine trace field")
        fields[key] = value
    return fields


def expected_time_ms(fixture: dict[str, Any], index: int) -> tuple[int, int]:
    from datetime import datetime
    timestamp = datetime.fromisoformat(fixture["request"]["dataset"]["candles"][index]["timestamp"])
    open_ms = int(timestamp.timestamp() * 1000)
    timeframe = fixture["request"]["dsl"]["market"]["timeframe"]
    match = re.fullmatch(r"(\d+)([mhd])", timeframe)
    if not match:
        raise EvidenceError("Unsupported evidence timeframe")
    multiplier = {"m": 60_000, "h": 3_600_000, "d": 86_400_000}[match.group(2)]
    return open_ms, open_ms + int(match.group(1)) * multiplier


def compare_full_trace(prefix: str, source: str, fixture: dict[str, Any], rows: list[Any]) -> dict[str, Any]:
    if source.count(prefix) != 1:
        raise EvidenceError("Missing or duplicate Pine compact trace")
    line = source[source.index(prefix):].splitlines()[0]
    segments = [segment.strip() for segment in line[len(prefix):].split(" | ")]
    bar_segments = [segment for segment in segments if segment.startswith("bar=")]
    if len(bar_segments) != len(rows):
        raise EvidenceError("Pine compact trace bar count mismatch")
    required = set(FULL_EXACT_FIELDS) | set(FULL_NUMBER_FIELDS) | {"openMs", "closeMs"}
    comparisons = 0
    for index, segment in enumerate(bar_segments):
        fields = parse_fields(segment)
        if set(fields) != required or int(fields["bar"]) != index:
            raise EvidenceError("Pine compact trace fields/order mismatch")
        exact, numbers = rows[index]
        for field, key in FULL_EXACT_FIELDS.items():
            expected = index if key == "index" else exact[key]
            comparisons += 1
            if fields[field] != str(expected):
                raise EvidenceError(f"Pine event mismatch bar{index}/{field}")
        for field, key in FULL_NUMBER_FIELDS.items():
            comparisons += 1
            actual = None if fields[field] == "null" else fields[field]
            if not numbers_match(actual, numbers[key]):
                raise EvidenceError(f"Pine accounting mismatch bar{index}/{field}")
        open_ms, close_ms = expected_time_ms(fixture, index)
        comparisons += 2
        if fields["openMs"] != str(open_ms) or fields["closeMs"] != str(close_ms):
            raise EvidenceError(f"Pine time mismatch bar{index}")
    end = next((segment for segment in segments if segment.startswith("DATASET_END:")), None)
    if end is None or segments.count("ASSERTIONS=PASS") != 1:
        raise EvidenceError("Pine compact completion/assertion missing")
    match = re.fullmatch(r"DATASET_END:\s*cancelledPending=(-?\d+);\s*openSide=(-?\d+)", end)
    if not match or match.groups() != (str(rows[-1][0]["signal"]), str(rows[-1][0]["side"])):
        raise EvidenceError("Pine compact dataset-end mismatch")
    return {"mode": "RAW_COMPACT", "bars": len(rows), "rawFieldComparisons": comparisons + 2}


def compare_legacy_trace(prefix: str, source: str, rows: list[Any]) -> dict[str, Any]:
    if source.count(prefix) != 1:
        raise EvidenceError("Missing or duplicate legacy Pine compact trace")
    line = source[source.index(prefix):].splitlines()[0]
    body = line[len(prefix):]
    bar_parts = [part.strip() for part in body.split("|") if part.strip().startswith("b=")]
    if len(bar_parts) != len(rows):
        raise EvidenceError("Legacy Pine compact bar count mismatch")
    exact_map = {"b": None, "sig": "signal", "entry": "entrySide", "exit": "exitSide", "reason": "exitReason"}
    number_map = {"entryFill": "entryFill", "exitFill": "exitFill", "net": "closedNet", "bal": "balance", "eq": "equity"}
    comparisons = 0
    for index, part in enumerate(bar_parts):
        fields = parse_fields(part)
        if set(fields) != set(exact_map) | set(number_map):
            raise EvidenceError("Legacy Pine compact fields mismatch")
        exact, numbers = rows[index]
        for field, key in exact_map.items():
            expected = index if key is None else exact[key]
            comparisons += 1
            if fields[field] != str(expected):
                raise EvidenceError(f"Legacy Pine event mismatch bar{index}/{field}")
        for field, key in number_map.items():
            comparisons += 1
            actual = None if fields[field] == "null" else fields[field]
            if not numbers_match(actual, numbers[key]):
                raise EvidenceError(f"Legacy Pine accounting mismatch bar{index}/{field}")
    match = re.search(r"DATASET_END:\s*cancelledPending=(-?\d+);\s*openSide=(-?\d+);ASSERTIONS=PASS", body)
    if not match or match.groups() != (str(rows[-1][0]["signal"]), str(rows[-1][0]["side"])):
        raise EvidenceError("Legacy Pine completion/assertion mismatch")
    return {"mode": "RAW_LEGACY_COMPACT", "bars": len(rows), "rawFieldComparisons": comparisons + 2}


def verify_pine_evidence(config: dict[str, Any], source: str, fixture: dict[str, Any], rows: list[Any]) -> dict[str, Any]:
    mode = config.get("mode")
    if mode == "compact-trace":
        return compare_full_trace(config.get("prefix", ""), source, fixture, rows)
    if mode == "legacy-compact-trace":
        return compare_legacy_trace(config.get("prefix", ""), source, rows)
    if mode == "assertion-certified":
        complete = config.get("completeMarker")
        assertion = config.get("assertionMarker")
        if not isinstance(complete, str) or not isinstance(assertion, str):
            raise EvidenceError("Assertion-certified markers are required")
        if source.count(complete) != 1 or source.count(assertion) != 1:
            raise EvidenceError("Official Pine completion/assertion evidence missing or ambiguous")
        return {"mode": "ASSERTION_CERTIFIED_RUNTIME", "bars": len(rows), "rawFieldComparisons": 0}
    raise EvidenceError("Unsupported Pine evidence mode")


def validate_manifest_shape(manifest: Any) -> list[dict[str, Any]]:
    keys = {"schemaVersion", "numericTolerance", "fixtures", "pineTargetManifest",
            "pineRuntimeVerification", "mql5TargetManifest", "mql5RuntimeVerification"}
    if not isinstance(manifest, dict) or set(manifest) != keys:
        raise EvidenceError("Manifest shape mismatch")
    if manifest["schemaVersion"] != "1.0.0" or manifest["numericTolerance"] != {"absolute": "1e-8", "relative": "1e-12"}:
        raise EvidenceError("Manifest version/tolerance mismatch")
    fixtures = manifest["fixtures"]
    if not isinstance(fixtures, list) or len(fixtures) != MAX_FIXTURES:
        raise EvidenceError("Manifest must contain exactly eight fixtures")
    names = [item.get("name") for item in fixtures if isinstance(item, dict)]
    if len(names) != MAX_FIXTURES or len(set(names)) != MAX_FIXTURES or names != sorted(names):
        raise EvidenceError("Fixture names must be unique and sorted")
    if any(not isinstance(name, str) or not NAME_RE.fullmatch(name) for name in names):
        raise EvidenceError("Invalid fixture name")
    return fixtures


def verify_fixture(root: Path, item: dict[str, Any]) -> dict[str, Any]:
    required = {"name", "python", "pineFixture", "pineFixtureSha256", "pineEvidence", "mql5Csv", "mql5Log"}
    if set(item) != required or not isinstance(item["pineEvidence"], dict):
        raise EvidenceError("Fixture manifest shape mismatch")
    name = item["name"]
    for key, suffix in [("python", ".json"), ("pineFixture", ".pine"),
                        ("mql5Csv", ".csv"), ("mql5Log", ".log")]:
        if Path(item[key]).name != name + suffix:
            raise EvidenceError(f"Fixture name/path binding mismatch: {key}")
    evidence_keys = set(item["pineEvidence"])
    mode = item["pineEvidence"].get("mode")
    expected_evidence_keys = ({"mode", "source", "prefix"} if mode in {"compact-trace", "legacy-compact-trace"}
                              else {"mode", "source", "completeMarker", "assertionMarker"})
    if evidence_keys != expected_evidence_keys:
        raise EvidenceError("Pine evidence manifest shape mismatch")
    python_raw = read_limited(safe_path(root, item["python"]), MAX_JSON)
    fixture = load_json_bytes(python_raw)
    if fixture.get("targetStatus") != "NOT_RUN_OFFICIAL_PINE_REQUIRES_LOGIN":
        raise EvidenceError("Unexpected immutable Python fixture status")
    if fixture["request"]["dataset"]["sourceType"] != "SYNTHETIC":
        raise EvidenceError("Only synthetic evidence is allowed")
    rows = expected_rows(fixture)
    if len(rows) != len(fixture["reference"]["bars"]):
        raise EvidenceError("Python expected row count mismatch")

    pine_raw = read_limited(safe_path(root, item["pineFixture"]), MAX_SOURCE)
    pine_structure = verify_pine_fixture(pine_raw, item["pineFixtureSha256"], fixture, rows)
    pine_evidence_raw = read_limited(safe_path(root, item["pineEvidence"].get("source", "")), MAX_LOG)
    try:
        pine_evidence_text = pine_evidence_raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise EvidenceError("Pine evidence is not UTF-8") from exc
    pine_runtime = verify_pine_evidence(item["pineEvidence"], pine_evidence_text, fixture, rows)

    csv_raw = read_limited(safe_path(root, item["mql5Csv"]), MAX_SOURCE)
    csv_hash = verify_csv(csv_raw, fixture)
    mql_raw = read_limited(safe_path(root, item["mql5Log"]), MAX_LOG)
    mql_text = decode_log(mql_raw)
    try:
        mql_result = verify_mql5(fixture, mql_text)
    except (ValueError, KeyError, InvalidOperation) as exc:
        raise EvidenceError(f"MQL5 evidence mismatch for {name}: {exc}") from exc
    mql_lines = re.findall(r"AITRADING_BAR\|([^\r\n]+)", mql_text)
    mql_fields = sum(len(line.split("|")) - 1 for line in mql_lines)

    run_card = fixture["reference"]["runCard"]
    return {
        "name": name,
        "status": "PASS",
        "bars": len(rows),
        "symbol": fixture["request"]["dataset"]["symbol"],
        "timeframe": fixture["request"]["dataset"]["timeframe"],
        "dslHash": run_card["dslHash"],
        "dataHash": run_card["dataset"]["dataHash"],
        "pythonResultHash": fixture["reference"]["resultHash"],
        "pineFixtureSha256": pine_structure["sha256"],
        "pineAssertionArrays": pine_structure["assertionArrays"],
        "pineAssertionValuesCompared": pine_structure["assertionValues"],
        "pineEvidenceMode": pine_runtime["mode"],
        "pineRawFieldComparisons": pine_runtime["rawFieldComparisons"],
        "mql5CsvSha256": csv_hash,
        "mql5LogSha256": sha256(mql_raw),
        "mql5ActualFieldsCompared": mql_fields,
        "mql5Comparison": mql_result["comparison"],
        "unexplainedDivergences": 0,
    }


def verify_target_provenance(root: Path, manifest: dict[str, Any], results: list[dict[str, Any]]) -> dict[str, Any]:
    def load(relative: str, maximum: int = MAX_JSON):
        return load_json_bytes(read_limited(safe_path(root, relative), maximum))

    pine_manifest = load(manifest["pineTargetManifest"])
    mql_manifest = load(manifest["mql5TargetManifest"])
    pine_runtime = load(manifest["pineRuntimeVerification"])
    mql_runtime = load(manifest["mql5RuntimeVerification"])
    if not isinstance(pine_manifest, list) or not isinstance(mql_manifest, list):
        raise EvidenceError("Target manifest must be a list")
    pine_by_name = {item.get("name"): item for item in pine_manifest if isinstance(item, dict)}
    mql_by_name = {item.get("name"): item for item in mql_manifest if isinstance(item, dict)}
    names = {item["name"] for item in results}
    if set(pine_by_name) != names or set(mql_by_name) != names or len(pine_by_name) != MAX_FIXTURES or len(mql_by_name) != MAX_FIXTURES:
        raise EvidenceError("Target manifest fixture set mismatch")
    for result in results:
        pine = pine_by_name[result["name"]]
        mql = mql_by_name[result["name"]]
        if pine.get("dslHash") != result["dslHash"] or pine.get("targetFixtureHash") != result["pineFixtureSha256"] or pine.get("bars") != result["bars"]:
            raise EvidenceError("Pine target manifest provenance mismatch")
        if mql != {"name": result["name"], "symbol": result["symbol"],
                   "timeframe": result["timeframe"], "runtimeStatus": "PASS"}:
            raise EvidenceError("MQL5 target manifest provenance/status mismatch")
    official_pine = pine_runtime.get("officialPine", {})
    if pine_runtime.get("featureDoD") is not True or official_pine.get("status") != "PASS" or official_pine.get("fixtures") != 8 or official_pine.get("completeTraces") != 8:
        raise EvidenceError("PB-015 official runtime verification is incomplete")
    if mql_runtime.get("featureDoD") is not True or mql_runtime.get("officialRuntime") != "PASS":
        raise EvidenceError("PB-016 official runtime verification is incomplete")
    return {
        "pineFixtures": len(pine_by_name), "pineOfficialRuntime": "PASS",
        "mql5Fixtures": len(mql_by_name), "mql5OfficialRuntime": "PASS",
    }


def verify_manifest(manifest_path: Path = DEFAULT_MANIFEST, root: Path = ROOT) -> dict[str, Any]:
    resolved_root = root.resolve()
    resolved_manifest = manifest_path.resolve()
    if not resolved_manifest.is_relative_to(resolved_root):
        raise EvidenceError("Manifest must be inside repository root")
    manifest = load_json_bytes(read_limited(resolved_manifest, MAX_MANIFEST))
    fixtures = validate_manifest_shape(manifest)
    results = [verify_fixture(resolved_root, item) for item in fixtures]
    target_provenance = verify_target_provenance(resolved_root, manifest, results)
    if any(item["status"] != "PASS" or item["unexplainedDivergences"] for item in results):
        raise EvidenceError("Cross-target comparison did not pass")
    return {
        "schemaVersion": "1.0.0",
        "status": "PASS",
        "scope": "eight synthetic Python/Pine/MQL5 fixtures; no target execution",
        "numericTolerance": {"absolute": "1e-8", "relative": "1e-12"},
        "fixtures": results,
        "targetProvenance": target_provenance,
        "summary": {
            "fixtures": len(results),
            "bars": sum(item["bars"] for item in results),
            "pineAssertionValuesCompared": sum(item["pineAssertionValuesCompared"] for item in results),
            "pineRawFieldComparisons": sum(item["pineRawFieldComparisons"] for item in results),
            "mql5ActualFieldsCompared": sum(item["mql5ActualFieldsCompared"] for item in results),
            "unexplainedDivergences": 0,
        },
        "limitations": [
            "Pine uses binary floats while Python uses Decimal34; declared tolerance applies only to numeric fields.",
            "Two early Pine runs retain official complete-trace plus assertion certification rather than raw copied log bytes.",
            "Research simulators do not certify broker fills, ticks, margin, liquidation, funding or future profit.",
        ],
    }


def markdown_report(report: dict[str, Any]) -> str:
    lines = [
        "# PB-017 cross-target consistency report",
        "",
        f"Status: **{report['status']}**. Numeric tolerance: absolute `{ABS_TOL}` + relative `{REL_TOL}`.",
        "",
        "| Fixture | Bars | Pine evidence | Pine asserted | Pine raw | MQL5 actual | Result |",
        "| --- | ---: | --- | ---: | ---: | ---: | --- |",
    ]
    for item in report["fixtures"]:
        lines.append(
            f"| {item['name']} | {item['bars']} | {item['pineEvidenceMode']} | "
            f"{item['pineAssertionValuesCompared']} | {item['pineRawFieldComparisons']} | "
            f"{item['mql5ActualFieldsCompared']} | {item['status']} |"
        )
    summary = report["summary"]
    lines += [
        "",
        f"Totals: {summary['fixtures']} fixtures / {summary['bars']} bars; "
        f"{summary['pineAssertionValuesCompared']} Pine assertion values, "
        f"{summary['pineRawFieldComparisons']} retained Pine raw fields and "
        f"{summary['mql5ActualFieldsCompared']} MQL5 actual fields compared; "
        f"unexplained divergences: {summary['unexplainedDivergences']}.",
        "",
        "## Limitations",
        "",
    ]
    lines.extend(f"- {item}" for item in report["limitations"])
    return "\n".join(lines) + "\n"


def safe_output(root: Path, relative: str, content: str) -> None:
    path = safe_path(root, relative)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--json-out")
    parser.add_argument("--markdown-out")
    args = parser.parse_args()
    report = verify_manifest(args.manifest)
    json_text = json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    if args.json_out:
        safe_output(ROOT, args.json_out, json_text)
    if args.markdown_out:
        safe_output(ROOT, args.markdown_out, markdown_report(report))
    print(json.dumps(report["summary"], sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
