# PB-004 tasks — Refs #7

Issue created31/08/2026 before code. Dependencies PB-003/#6 DONE at099d6a5,
CI33349231331 success. No changes to legacy mvp-ui or applied V1/V2 migrations.

| Task | AC | Paths/work | Verification |
| --- | --- | --- | --- |
| CHAT-T01 |01–04,06| backend conversation service/controller, V3, security/errors | HTTP/DB CRUD, owner predicates, paging/idempotency/version/quota races |
| CHAT-T02 |05,06| frontend conversation API/context/UI, auth root, AiChat | Vitest response-race/uncertain-save/escaping; browser2user/restart/mobile |
| CHAT-T03 |06,07| backend and frontend new tests, docs/specs/evidence | all regression/security/build/lint/audit; V1/V2/original tests preserved |
| CHAT-T04 |07| docs backlog/state/history; Git/Issue7 | scoped diff/check/secret patterns; commit/push exactSHA; actualCI; explicit close |

Allowed scope follows table plus necessary architecture/README/index updates.
No provider/backtest/DSL implementation here. Existing auth test cleanup may
need additive cascade support through new schema; do not weaken auth assertions.
Foundation Flyway version assertion advances3 because V3 is intentional; V1/V2
checksum validation remains required. Commands use Java21 and the existing
scripts/test_backend.py disposable cluster, frontend lint/build/test/audit,
scripts/check_dependencies.py; no live user DB/service.
