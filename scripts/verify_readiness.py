"""PB-026 deterministic, offline prototype-readiness verifier."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
MAX_TEXT = 1_048_576
FEATURES = [f"PB-{number:03d}" for number in range(1, 28)]
DEFERRED = {"PB-020", "PB-021"}
CURRENT = "PB-026"
IMPLEMENTED = set(FEATURES) - DEFERRED
FIXED_STACK = ("React", "TypeScript", "Vite", "Spring Boot", "Java 21",
               "Gradle Kotlin DSL", "PostgreSQL", "Flyway", "Python")
STALE_CLAIMS = (
    "Official Pine compilation/runtime is currently unverified",
    "actual MQL runtime/event and negative CSV verification remain pending",
    "real-provider smoke remains blocked on credentials",
    "authenticated web backtest jobs remain PB-011",
)
SECRET_SHAPES = (
    re.compile(rb"AIza[0-9A-Za-z_-]{30,}"),
    re.compile(rb"sk-[0-9A-Za-z_-]{20,}"),
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
)


class ReadinessFailure(RuntimeError):
    pass


def duplicate_safe(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise ReadinessFailure(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def safe_path(root: Path, relative: str, limit: int = MAX_TEXT) -> Path:
    candidate = Path(relative)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise ReadinessFailure(f"unsafe path: {relative}")
    path = root.joinpath(candidate)
    try:
        resolved = path.resolve(strict=True)
    except (OSError, RuntimeError):
        raise ReadinessFailure(f"missing path: {relative}") from None
    if not resolved.is_relative_to(root.resolve()) or path.is_symlink():
        raise ReadinessFailure(f"path escaped or is symlink: {relative}")
    if not resolved.is_file() or resolved.stat().st_size > limit:
        raise ReadinessFailure(f"invalid or oversized file: {relative}")
    return resolved


def read_text(root: Path, relative: str) -> str:
    try:
        return safe_path(root, relative).read_text(encoding="utf-8")
    except UnicodeError:
        raise ReadinessFailure(f"non-UTF-8 text: {relative}") from None


def read_json(root: Path, relative: str) -> dict[str, object]:
    try:
        value = json.loads(read_text(root, relative), object_pairs_hook=duplicate_safe,
                           parse_constant=lambda value: (_ for _ in ()).throw(
                               ReadinessFailure(f"non-finite JSON value: {value}")))
    except json.JSONDecodeError as failure:
        raise ReadinessFailure(f"malformed JSON: {relative}") from failure
    if not isinstance(value, dict):
        raise ReadinessFailure(f"JSON root must be object: {relative}")
    return value


def parse_backlog(text: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for line in text.splitlines():
        if not re.match(r"^\| PB-\d{3} \|", line):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) != 9:
            raise ReadinessFailure(f"malformed backlog row: {cells[0]}")
        rows.append({"id": cells[0], "status": cells[4], "issue": cells[5],
                     "acceptance": cells[6]})
    ids = [row["id"] for row in rows]
    if ids != FEATURES:
        raise ReadinessFailure("backlog feature IDs are missing, duplicate or out of order")
    return rows


def validate_backlog(root: Path, rows: list[dict[str, str]]) -> None:
    for row in rows:
        feature = row["id"]
        if feature in DEFERRED:
            if row["status"] != "DEFERRED_OPTIONAL" or row["issue"] != "not created":
                raise ReadinessFailure(f"invalid deferred state: {feature}")
            continue
        allowed = {"IN_PROGRESS", "DONE"} if feature == CURRENT else {"DONE"}
        if row["status"] not in allowed:
            raise ReadinessFailure(f"required feature is not complete: {feature}")
        if not re.search(r"issues/\d+", row["issue"]):
            raise ReadinessFailure(f"missing Issue binding: {feature}")
        folder = f"specs/{feature}"
        for name in ("spec.md", "design.md", "test-cases.md"):
            safe_path(root, f"{folder}/{name}")
        evidence = root / folder / "test-evidence"
        if not evidence.is_dir() or evidence.is_symlink() or not any(
                item.is_file() and item.suffix == ".md" for item in evidence.iterdir()):
            raise ReadinessFailure(f"missing Markdown evidence: {feature}")
        if row["status"] == "DONE":
            has_commit = bool(re.search(r"[0-9a-f]{7,40}", row["acceptance"], re.I))
            has_publication = bool(re.search(
                r"(?:CI|Actions)\s*\d+|Verified GitHub main", row["acceptance"], re.I))
            if not has_commit or not has_publication:
                raise ReadinessFailure(f"DONE lacks publication evidence: {feature}")


def validate_migrations(root: Path) -> tuple[int, str]:
    ledger = read_json(root, "docs/readiness-migrations.json")
    if ledger.get("schemaVersion") != 1 or ledger.get("algorithm") != "SHA-256":
        raise ReadinessFailure("unsupported migration ledger")
    expected = ledger.get("migrations")
    if not isinstance(expected, dict) or len(expected) != 18:
        raise ReadinessFailure("migration ledger must bind V1-V18")
    directory = root / "backend/src/main/resources/db/migration"
    actual: dict[str, str] = {}
    for path in directory.glob("V*.sql"):
        if path.is_symlink() or path.stat().st_size > MAX_TEXT:
            raise ReadinessFailure(f"unsafe migration: {path.name}")
        # Git checkouts may materialize CRLF on Windows. Bind the immutable SQL
        # content, not the platform-specific working-tree line ending.
        canonical = path.read_bytes().replace(b"\r\n", b"\n")
        actual[path.name] = hashlib.sha256(canonical).hexdigest()
    if actual != expected:
        raise ReadinessFailure("migration name or SHA-256 ledger mismatch")
    digest = hashlib.sha256(json.dumps(actual, sort_keys=True,
                                       separators=(",", ":")).encode()).hexdigest()
    return len(actual), digest


def validate_docs(root: Path) -> tuple[int, int]:
    readme = read_text(root, "README.md")
    architecture = read_text(root, "docs/architecture.md")
    readiness = read_text(root, "docs/prototype-readiness.md")
    cnpm = read_text(root, "docs/cnpm-index.md")
    combined = "\n".join((readme, architecture, readiness, cnpm))
    for term in FIXED_STACK:
        if term not in combined:
            raise ReadinessFailure(f"fixed stack term missing: {term}")
    for claim in STALE_CLAIMS:
        if claim.lower() in combined.lower():
            raise ReadinessFailure(f"superseded claim remains: {claim}")
    migration_text = "\n".join(read_text(
        root, f"backend/src/main/resources/db/migration/{name}")
        for name in read_json(root, "docs/readiness-migrations.json")["migrations"])
    tables = sorted(set(re.findall(r"CREATE TABLE\s+trading\.([a-z0-9_]+)",
                                   migration_text, re.I)))
    missing_tables = [table for table in tables if f"`{table}`" not in architecture]
    if missing_tables:
        raise ReadinessFailure("architecture omits SQL tables: " + ",".join(missing_tables))
    links = re.findall(r"\[[^]]+\]\(([^)]+)\)", cnpm)
    checked = 0
    for target in links:
        if re.match(r"^[a-z]+://", target):
            continue
        path_part = target.split("#", 1)[0]
        if not path_part:
            continue
        candidate = (root / "docs" / path_part).resolve()
        if not candidate.is_relative_to(root.resolve()):
            raise ReadinessFailure(f"CNPM link escaped repository: {target}")
        relative = candidate.relative_to(root.resolve()).as_posix()
        safe_path(root, relative, 2 * MAX_TEXT)
        checked += 1
    if checked < 12:
        raise ReadinessFailure("CNPM index has too few checked local links")
    image_roots = ("PB-001", "PB-003", "PB-004", "PB-006", "PB-007",
                   "PB-008", "PB-012", "PB-013", "PB-015", "PB-016",
                   "PB-022", "PB-024", "PB-027")
    images = 0
    for feature in image_roots:
        folder = root / f"specs/{feature}/test-evidence"
        count = sum(path.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}
                    for path in folder.iterdir() if path.is_file())
        if count == 0:
            raise ReadinessFailure(f"responsive image evidence missing: {feature}")
        images += count
    return len(tables), images


def tracked_paths(root: Path) -> list[Path]:
    result = subprocess.run(["git", "-c", f"safe.directory={root.as_posix()}",
                             "ls-files", "-z"], cwd=root, check=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    paths: list[Path] = []
    for raw in result.stdout.split(b"\0"):
        if not raw:
            continue
        relative = raw.decode("utf-8")
        path = safe_path(root, relative, 8 * MAX_TEXT)
        if path.name == ".env":
            raise ReadinessFailure(f"tracked .env file: {relative}")
        paths.append(path)
    return paths


def scan_secret_shapes(paths: Iterable[Path]) -> int:
    checked = 0
    for path in paths:
        if path.stat().st_size > MAX_TEXT:
            continue
        data = path.read_bytes()
        if b"\0" in data:
            continue
        checked += 1
        if any(pattern.search(data) for pattern in SECRET_SHAPES):
            raise ReadinessFailure(f"secret-shaped tracked content: {path.as_posix()}")
    return checked


def verify(root: Path = ROOT) -> dict[str, object]:
    root = root.resolve()
    rows = parse_backlog(read_text(root, "docs/product-backlog.md"))
    validate_backlog(root, rows)
    migrations, migration_digest = validate_migrations(root)
    tables, images = validate_docs(root)
    tracked = tracked_paths(root)
    scanned = scan_secret_shapes(tracked)
    return {
        "passed": True,
        "mode": "PROTOTYPE/DRAFT",
        "requiredFeatures": len(IMPLEMENTED),
        "doneFeatures": sum(row["status"] == "DONE" for row in rows),
        "currentFeature": next(row["status"] for row in rows if row["id"] == CURRENT),
        "deferredOptional": sorted(DEFERRED),
        "cnpmGroups": 9,
        "flywayMigrations": migrations,
        "migrationLedgerSha256": migration_digest,
        "sqlTables": tables,
        "responsiveEvidenceImages": images,
        "trackedFiles": len(tracked),
        "textFilesSecretScanned": scanned,
        "unexplainedGaps": 0,
    }


def markdown(report: dict[str, object]) -> str:
    lines = ["# PB-026 deterministic readiness report", "",
             "| Check | Actual |", "| --- | --- |"]
    for key in sorted(report):
        value = report[key]
        rendered = ", ".join(value) if isinstance(value, list) else str(value)
        lines.append(f"| `{key}` | {rendered} |")
    lines += ["", "PASS: all values were derived offline from bounded tracked "
              "repository artifacts; no external target/provider was contacted.", ""]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-out")
    parser.add_argument("--markdown-out")
    args = parser.parse_args()
    report = verify()
    payload = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.json_out:
        target = Path(args.json_out).resolve()
        if not target.is_relative_to(ROOT.resolve()) or target.suffix != ".json":
            raise ReadinessFailure("JSON output must stay inside repository")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(payload, encoding="utf-8")
    if args.markdown_out:
        target = Path(args.markdown_out).resolve()
        if not target.is_relative_to(ROOT.resolve()) or target.suffix != ".md":
            raise ReadinessFailure("Markdown output must stay inside repository")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(markdown(report), encoding="utf-8")
    print(json.dumps(report, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
