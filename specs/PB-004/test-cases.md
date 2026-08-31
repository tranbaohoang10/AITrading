# PB-004 — Test cases

Issue: https://github.com/tranbaohoang10/AITrading/issues/7

Initial status NOT RUN for all cases. Preconditions: only harness-owned disposable
PostgreSQL cluster, Java21/Spring API, synthetic A/B users with separate cookie jars,
fresh CSRF for writes. No real accounts, provider or user database. Each expected
result below is a requirement, not inferred from implementation. Shared limits:
title1–120, message1–4000, conversations100/user, messages2000/conversation.

| ID | AC | Objective | Data/input | Steps | Expected result | Actual/status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CHAT-01 |01| Persistent CRUD | A, two conversations | create/list/get/rename/reopen; restart API; list/get | same IDs,title,UTC times/versions; data survives restart | NOT RUN | HTTP/DB/browser |
| CHAT-02 |02,06| BOLA every endpoint | A/B, owned/missing IDs | B list/get/rename/delete/send/read A, repeat absent UUID | empty own list; uniform404; A untouched | NOT RUN | HTTP/DB |
| CHAT-03 |03| Append isolation/order | two conversations, Unicode/newlines | send distinct texts, reopen each | exact content/sequence; role user only; no other-context message | NOT RUN | HTTP/DB/browser |
| CHAT-04 |03| Idempotent creation | same request UUID;4 concurrent calls | submit create concurrently/retry | exactly one row and same returned ID | NOT RUN | HTTP/DB |
| CHAT-05 |03,06| Idempotent append | same key/content, then changed content |4 concurrent POST/retry; change payload | one message/same seq;409 changed content | NOT RUN | HTTP/DB |
| CHAT-06 |03,04| Concurrent distinct appends |8 keys/messages | simultaneous writes; get all |8 messages contiguous unique sequences, correct parent version, no loss | NOT RUN | HTTP/DB |
| CHAT-07 |01,06| Stale rename/delete | expectedVersion before append | append; rename/delete with stale version; reload/retry |409; no lost message/deletion; current version succeeds | NOT RUN | HTTP/DB |
| CHAT-08 |04| Conversation pagination | >pageSize items; tied timestamp fixture | page through, rename/send between pages; malformed cursor | no duplicate/missing IDs, owner-only stable sort; malformed400 | NOT RUN | HTTP/DB |
| CHAT-09 |04| Message pagination | >pageSize messages | latest page, append, load earlier across boundaries | ascending each page, contiguous no duplicates; new append not shift earlier page | NOT RUN | HTTP/DB |
| CHAT-10 |01,02| Delete cascade | A conversation with messages, B independent | delete A; read/retry; inspect child rows |204 then404; A children gone, B remains | NOT RUN | HTTP/DB/browser |
| CHAT-11 |04,06| Quota/race/resource bounds |99 conversations or1999messages fixture | concurrent2 creates/appends; replay existing key at quota | at most100/2000; rejected409; valid replay returns existing | NOT RUN | HTTP/DB |
| CHAT-12 |06| Validation | null/empty/control/title121/text4001, UUID/cursor malformed, version0/fraction/string | send each; include min/max/Unicode and unknown owner/role/type |400 invalid; boundaries accepted; no mass assignment or deserialization | NOT RUN | HTTP/DB |
| CHAT-13 |06| Session/CSRF/Origin | anonymous,expired/stale cookie,missing/forged token,foreign Origin | all routes and unsafe requests |401/403; data unchanged; no identity from headers | NOT RUN | HTTP/DB |
| CHAT-14 |06| Injection/XSS/leak | SQL syntax, HTML/script title/content | persist/render; inspect DB/error/report | literal safe text; schema intact; no script/SQL eval, no content in error logs | NOT RUN | HTTP/DOM/browser |
| CHAT-15 |04,06| Throttle | atomic counter at119; concurrent2 writes, spoof XFF | submit; reset old window fixture; retry | exactly one allowed then429 RetryAfter; spoof cannot bypass; new window works | NOT RUN | HTTP/DB |
| CHAT-16 |01,06| Actual DB outage/recovery | authenticatedA with messages | stop ownedDB; get/send; restart; retry safe reads, then idempotent write | sanitized503; same user/data recover within15s; no duplication | NOT RUN | HTTP/DB |
| CHAT-17 |05| Loading/empty/error/context race | deferred mock A/B responses | selectA thenB, resolveA last; list/load errors | no old message in B; retry available; no fake success | NOT RUN | Vitest |
| CHAT-18 |03,05| Uncertain send/retry | network fails after request; server replay reply | send twice/doubleclick, retry samekey; verify UI | no duplicate submit; draft+key retained until acknowledged; exact context | NOT RUN | Vitest/HTTP |
| CHAT-19 |05| Responsive and private state | desktop/tablet/mobile, userA/B | createA, navigate/rescale; logout; loginB | correct selected context across view changes, no A state/B data leak | NOT RUN | browser/Vitest |
| CHAT-20 |05| Rename/delete confirmation UX | nonempty title, cancel/confirm/server409 | rename, canceldelete, confirm, conflict refresh | no deletion on cancel; focus works;409 does not claim deleted | NOT RUN | browser/Vitest |
| CHAT-21 |07| Delivery regression | all current tests/dependency inventories | locked build/lint/tests/audit/scope/CI/exactSHA | all pass; V1/V2 and original10 tests unchanged; old mvp docs untouched | NOT RUN | commands/Actions |

