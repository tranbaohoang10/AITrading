# PB-011 test cases — Issue #13, 31/08/2026

| Case | AC | Expected evidence |
| --- | --- | --- |
| JOB-T01 |01 | Owned validated immutable snapshot, matching market/gaps/warm-up/cutoff; raw/foreign IDs and injection rejected |
| JOB-T02 |02 | Actual durable create/list/status/result/delete; pagination, bounds, quotas and safe statuses |
| JOB-T03 |03 | Actual supervised Python correct args/clean environment; resource setup/no child, input/output/stderr/time limits; owned cleanup |
| JOB-T04 |04 | Real Java→Python→PG hand example, repeat determinism, canonical/input/DSL/data/result hashes and exact trade trace |
| JOB-T05 |04 | Malformed/duplicate/trailing/oversized/wrong hash/version/provenance/exit result rejection; no partial success |
| JOB-T06 |05 | Parallel duplicate UUID and changed intent; claim/quota concurrency; same explicit retry preserved |
| JOB-T07 |05 | Cancel queued/running, late output/credential revocation/DB failure; monotonic state and no result |
| JOB-T08 |05 | Source edit/delete after snapshot, account isolation, persistence across real API restart; expired run not auto-replayed |
| JOB-T09 |02,06 | Anonymous/BOLA/session/CSRF/Origin/mass assignment/read/start/cancel rate tests |
| JOB-T10 |06 | Full backend/frontend/Python/verifier/build/audit, diff/secret/scope, exact GitHub SHA and actual CI |

Record exact executed evidence, no source-inspection substitute for actual worker.
UI screenshot N/A here: no UI source change; PB-012 must test actual integrated UI.

## Reproduction and actual results — 31/08/2026

Common preconditions: Java21,Python3.12+,installed PostgreSQL binaries; run from
repository root. `python scripts/test_backend.py` creates its own fresh database,
sets the actual interpreter/root and executes every named Java test. Never point
these tests at a user DB. Each API case creates synthetic A/B accounts and fresh
sources from python/examples/long-next-open.json; no shared real credentials.
Worker tests use only owned temporary process fixtures. Actual results below are
local; exact GitHub/CI delivery is tracked in test-evidence/results.md.

