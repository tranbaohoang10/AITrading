# PB-026 revision history

- 02/09/2026: PB-025 completed; Issue #28 created before implementation. Selected
  documentation reconciliation plus one standard-library offline verifier. No
  feature, migration, dependency, provider or official Pine/MQL target rerun.
- 02/09/2026: Reconciled stale aggregate architecture and README target claims;
  added honest capability/setup/limitation matrix, nine-group CNPM index and exact
  V1–V17 SHA ledger. Offline verifier and six negative tests now fail closed on
  incomplete publication, unsafe paths, duplicate/nonfinite JSON, migration
  tamper, secret shapes and nondeterministic reports.
- 02/09/2026: Local readiness PASS: 25 required features, two optional deferred,
  nine CNPM groups, 17 migrations, 26 tables, 61 UI images and zero gaps. Full 58
  Python plus existing verifier/canonical/UI/cross-target regression PASS. Current
  product-source full regression remains 288 backend and 226 frontend PASS from
  PB-025; PB-026 CI will repeat both from a clean checkout before completion.
- 02/09/2026: First source-only archive check exposed line-ending-dependent V10
  hashing. Canonicalized migration bytes to LF and added LF/CRLF plus tamper
  regression. A second archive plus exact staged patch in an isolated Git root
  passed the readiness verifier and all six negative tests without ignored input.