N/A here: external AI provider/SSRF/upload/trading calculations; no executable
LLM/RAG input in this feature. PB-008 must separately verify real AI/context. API
or browser unavailable is BLOCKED/NOT RUN, never N/A. Synthetic fixtures may seed
quotas/time to avoid thousands of requests, but actual HTTP decisions and database
results must still be asserted. No expected result changes to conceal defects.

## Execution — 31/08/2026

Original NOT RUN rows above retain the pre-code design. Current execution:

| Cases | Actual result | Status | Evidence |
| --- | --- | --- | --- |
| CHAT-01,03,10,19,20 | Actual browser two-conversation CRUD, A/B isolation, cancel/delete/focus, desktop1280/mobile390/tablet900, API process restart and continue; HTTP CRUD/cascade | PASS | browser-results.md, screenshots; ownedCrud test |
| CHAT-02,13 | All cross-owner/missing read/write endpoints404; anonymous/CSRF/origin/version-revoked principal denied; no owner mutation | PASS | everyReadAndWriteRejectsAnotherOwnerAndMissingResourcesUniformly; authCsrfOriginsAndRevokedCredentialsFailAtActualMutationBoundary |
| CHAT-04–07 | Concurrent create/send replay one resource, changed-content409, eight distinct contiguous messages, stale rename/delete409 | PASS | concurrentCreateAndAppendReplaysReturnExactlyOneResource; concurrentDistinctMessagesHaveContiguousSequencesAndStaleMutationsConflict |
| CHAT-08,09 | Tied-time creation keyset pages stable during append; latest/earlier message pages stable after append; invalid/bounded cursors rejected | PASS | keysetPagesStayOwnerScopedAndStableUnderRenameAndAppend; messagePagesDoNotShiftWhenNewMessagesArrive |
| CHAT-11,15 | Synthetic near-quota fixtures then concurrent real requests never exceed100/2000; existing message replay succeeds; atomic per-user throttle and old-window recovery | PASS | quotaChecksSerializeConcurrentRequestsAndAllowExistingReplayAtLimit; perUserMutationThrottleIsAtomicAndDoesNotTrustForwardedHeaders |
| CHAT-12,14 | Boundaries, controls/unpaired Unicode, extreme cursor dates, strict IDs/versions/security fields, literal SQL/HTML text validated; React inert rendering | PASS | validationBoundariesAndUnknownSecurityFieldsAreRejected; CRUD/React tests |
| CHAT-16 | Actual owned DB stop returns503 for read/write; same session/context recovers, same-key retries produce one message | PASS | actualDatabaseOutageFailsClosedAndRetryPreservesContextWithoutDuplicateMessage |
| CHAT-17,18 | Deferred old-context responses ignored; distinct drafts preserved; uncertain write retains key/text, duplicate-submit blocked, new-create retry works with selected conversation | PASS | Conversations.test.tsx; api.test.ts |
| CHAT-21 | Local backend33/frontend regression and build/audit verified; exact final frontend count in JSON. Publication/CI not yet executed for PB-004 | LOCAL PASS / PUBLICATION PENDING | test-evidence; Issue7 after push |

No real provider output is claimed. API restart browser persistence is distinct
from DB restart tests. Boundary quota fixture setup is SQL on owned synthetic data,
not an application bypass. All ordinary authorization decisions are exercised by
real HTTP. Pending remote delivery cannot be inferred from local checks.
