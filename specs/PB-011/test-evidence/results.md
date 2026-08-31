# PB-011 verification — Issue #13, 31/08/2026

Implemented owned API jobs and trusted supervised Python execution. No frontend
controls, result visualization, AI/provider, broker/payment or live trading added.
Existing engine simulation semantics and applied migrationsV1–V6 remain unchanged.

## Evidence map

| Case / AC | Actual verification | Result |
| --- | --- | --- |
| JOB-T01 /01 | Owned VALIDATED revision/data snapshot, matching symbol/timeframe, gaps/warm-up/input checks; no caller code/path/candle/owner assignment | PASS local |
| JOB-T02 /02 | Actual HTTP/PG queue/state/list/paging/result, terminal-only delete, account20/database100 and active2/16 quotas | PASS local |
| JOB-T03 /03 | Real Python subprocess, fixed args/isolated environment, mandatory OS CPU/memory; stdout/stderr flood, blocked stdin, cancellation and independent watchdog during slow status lookup | PASS local |
| JOB-T04 /04 | Java→Python→PG hand result net100,one trade entry100→exit110, exact input/DSL/data/result hashes, repeated result equality | PASS local |
| JOB-T05 /04 | Duplicate/trailing/malformed bytes/fields, wrong provenance/hash/version, exit-status mismatch, fixed resource/engine rejection | PASS local |
| JOB-T06 /05 |6 concurrent same-UUID admissions yield one job; changed intent409;6 concurrent claims yield2 RUNNING; explicit retry snapshot identity/replay | PASS local |
| JOB-T07 /05 | Queued/running cancellation, late result discard, credential revoke, actual PG trigger failure/rollback then expired lease | PASS local |
| JOB-T08 /05 | Source deletion preserves input; fresh scheduler processes queued but not interrupted run; actual JVM down/up preserves session/completed job/result/replay | PASS local; exact scope below |
| JOB-T09 /02,06 | Anonymous/BOLA/CSRF/Origin/mass assignment, read/start/mutation rate independence, unchanged auth regressions | PASS local |
| JOB-T10 /06 | Full regression/build/audit/scope and GitHub publication/CI | Local regression PASS; scope/publication pending |

## Actual process and restart evidence

Python5 new subprocess tests enforce a real128MiB test-memory limit (256MiB
allocation raises MemoryError),1s test-CPU limit (owned busy child terminates),
Windows one-active-process limit (new child never runs), sanitized environment
and exact supervised/offline result bytes. Production limits are512MiB/20s.
Unix uses address-space resource limits; Windows uses committed-memory Job Object
limits. Do not describe these as identical RSS accounting or a hostile-code sandbox.
Unix CPU/memory verification also runs in actual Linux CI before completion.

scripts/smoke_backtest.py ran against owned pg-test-_hzojso1 with actual API
16744→25152 restart. It registered a synthetic account with an ephemeral password
kept in memory, created validated strategy/dataset, let the real scheduled worker
finish, verified hand result/hash and idempotent replay, deleted original owned
sources, observed API down/up, then verified identical session/job/result/replay.
Signed out. restart-smoke.json contains sanitized assertions/hashes, no passwords,
cookies, prompts or real account data. Owned API/DB stopped and password file removed.

This actual JVM restart covers completed-job persistence. Queued/interrupted lease
recovery is separately tested using fresh scheduler instances and real persisted
PG rows, not falsely described as killing a JVM mid-compute. Cancel/discard is
tested at real PG lifecycle and actual process-supervisor boundaries; no fake
engine response is counted as a real calculation. The process fixture test that
returns canned JSON only tests transport/contracts and is explicitly test-only.

Hand fixture resultHash b04fd6e6beb34cea4e48d341fe1057854d82da10d6059ccfbded44fa48353494,
inputHash38a8086659b4719bac0995ec08fcb4c07d62aa9ba213ce381805ad76d3ed428f.
Historical/synthetic performance is not a return promise.

## Commands and failures repaired

- Python unittest discovery:40 PASS,exit0 (original35 retained plus5 OS-worker
  cases). Compileall of python and smoke script PASS.
