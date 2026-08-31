# PB-003 tasks — Refs #6

| ID | AC | Paths / work | Verification |
| --- | --- | --- | --- |
| AUTH-TASK-01 | 01,02,05 | backend dependencies/lock, V2 migration, user/session/rate repositories | License/audit, migration, hash/unique/concurrency |
| AUTH-TASK-02 | 02–05 | backend auth API, SecurityConfig, guards, errors/config | HTTP/DB auth/ownership/CSRF/expiry/revocation/rate/body/error tests |
| AUTH-TASK-03 | 06 | frontend auth root/client/account, main.tsx, Vite proxy | Vitest, lint/build; actual two-user browser desktop/mobile |
| AUTH-TASK-04 | all | specs/PB-003, docs architecture/backlog/checkpoint, README | CNPM/test mapping, sanitized evidence, full regression/security/CI |
| AUTH-TASK-05 | 07 | Git/Issue #6 | staged diff/scope/secrets, commit/push/verify CI, close completed, continue PB-004 |

Commands: python scripts/test_backend.py (Java21); scripts/check_dependencies.py;
Python verifier tests; frontend npm lint/build/test/audit; real browser with owned
test DB/API/dev server. No existing user database/service is used for testing.
No changes to old mvp-ui review files or original10 regression test bodies.
