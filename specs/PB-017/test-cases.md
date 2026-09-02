# PB-017 test cases — Refs #26

| ID | Case | Expected | Actual 02/09/2026 |
| --- | --- | --- | --- |
| T01 | Eight allowlisted fixtures | Python/Pine/MQL5 identity, rows, events, accounting and END PASS | PASS: 8 fixtures, 51 bars, zero unexplained divergence |
| T02 | Pine raw compact full/legacy | Complete unique ordered bars and assertion marker; exact/tolerant match | PASS: 764 retained raw fields compared |
| T03 | Pine assertion-certified evidence | Pinned expected arrays match Python and official complete-trace/assertion markers exist | PASS: 1,359 assertion values; evidence mode reported explicitly |
| T04 | MQL5 actual logs and CSV | Existing strict START/BAR/END verifier PASS; CSV equals Python dataset | PASS: 1,410 actual fields compared |
| T05 | Hash/path/provenance tamper | Wrong fixture/log/CSV/hash, traversal, absolute/outside path fail | PASS: substitutions, hashes, root confinement and target manifests reject closed |
| T06 | Structural tamper | Missing/duplicate/out-of-order bar/field/END/assertion and duplicate JSON key fail | PASS |
| T07 | Numeric boundary/security | tolerance boundary PASS; above boundary, NaN/Infinity/oversize fail | PASS |
| T08 | Determinism | repeated report JSON and Markdown are byte-identical | PASS |
| T09 | Regression/audits | Python/full applicable suites, diff/secret/dependency checks PASS | PASS locally; exact CI is required before Issue completion |

Executable evidence and command receipts are recorded in
`test-evidence/results.md`; deterministic fixture-level details are in
`test-evidence/report.json` and `test-evidence/report.md`.