| ID / objective | Preconditions / input | Steps | Expected result | Actual / status | Evidence |
| --- | --- | --- | --- | --- | --- |
| JOB-T01 — freeze valid owned input, reject incompatible input | Common; VALIDATED revision2,3 candles TEST_USD1h; draft r1,gap,wrong symbol,SMA10 warm-up alternatives | POST owned job; inspect frozen hashes; submit each invalid alternative | Valid snapshot accepted; invalid422,malformed400/413; no invalid job | Observed exact hand inputHash and all negative assertions; PASS | BacktestApiTests actualHttpPythonAndDatabasePersistHandComputedResultAndHashes / invalidDraftMarketGapWarmupAndMalformedRequestsAreRejected; backend-tests.json |
| JOB-T02 — durable bounded storage/API | Common; four cancelled jobs,one active; isolated SQL fixtures at global16active/100stored and account20 | List two pages; request invalid page; delete active then cancel/delete; attempt admissions at each quota | Complete disjoint pagination; active delete409; terminal delete204; quotas409 | All asserted statuses/counts matched; PASS | paginationTerminalDeleteAndAccountIsolationRemainExact / perUserReadStartMutationRatesAndStoredQuotaCannotBeBypassed / databaseWideActiveAndStorageLimitsAreEnforcedAcrossOwners |
| JOB-T03 — bound only owned child processes | Python/Java worker tests; hand fixture,128MiB/1s test limits,unread1MiB stdin,flood32MiB+2 stdout/4097stderr,slow status callback | Run isolated child; allocate256MiB; spin CPU; attempt Windows child; stall/flood/cancel; block status callback while independent watchdog fires | MemoryError/CPU termination/no child; fixed safe timeout/limit/cancel; no late marker file; no secrets inherited | Actual OS/process tests and independent-watchdog assertion matched; PASS | python-tests.txt; BacktestWorkerTests actualPipesTimeoutCancellationOutputAndStderrAreBounded / independentWatchdogKillsProcessEvenWhenStatusLookupBlocks / processReceivesOnlyFixedArgumentsPrivateInputAndSanitizedEnvironment |
| JOB-T04 — reconcile actual hand result | Common; documented3-bar zero-cost long fixture | Create/claim; run actual supervised Python; finalize; GET result; repeat same inputs | One trade10units100→110; net100/equity1100; exact known hashes and identical repeat | net100,one trade,entry100/exit110 and b04fd6e... hash matched; PASS | actualHttpPythonAndDatabasePersistHandComputedResultAndHashes; BacktestWorkerTests actualSupervisedPythonMatchesHandComputedProvenanceAndResult; restart-smoke.json |
| JOB-T05 — reject invalid worker contract | Worker fixture; invalid UTF8/JSON,duplicate/trailing fields,wrong provenance/hash/version/exit | Decode each mutated payload and fixed engine/resource failure envelope | WORKER_INVALID_RESULT or explicit fixed failure; never success/partial result | Every rejection and safe error assertion matched; PASS | BacktestWorkerTests malformedShapeHashProvenanceAndExitCannotBecomeSuccess |
| JOB-T06 — no duplicate execution/admission | Common; sameUUID repeated6times,changed revision,three queued jobs,two owners | Concurrent creates; changed-intent POST; concurrent6claims; explicit retry sameUUID | One identity; changed intent409; at most2 RUNNING; retry identity/input unchanged | One created ID,two claimed IDs and retry equality matched; PASS | exactIdempotencyAndConcurrentAdmissionDoNotDuplicateWork / globalClaimsAreBoundedAndQueuedExpiryIsExplicit / frozenSnapshotSurvivesSourceDeletionAndRetryUsesExactInput |
| JOB-T07 — monotonic cancel/revoke/failure | Common; queued and running jobs; real result ready but not finalized; PG trigger raising on update | Cancel before/after claim; finalize late; revoke credential; inject failing finalization then expire lease | No success after cancellation/revocation; transactional rollback leaves result null; explicit failed expiry | CANCELLED/CREDENTIAL_REVOKED and rollback/expiry assertions matched; PASS | queuedRunningCancellationAndRevocationNeverPublishLateResult / failedAtomicResultTransactionNeverLeavesPartialSuccess |
| JOB-T08 — recovery and snapshot persistence | Common; queued+expired running rows; separate --serve owned API for smoke | Fresh scheduler tick; inspect failed old run; delete original sources; observe actual API down/up; re-read session/job/result and replay | Queued executes once,started expired run not replayed; completed data remains byte/logically identical after real restart | Fresh scheduler and real JVM16744→25152 smoke matched; PASS within documented scope | leaseExpiryAndFreshSchedulerRecoverWithoutStartedJobReplay; scripts/smoke_backtest.py; restart-smoke.json |
| JOB-T09 — deny other users and unsafe requests | Common; A job,B session,anonymous client,missing CSRF,foreign Origin,extra owner/path/command fields; rate boundaries10/300/30 | Call each owner endpoint with B; submit unsafe POSTs; saturate each bucket then verify B independent |401/403/404/400/429 as applicable; no extra job or cross-user data | All status/count assertions matched; PASS | ownerAuthCsrfAndCallerInjectionRejectBeforeJobAdmission / perUserReadStartMutationRatesAndStoredQuotaCannotBeBypassed |
| JOB-T10 — regression and verifiable delivery | Common; source final122 backend/105 frontend/40 Python suite and dependency inventory | Run full backend/frontend/Python/verifier/canonical/build/audits; inspect diff/scope; normal push; read exact SHA/CI artifacts | All relevant checks PASS,protected work unchanged,actual remote/CI proven before closure | Local PASS; code commit bfebd5f pushed/exactSHA verified; final documentation/CI completion pending | test-evidence/results.md,backend-tests.json,dependency-audit.json,python-tests.txt |
