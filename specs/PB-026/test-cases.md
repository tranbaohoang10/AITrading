# PB-026 test cases — Refs #28

| ID | Case | Expected |
| --- | --- | --- |
| RDY-01 | Current repository readiness verification | All required PB rows, Issue links, CNPM paths and migration hashes PASS |
| RDY-02 | Duplicate/malformed manifest JSON | Reject before accepting any hash |
| RDY-03 | Missing, duplicate or out-of-order PB row | Fail closed with bounded diagnostic |
| RDY-04 | DONE without Issue/publication evidence | Reject; no readiness claim |
| RDY-05 | Traversal, absolute path, symlink or oversized file | Reject without reading outside root |
| RDY-06 | Missing/tampered/extra migration | Reject exact name/SHA ledger mismatch |
| RDY-07 | Stale forbidden architecture/README claims | Reject known superseded completion text |
| RDY-08 | Secret/private-key shape or tracked `.env` | Reject and report only path/category, never value |
| RDY-09 | Deterministic report | Repeated JSON/Markdown bytes match exactly |
| RDY-10 | Final regression/security/dependencies | Backend/frontend/Python/verifiers/build/lint/npm/OSV PASS |
| RDY-11 | Isolated source-only verification | No ignored/untracked input required; services/credentials cleaned |
| RDY-12 | Publication | Exact local/origin/GitHub SHA and required CI SUCCESS before close |
