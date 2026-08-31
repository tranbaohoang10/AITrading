# PB-007 test plan — Issue #10

31/08/2026 before code. Preconditions: synthetic local account A/B on an owned
PostgreSQL cluster, Java21; fixtures from PB-005. Frontend contract mocks prove
state behavior only; browser uses actual local API/DB. Each case maps AC-STR IDs.

| ID / AC | Objective, input and steps | Expected | Actual/status |
| --- | --- | --- | --- |
| STR-01 /01,02 | Create A, save empty/incomplete draft, rename and reopen revisions | Exact raw text preserved, stable list/current/history, immutable old data | NOT RUN |
| STR-02 /01,03 |0/64KiB/+1 and multibyte/control/Unicode/title boundaries | Allowed bounds stored, invalid rejected, no truncation or unsafe Unicode | NOT RUN |
| STR-03 /03 | Validate/save neutral fixtures and malformed/schema/type-DAG failures | Canonical/hash/versions exact only VALIDATED; invalid422 no insert, DRAFT allowed | NOT RUN |
| STR-04 /02 | Same create/save ID replay after later version, conflicting intent and parallel writers | One revision/replay same result, stale409 no overwrite | NOT RUN |
| STR-05 /01,02 |100 strategy/revision quota boundaries, simultaneous writers at99 | Max100 atomic; replay allowed at limit | NOT RUN |
| STR-06 /02,06 | Actual DB insert failure, read/save/delete race; B resources survive | Rollback pointer+revision, valid snapshots or404/409, own cascade only | NOT RUN |
| STR-07 /06 | B reads A current/history/version/deletes/saves; missing IDs and revoked credentials | Uniform404/401, no private metadata/text leak | NOT RUN |
| STR-08 /06 | CSRF/Origin/anonymous,512KiB/+1/chunked, unknown/coerced/duplicate fields, rate races |403/401/413/400/429, existing route limits unchanged | NOT RUN |
| STR-09 /04 | Dirty edit, delayed validate/read/save; change user/tab/viewport | Never mark changed text valid or mix user/strategy; preserve local edits | NOT RUN |
| STR-10 /04 | Uncertain save/retry, conflict/reload, discard cancel, duplicate click | Same UUID/payload, no duplicate/overwrite, explicit replacement only | NOT RUN |
| STR-11 /04,05 | History read-only/copy to editor, sample choice, chart match/mismatch, JSONXSS | Immutable history; no autosave/run; inert text, explicit chart context | NOT RUN |
| STR-12 /04,05 | Real browser create/save/invalid/reopen/API restart/B isolation/mobile/tablet | Actual persisted strategy/hash, accessible responsive editor+chart and errors | NOT RUN |
| STR-13 /06 | Full regressions/lint/types/build/audits/scope and exact GitHub CI | All PASS before DoD/completed | NOT RUN |

Evidence and actual outcomes will be appended after execution. No execution engine,
external provider/target compiler/payment/broker test belongs to this feature.

## Executed outcome — 31/08/2026

STR-01–12 PASS. Per-case actual inputs/results/automation names and real browser
screenshots: [verification](test-evidence/results.md). STR-13 local84backend/88
frontend/6verifier/6canonical, lint/type/build/audits PASS. Publication/exact GitHub
SHA/CI pending. Initial NOT RUN rows record pre-code planning and are superseded
by this dated evidence without erasing the original test plan.
