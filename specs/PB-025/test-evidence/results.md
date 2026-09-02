# PB-025 local verification results — Refs #27

Date: 02/09/2026 Asia/Ho_Chi_Minh. All data and identities were synthetic. The
official Pine and MQL5 targets were not rerun because PB-015/PB-016 evidence is
already complete and PB-025 did not change either target runtime.

## Actual integrated journey

- `py -3 scripts/smoke_system.py --owned tmp/pg-test-4bmb9a7l --report
  specs/PB-025/test-evidence/system-smoke.json`: PASS over actual loopback HTTP,
  Spring API, PostgreSQL 17 and Python worker.
- One account-to-chat-to-validated-DSL-to-dataset-to-backtest-to-journal-to-
  export/document/notification/audit journey persisted exact provenance and
  hashes through an observed API down/up.
- Five AI-unconfigured entry points returned `AI_UNCONFIGURED`; no assistant,
  proposal, evaluation, RAG answer or image result was invented.
- Two-user ownership, expected-account binding, missing CSRF, idempotent replay
  and one terminal notification all failed closed or remained singular as required.
- The owned API/PostgreSQL/Vite processes were stopped, the generated database
  password file was removed, and no external target/provider/broker was contacted.
- Actual browser desktop/mobile and restart evidence is recorded separately in
  `browser-results.md`; the machine-readable journey is `system-smoke.json`.

## Regression and security

| Command/check | Actual result |
| --- | --- |
| `py -3 scripts/test_backend.py` | PASS; Gradle clean/test/bootJar/dependencyInventory; 31 suites, 288 tests, 0 failures/errors/skips; owned cluster stopped and credential removed |
| `py -3 -m unittest discover -s python/tests -v` | PASS; 52 tests |
| `py -3 scripts/test_verification_tools.py` | PASS; 6 tests |
| `py -3 scripts/check_dsl_fixtures.py` | PASS; 6 canonical Decimal/UTF-8 fixtures |
| `py -3 scripts/backtest_ui_fixtures.py --check` | PASS; 6 hand-checked UI fixtures |
| `py -3 scripts/verify_cross_target.py` | PASS; 8 fixtures, 51 bars, 1,359 Pine assertion values, 764 retained Pine raw fields, 1,410 MQL5 actual fields, 0 unexplained divergences |
| `py -3 -m compileall -q python scripts` | PASS |
| `npm test` | PASS; 30 files, 226 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS; TypeScript and Vite production build |
| `npm audit --audit-level=high` | PASS; 0 vulnerabilities |
| `py -3 scripts/check_dependencies.py ...` | PASS; 121 Java coordinates, 0 OSV findings |

The first backend regression run failed two late assertions because scheduled
work from cached Spring test contexts mutated fixtures in the shared disposable
database after 60 seconds. No assertion was weakened. Tests now disable only the
backtest and retention schedulers through test system properties; both production
schedulers remain default-on. The complete 288-test rerun passed.

## Scope and limitations

The change adds one bounded standard-library smoke, two boundary unit tests,
CNPM/evidence, and test-only scheduler isolation plus configurable default-on
retention scheduling. No dependency, migration, fixed-stack, product API, broker,
live-trading, Pine or MQL5 semantic change was introduced. Secret-pattern review
found only generated synthetic credentials and CSRF handling; reports contain no
password, cookie, token, provider key, private account data or browser artifact.

Local AC-01 through AC-07 and the local portion of AC-08 PASS. Commit/push, exact
GitHub SHA, required CI success and explicit Issue completion remain pending.
