# PB-015 tasks — Refs #17

- [x] Inspect delivered backlog/source, official target semantics and access.
- [x] Create Issue17 before code; record scope/CNPM/security/test design.
- [x] Implement bounded generator, immutable owned artifact API and migration.
- [x] Add generator/HTTP/PostgreSQL security/concurrency tests and event fixtures.
- [x] Replace authenticated Pine mock with real export view and frontend tests.
- [x] Run real browser, persistence/restart, regression/build/lint/security audits.
- [x] Run official Pine compiler/runtime against synthetic event fixtures.
- [x] Inspect scope/diff, commit/push main, verify exact SHA and CI.
- [ ] Complete Issue only if all AC/DoD pass; otherwise preserve exact blocker and continue independent READY work.

Current regression:288 backend,226 frontend,44 Python,6 verifier,6 canonical and6
UI fixtures PASS; lint/build/JavaOSV121/npm0 PASS. Official Pine compile/update and
all eight complete synthetic event/accounting traces PASS; exact target evidence is
under `test-evidence/official-traces`. Publication SHA/CI remains before completion.

31/08/2026 publication verified60964d5714b74f2580f896fa7654503dfd8d5b85;
CI33382521115 SUCCESS, downloaded152backend/176frontend/42Python and JavaOSV118.
Issue17 kept OPEN/BLOCKED, comment5477092546; continued independent PB-016/#18.
