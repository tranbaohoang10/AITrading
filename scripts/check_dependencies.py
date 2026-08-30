"""Query OSV for public Maven dependency coordinates; fail closed on findings/errors.

No source, credentials, prompts or user data is sent. This complements, not
replaces, source review and runtime security tests. Uses Python standard library.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys
from urllib.request import Request, urlopen


def query(payload: dict) -> dict:
    request = Request("https://api.osv.dev/v1/querybatch", data=json.dumps(payload).encode(),
                      headers={"Content-Type": "application/json"}, method="POST")
    with urlopen(request, timeout=45) as response:
        return json.load(response)


def scan(coordinates: list[str]) -> list[dict]:
    findings = []
    for start in range(0, len(coordinates), 100):
        batch = coordinates[start:start + 100]
        queries = []
        for coordinate in batch:
            if not re.fullmatch(r"[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[A-Za-z0-9_.+-]+", coordinate):
                raise ValueError("Invalid dependency coordinate in inventory")
            group, artifact, version = coordinate.split(":")
            queries.append({"package": {"ecosystem": "Maven", "name": f"{group}:{artifact}"}, "version": version})
        active = list(zip(batch, queries))
        seen_pages: set[tuple[str, str]] = set()
        while active:
            response = query({"queries": [item[1] for item in active]})
            if not isinstance(response, dict):
                raise RuntimeError("Invalid OSV response")
            results = response.get("results")
            if not isinstance(results, list) or len(results) != len(active):
                raise RuntimeError("OSV response does not cover all requested dependencies")
            following = []
            for (coordinate, request), result in zip(active, results):
                if not isinstance(result, dict):
                    raise RuntimeError("Invalid OSV package result")
                if "error" in result:
                    raise RuntimeError("OSV returned a per-package query error")
                vulnerabilities = result.get("vulns", [])
                if not isinstance(vulnerabilities, list) or any(
                        not isinstance(item, dict) or not isinstance(item.get("id"), str)
                        or not item["id"] for item in vulnerabilities):
                    raise RuntimeError("Invalid OSV vulnerability list")
                if vulnerabilities:
                    findings.append({"coordinate": coordinate, "vulnerabilities": vulnerabilities})
                token = result.get("next_page_token", "")
                if not isinstance(token, str):
                    raise RuntimeError("Invalid OSV pagination token")
                if token:
                    if (coordinate, token) in seen_pages:
                        raise RuntimeError("OSV pagination repeated; scan incomplete")
                    seen_pages.add((coordinate, token))
                    following.append((coordinate, {**request, "page_token": token}))
            active = following
    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("inventory", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    coordinates = sorted(set(args.inventory.read_text(encoding="utf-8").splitlines()))
    if not coordinates:
        raise RuntimeError("Dependency inventory is empty; cannot certify an empty scan")
    findings = scan(coordinates)
    report = {"checkedAt": datetime.now(timezone.utc).isoformat(), "source": "https://api.osv.dev/v1/querybatch",
              "scope": "resolved Java compile/runtime/test dependencies", "count": len(coordinates),
              "coordinates": coordinates, "findings": findings, "passed": not findings}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"count": len(coordinates), "findings": findings, "passed": not findings}))
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
