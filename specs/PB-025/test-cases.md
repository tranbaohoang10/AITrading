# PB-025 test cases — Refs #27

| ID | Case | Expected |
| --- | --- | --- |
| SYS-01 | One owned cross-feature journey | Real API/PG/Python state and hashes agree |
| SYS-02 | Same intent replay | Same message/job/artifact/document; no duplicate notification |
| SYS-03 | API down/up | Down observed; session and every persisted snapshot survive |
| SYS-04 | AI disabled across five entry points | Redacted `AI_UNCONFIGURED`; no assistant/proposal/evaluation/RAG/image fake |
| SYS-05 | User B and wrong expected account | 404/401 without A content |
| SYS-06 | Missing CSRF | Unsafe request denied and state unchanged |
| SYS-07 | Worker/DB failure, timeout and recovery | Existing actual integration tests fail/recover boundedly |
| SYS-08 | Flyway clean/restart | All migrations apply once and validate after restart |
| SYS-09 | Browser desktop/mobile | Real API state, recovery/errors, no overflow or cross-user content |
| SYS-10 | Regression/security/audits | Full suites, dependency and secret/scope checks PASS |