- Frontend lint/type/build/test/audit:exit0,105 tests,0 vulnerabilities; source
  unchanged, assets index-BrJpLWee.js/index-CddleWOv.css. Browser visual tests N/A
  for this API-only feature; PB-012 must test the actual integrated controls/UI.
- Verification-tool unittest6 and independent canonical goldens6:PASS,exit0.
- Full Java/PG harness first120 and expanded121:PASS,exit0. Owned clusters
  pg-test-xjhla863 and pg-test-5rh67xzi stopped; generated credential files removed.
  Final122 suite includes independent watchdog under slow DB/status callback.
- Final full122 backend tests:0failures/errors/skipped,clean build/bootJar/test/
  dependencyInventory exit0. Owned pg-test-x6wz4_ss stopped/password file removed.
  Named JUnit summary in backend-tests.json; Python named run in python-tests.txt.
- Resolved Java OSV audit:118 coordinates,0 findings,passed true,exit0. No new
  dependency/lockfile; Python resource/ctypes are standard library.
- First smoke expected register201, but existing anti-enumeration registration
  contract returns202. Corrected the smoke expectation after inspecting source;
  actual job/result/restart assertions retained and full rerun PASS. Existing
  API behavior was not altered to satisfy the smoke script.
- Source review caught the result policy's Decimal values are JSON strings in
  PB-010 output, and updated validation to compare that existing contract. No
  engine semantics/hash changed. Review also added an independent process
  watchdog so a slow DB status lookup cannot defer child termination.
- The first build after that watchdog addition failed compilation because the
  timeout catch variable reused the watchdog flag name. Renamed the catch local;
  no logic/assertion/security limit changed. Full122 regression rerun PASS.

## Security applicability and limits

Session/current-credential and owned queries protect every user job route. Global
admission/claim constraints serialize in PostgreSQL; requests cannot provide code,
process arguments, URLs, paths, env, owner IDs or datasets directly. Worker receives
only frozen bounded JSON with no inherited DB/AI/session secrets. No shell/eval,
untrusted imports, dynamic plugins or network fetches. Provider/output text remains
data. Raw worker stderr, private snapshots and SQL are not exposed/logged.

Relevant BOLA/IDOR, CSRF/session, mass assignment/injection/path/shell/environment,
quota/resource/timeout, cancellation/race and dependency checks are executed.
No new XSS/upload/PDF/SSRF/live-order/payment surface; frontend/auth regressions
remain. Output hashes prove consistency, not source authenticity or authorization.
Queued5min/running60s leases recover without replaying started work. Failed DB
finalization leaves no success/partial result; explicit retry is needed after expiry.
Snapshot/job data survives original source deletion; terminal job delete is the
separate privacy cleanup. Account deletion cascades jobs. Retain private research
only in the owned database; Git evidence uses synthetic fixtures.

## Delivery

Pending final local evidence, scope/diff checks, normal main push/exact SHA and
actual CI. No Issue completion until all DoD conditions pass. PB-008 Issue12
remains blocked on external AI key/smoke and is not made DONE by this delivery.

31/08/2026 code delivery: bfebd5fd93fdb9c61268c665a8ab50ec52a4f861 normal-pushed
72ff79e..bfebd5f; ls-remote/GitHub API SHA agree. CI33365234612 backend/frontend
success; downloaded JUnit122/0/0/0 and OSV118PASS verified. Actual Linux log confirms
40Python tests including real CPU/memory enforcement PASS in3.307s. No skipped
Linux resource check claimed as Windows no-child verification; Windows no-child
was exercised locally. Scope34files and diff checks PASS after removing one
trailing blank line. Subsequent documentation-only commit completes per-case
precondition/input/steps/actual evidence fields; final CI confirmation pending.

### 31/08/2026 — delivery confirmed

Code bfebd5fd93fdb9c61268c665a8ab50ec52a4f861, documentation
bcdeaff0b7a5105226d2645a903bb7a5f4c1d9e9 pushed normally and exact SHA verified.
CI33365234612 and33365494850 SUCCESS. Issue13 CLOSED/COMPLETED,
https://github.com/tranbaohoang10/AITrading/issues/13#issuecomment-5474821388.
