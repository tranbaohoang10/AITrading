# PB-025 revision history

- 02/09/2026: Issue #27 created before code. Selected a standard-library owned
  HTTP orchestration layer over the existing disposable PostgreSQL/API/Python
  harness; no migration, dependency, external target or product redesign.
- 02/09/2026: Actual system smoke PASS across chat, Strategy DSL, dataset, Python
  backtest, journal, Pine/MQL artifacts, document, notification and audit with
  five AI-unconfigured boundaries, two-user isolation, idempotency and restart.
  Actual desktop/mobile UI also PASSed explicit unavailable/retry recovery.
- 02/09/2026: Full regression initially exposed two late-suite mutations from
  cached Spring contexts whose schedulers shared the disposable database. Added
  a production-default-on retention scheduler property and disabled backtest and
  retention schedulers only for Gradle tests. The fresh full rerun passed 288/288;
  product scheduling remains enabled when the properties are absent.
- 02/09/2026: Local AC/DoD evidence PASS: 288 backend, 226 frontend and 52
  Python tests; verifier/canonical/UI fixtures, build/lint, cross-target regression,
  npm/OSV audits, browser restart/recovery and scope/secret review all PASS.
  Publication, exact GitHub SHA, CI and Issue completion remain pending.
- 02/09/2026: Published feature commit `6b82af8f820403041da57a3c149c082a257a9669`
  by fast-forward push. Local/origin/GitHub main matched exactly; required CI
  33585991238 succeeded; final evidence was posted and Issue #27 was closed as
  completed. PB-025 is DONE and PB-026 is READY.
