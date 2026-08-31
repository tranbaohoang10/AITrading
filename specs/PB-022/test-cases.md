# PB-022 test cases

31/08/2026. Issue20. Initial status NOT RUN; record actual results separately.

| ID | AC | Scenario / expected |
| --- | --- | --- |
| N01 | 1 | Actual Python completion creates one SUCCEEDED row; repeat finish/no-op never duplicates |
| N02 | 1 | Cancel/repeated cancel, worker failure, queue expiry and retry generate correct separate unique rows |
| N03 | 1 | Forced notification insert failure rolls back terminal job update; retry after restore creates once |
| N04 | 2 | Delete terminal job retains notification; delete account removes it; fixed metadata never includes source/private content |
| N05 | 3 | A/B/anonymous, missing/wrong expected identity, stale credentials, CSRF, unknown/foreign/expired ID404; body mass assignment rejected |
| N06 | 3 | Empty, unread count, page bounds/order/cursor, invalid numbers/overflow/injection and per-owner rate budgets |
| N07 | 3 | Mark-read replay/concurrent requests preserve original timestamp and decrement count once |
| N08 | 2 | Retention removes at most5000 eligible rows; fresh rows/read state preserved, expired omitted |
| N09 | 5 | Owned real API/PostgreSQL restart preserves unread/read event and session; no duplicate job notification |
| U01 | 4 | Explicit check only, loading/error/empty/count/read/older/refresh/open-job; bounded JSON/schema and safe error text |
| U02 | 4 | Late page/read completion after account change ignored;401 clears old workspace without affecting replacement session |
| U03 | 5 | Actual browser desktop/tablet/mobile, real completed job notification/read persistence and two-user isolation |
| R01 | 5 | Full backend/frontend/Python/build/lint/verifiers/audits, exact diff/CI and protected historical files |

Threat matrix: ownership/BOLA/auth bypass/CSRF/credential revocation/account
confusion, SQL/log injection/XSS, sensitive data, replay/duplicate/race and resource
bounds above. No new upload, external URL, AI output, token/password algorithm,
privileged role, shell/process or payment input: associated SSRF/traversal/upload/
LLM/live-trading attacks N/A here; existing regressions remain mandatory. Only
synthetic local/test systems, no third-party attacks or disabled security checks.

## Execution procedure and evidence — 31/08/2026

Common preconditions: owned disposable PostgreSQL through `scripts/test_backend.py`,
Java21/Gradle Wrapper and Python engine; two synthetic accounts A/B, no production
data. Backend tests reset their own fixture tables before each case. Browser uses
the separate owned `--serve` harness, Vite5173/API8080 and real HTTP, no interception.
Frontend unit/transport cases use explicitly labelled mocks; they do not prove
database persistence. Objectives and expected results are in the initial matrix.

| ID / AC | Data / input | Steps | Actual result / status | Evidence |
| --- | --- | --- | --- | --- |
| N01 / AC1 | long-next-open DSL, three synthetic candles | Create job; claim; execute real Python; finish twice; no-op state update; list | One SUCCEEDED notice, no source content; PASS in first182 suite | NotificationApiTests.actualPythonCompletionNotifiesOnceAndLogicalJobDeletionPreservesNotice |
| N02 / AC1 | queued job, retry IDs, WORKER_FAILED, expired lease | Cancel twice; retry/fail; retry/expire twice; list | Three unique ordered jobs with correct fixed states/errors; PASS | cancelFailureExpiryAndRetryAreDifferentUniqueTerminalJobs |
| N03 / AC1 | owned temporary failing INSERT trigger | Cancel through HTTP; inspect job/audit/notice; restore trigger in finally; cancel | Safe503, job remains QUEUED, no terminal audit/notice; restore creates one; PASS | notificationFailureRollsBackJobAndAuditThenRecoveryCreatesExactlyOnce |
| N04 / AC2 | completed job, notification, synthetic owner | Delete job; list and mark notice; delete account | Notice survives job deletion, account deletion purges it; metadata redacted; PASS | actualPythonCompletion…; cancelFailure…; expiryRetention…; restart-smoke.json |
| N05 / AC3 | A/B/anonymous, wrong identity/CSRF, extra ownerId, revoked credentials, missing ID | Call list/read under each identity; revoke current credential version | Private denial401/403, foreign/missing404, extra field400, no read mutation; PASS | ownerIdentityCsrfRevocationAndMassAssignmentAreEnforced |
| N06 / AC3 | 55 rows; limits0/25/51/overflow/text; cursor0/01/-1/overflow/SQL text | Fetch25/25/5; validate order/count; malformed list/read;301GET/31POST | Correct keyset/count,400 malformed,429 budget, B independent; PASS | boundedKeysetPagesCountsAndInputValidationAreSafe; notificationReadAndMutationShareExistingOwnerRateBudgets |
| N07 / AC3 | one unread notice,8 parallel read requests | Read concurrently, repeat HTTP read, list | Same first timestamp, one row, unread0; PASS | idempotentAndConcurrentReadPreservesFirstTimestampAndCount |
| N08 / AC2 |5001 expired rows plus one fresh | List/read expired; purge three batches; inspect fresh/account delete | Expired hidden404;5000+1+0 deleted; fresh preserved; PASS | expiryRetentionAndPrivacyAreBounded |
| N09 / AC5 | two actual completed jobs, one read; owned restart sentinel | Run smoke_notifications; replay; delete one job; observe API down/up against same PG; read/logout | Identical page/session after restart, stable acknowledgement, private401 after logout; PASS exit0 | test-evidence/restart-smoke.json |
| N10 / AC1,5 | three real Python jobs, two simultaneous terminal writers | Barrier starts finish/cancel concurrently; compare winning job state with one notice; repeat both | NOT RUN at this checkpoint; final full backend run required | concurrentFinishAndCancelPublishOnlyTheWinningTerminalState |
| U01 / AC4 | mocked pages25/older/empty, pending/read failure, malformed/oversize JSON | Explicit check; older; mark twice while pending; error/refresh; open job; validate wire |8 focused frontend cases PASS;201 total, fixed redacted error, authoritative count | frontend/src/notification/Notification.test.tsx; test-evidence/results.md |
| U02 / AC4 | deferred A responses, replacement B account,401 | Replace provider while list/read pending; resolve old request; refresh active account | No stale page or extra read GET, clear only active workspace; PASS | Notification.test.tsx; stale-a-denied.txt; b-isolated-after-a-denied.txt |
| U03 / AC5 | actual A2notices(1unread), B empty,1600/900/390 widths | Mark read; open retained/deleted job; reload; responsive check; replace cookie session in tab B then refresh stale A |1→0 persists; correct result/safe missing job; no page overflow; B empty; A denied without signing B out; PASS | test-evidence desktop/tablet/mobile JPG+DOM, reloaded-a.txt, open-owned-job.txt, deleted-job.txt, stale-a-*.txt |
| R01 / AC5 | complete unchanged regression plus scoped additions | Full backend/frontend/Python/build/lint/verifiers/audits; inspect scope; push and inspect exact CI | Local182backend/201frontend/44Python passed; final183/backend and publication NOT RUN at this checkpoint | test-evidence/results.md; verification.json when final run completes |

Final outcomes supersede these chronological checkpoint statuses only when appended
with actual evidence below; never infer PASS from implementation or documentation.

Final local checkpoint: N01–N10 PASS in183backend/0fail/error/skip, including all9
NotificationApiTests and the real finish/cancel race. U01–U03 PASS as recorded.
R01 local build/test/audits/browser PASS; publication and exact CI still pending.
See verification.json and results.md. No tests skipped or security assertions removed.
