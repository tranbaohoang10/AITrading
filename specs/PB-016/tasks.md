# PB-016 tasks — Refs #18

- [x] Inspect READY dependencies/history/source and official target tooling.
- [x] Create Issue18 before code; CNPM/security/test design.
- [x] Implement trusted bounded MQL5 generator/runtime and immutable owned API/V10.
- [x] Add actual compiler/target fixtures and API/DB/security/concurrency tests.
- [x] Connect MQL5 UI and meaningful frontend tests.
- [x] Run browser/restart and local regression/build/lint/audits.
- [x] Execute official target events/negative CSV/device-name/numeric-overflow cases.
- [x] Review exact diff/stage; commit/push main; verify SHA and CI.
- [ ] Close completed only after all DoD; otherwise preserve precise blocker.

31/08/2026: implementation/testing NOT RUN. MetaTrader5 binaries discovered;
presence alone is not compilation/runtime proof.

31/08/2026 checkpoint:163backend/186frontend/42Python,6verifier/6canonical/6UI
fixtures/2trace-parser tests and audits PASS. Official compiler eight fixtures0/0;
final guard review requires refreshed exact compile evidence. Browser1600/900/390,
draft/copy/download action/A-B account isolation and real HTTP/PG restart verified.
Runtime/events/negative CSV remain BLOCKED by target initialization/app access;
do not mark DoD complete. Current final regression: tmp/pb016-backend-final4.log.

Final local source:163backend/186frontend/44Python PASS; official compiler8/8,
zero errors/warnings after both guards; final HTTP/PG/JVM restart smoke PASS.
All owned API/PG stopped/password removed. Scope/publication/CI and Issue update
remain next. Runtime NOT RUN; keep Issue18 open and continue independent work.

31/08/2026 publication:239c1bc main verified; CI33388361245 SUCCESS, actual163backend/186frontend/44Python/Java118. Issue18 remains OPEN/BLOCKED; comment5477882015. PB024 continues independently.

01/09/2026: isolated portable MT5 runtime completed. All eight actual event/accounting
traces verify PASS and all prepared negative paths fail closed; the final `future.csv`
case emitted `ERROR: CSV_INVALID row 2`. Publication/CI/Issue closure remain pending.
