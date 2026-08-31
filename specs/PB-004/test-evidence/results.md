# PB-004 verification — Refs #7

Date31/08/2026. Feature implemented after real Issue7; no new dependencies.

| Check | Actual evidence |
| --- | --- |
| Java21 locked clean/test/bootJar/dependencyInventory | Exit0;33 JUnit tests (11 conversation +22 regression),0 failures/errors/skips; backend-tests.json |
| Owned PostgreSQL17 cluster | pg-test-9qjp9taa, actual outage/restart/cascade/ownership/concurrency; exit0 and verified shutdown/password removal |
| Frontend | lint/typecheck/Vite build PASS; functional/component/API contracts and original40 regressions; exact counts in frontend-tests.json |
| Verifier tests |6 PASS; cleanup and dependency-audit fail-closed cases |
| npm audit |0 vulnerabilities reported |
| Java OSV audit |118 resolved coordinates, no findings; no dependency change |
| Browser | Actual A/B CRUD/context/reload/API restart/desktop/mobile/tablet; browser-results.md/screenshots |
| Delivery | Pending commit/push/exact remote SHA and actual CI; Issue7 remains OPEN |

Repairs during development: removed a lint-disable comment for an unconfigured
rule (did not disable lint); corrected unsupported Testing Library locator option
without changing assertions. Review found New Chat retry could be disabled when
an older conversation was selected; added explicit pending operation state and
regression. Preserved unsent drafts when creating another conversation. Reject
out-of-range cursor dates and unpaired Unicode before JDBC; tests cover both.

An expanded57-test run exposed stale title text after successful New Chat retry
(expected Beta, rendered Alpha). Replace effect-delayed title synchronization
with an editor keyed by conversation identity/server title, so reset is synchronous.
The same assertion remains required; rerun before reporting the final test count.

The next run passed the title case but exposed an unawaited dialog-close assertion:
the delete success notice arrives before the caller closes its modal. Wait for
the unchanged expected closed-dialog result using Testing Library waitFor. This
does not accept an open modal or change deletion semantics; real browser cancellation,
focus restoration and successful close were already verified.

Final frontend rerun: all57 tests PASS (40 prior regressions +17 chat tests),0
failures. A second isolated run of17 chat tests also PASS. Lint and typecheck/build
passed on the corrected implementation. Final Java33/0/0/0 and verifier6 tests
remain passing with no backend changes since that run. Publication still pending.

Security: owner predicate on every read and locked write; version checks at
mutation boundary; no client role/owner; idempotency and per-user atomic limits;
bounded strict JSON/text/page sizes; SQL placeholders; React text rendering.
No private prompt/password/log data exported as telemetry. Existing API/session
protection and applied V1/V2 unchanged. Product UI displays no fictional AI reply.

Limits remain explicit:100 conversations/user,2000 messages/conversation,4000
characters,120 writes/15min. DB and API test data are disposable; the actual user
PostgreSQL service is never touched. Browser inspections do not include session
storage. Scans/tests are scoped evidence, not a production security certification.
