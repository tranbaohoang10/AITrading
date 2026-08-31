# PB-003 revision history — Refs #6

| Date | Performer | State | Evidence |
| --- | --- | --- | --- |
| 30/08/2026 | Codex | PROPOSED | Issue #6 created before code after #4/#5 completed; full user/auth/session/CNPM/security/test contract |
| 30/08/2026 | Codex | IMPLEMENTING / PARTIAL LOCAL TESTS | Auth backend and frontend implemented; 19 initial backend tests and40 frontend tests passed. Fixed missing productionRuntimeClasspath lock generation and test access through public Session interface without changing expectations; added strict JSON/HTTPS-cookie/authenticated DB-outage checks. Browser, final regression/audit/CI remain unverified |
| 30/08/2026 | Codex | BROWSER VERIFIED / FINAL REGRESSION | Actual Alpha/Beta account journeys, mobile390x844 and API restart persistence passed; JSON coercion and DB transaction-error bugs fixed. License metadata discrepancy investigated against packaged/upstream Apache licence; final regression and publication recorded separately |
| 31/08/2026 | Codex | LOCAL VERIFICATION REPEATED | Current staged implementation: 22 backend,40 frontend,6 verifier tests PASS; locked builds/lint, npm audit0 and OSV118 no findings. Safe test cluster shutdown verified; commit/push and actual CI follow |
