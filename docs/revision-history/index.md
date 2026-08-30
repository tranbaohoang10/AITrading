# Project Revision History

Append-only summary. Dates use dd/MM/yyyy, Asia/Ho_Chi_Minh.
Existing feature history remains in `specs/<feature-id>/revision-history.md`;
this new index does not rewrite or redate those records.

| STT | Date | Performer | Change ID | Before | After / scope | Evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 30/08/2026 | Codex | GOV-PROTOTYPE-001 | Constitution 1.0.0 and mandatory three-agent delivery | Record Product Owner instruction for Codex-only PROTOTYPE/DRAFT; fixed stack/safety retained; governance-only scope | `docs/governance/prototype-migration.md`; direct Product Owner request | PROPOSED |
| 2 | 30/08/2026 | Codex | GOV-PROTOTYPE-001 | Legacy roles/gates active in repository guidance | Prepare Constitution 2.0.0, active prototype rules, CNPM/test/security/Git requirements and preserved legacy originals; no product code or existing feature history changed | `docs/governance/prototype-migration.md`; local diff; no commit/PR | IMPLEMENTED — awaiting Product Owner review |
| 3 | 30/08/2026 | Codex | GOV-PROTOTYPE-001 | Governance document patch prepared locally | Verify diff scope, Markdown links/fences, 5 original snapshots and 14 unchanged specs; document review evidence without claiming product tests or owner approval | `docs/governance/prototype-migration.md`, Verification results; no commit/PR | TESTED (governance checks only) — awaiting Product Owner review |
| 4 | 30/08/2026 | Codex | GOV-AUTONOMOUS-003 | Prototype 2.0.0 required branch/PR/owner gates | Record attached Product Owner instruction for autonomous main delivery; create Issue #3; draft Constitution 3.0.0 and retain prior snapshots/history | `docs/governance/autonomous-migration.md`; Refs #3 | PROPOSED — protected writes blocked by tool auto-review pending direct chat confirmation |
| 5 | 30/08/2026 | Codex | GOV-AUTONOMOUS-003 | Protected writes refused pending direct confirmation | Product Owner explicitly confirms .agents/skills, direct-main and commit/push authority in chat; official escalation succeeds; complete workspace rules and four core skill updates without changing runtime permissions | `docs/governance/autonomous-migration.md`; direct chat confirmation; Refs #3 | IMPLEMENTED — local/publication verification follows |
| 6 | 30/08/2026 | Codex | GOV-AUTONOMOUS-003 | Autonomous governance updated; validation pending | Verify 36-file governance scope, active policy consistency, history/snapshot/role preservation, Markdown links/fences and limited secret-pattern checks; git diff --check passes; exact publication SHA/results recorded in Issue #3 after push | `docs/governance/autonomous-test-cases.md`; Refs #3 | TESTED (local governance) — publication verified through Issue #3 |
