# PB-022 verification evidence

31/08/2026 Asia/Ho_Chi_Minh. Issue20. Synthetic local data only.

## Local checks

First backend `python scripts/test_backend.py` exit0:182 tests,0failures/errors/
skipped,8 new NotificationApiTests. Gradle clean/test/bootJar/dependencyInventory
SUCCESS3m58. Owned cluster3dhr3b9a stopped/password removed. Log retained ignored
at `tmp/pb022-backend-1.log`. Source review then added the ninth meaningful test:
three actual Python jobs with concurrent finish/cancel, unique winning-state event.
Final full backend run is pending in `tmp/pb022-backend-final.log`.

Frontend `npm test`:201 PASS/24files,34.48s, including8 notification UI/transport
cases; `npm run lint` and `npm run build` exit0 (TypeScript/Vite83modules).
Logs `tmp/pb022-frontend-1.log`, `tmp/pb022-frontend-lint-build.log`.
Python `python -m unittest discover -s python/tests -v`:44 PASS23.675s;
verification-tool fail-closed tests6 PASS, independent DSL canonical6 PASS,
real-engine UI fixtures6 PASS. Java OSV118 resolved packages/no findings; npm audit0.
No dependency/lockfile, engine, existing production endpoint or CI change.

## Actual browser and restart

Owned harness `tmp/pg-test-tk5uhr1k`, API25120→27124. Command
`python scripts/smoke_notifications.py --owned tmp/pg-test-tk5uhr1k --report
specs/PB-022/test-evidence/restart-smoke.json --browser-fixture` exit0.
Two real Python completions, known deterministic result hash, one stable mark-read,
same request replay, job deletion without notification deletion, observed API
down/up and identical page/session using the same PostgreSQL data. This is an API
restart, not a PostgreSQL restart. Logout followed by private GET401. Smoke stdout
wording subsequently clarified that distinction; assertions/behavior unchanged.

Real Vite5173/API8080, no browser API mocks, synthetic A/B only:

- A inbox contains2 notices, unread1. Mark notification2 read returns unread0;
  both read, no remaining mark-read button. Explicit refresh/reload preserves it.
- Open deleted job243c1b9d-d6a9-4cec-a8d5-e5a80d1eef84 gives fixed unavailable
  resource message, no private/server details; notification remains.
- Open retained job63b222b7-c8ee-47a9-8eb3-2bc8da30e979 selects SUCCEEDED and actual
  result: synthetic TEST_USD/1h, net100/final1100/one trade. No job resubmission.
- Desktop1600x1000, tablet900x1000, mobile390x844 screenshots saved and visually
  inspected. DOM clientWidth equals scrollWidth1600/900/390. UUIDs wrap, controls
  accessible; normal vertical scrolling. Responsive remount may reset panel to
  Check; checking retrieves persisted state. Temporary viewport reset afterward.
- Two tabs initially A. Leave tab3 inbox, sign out in tab1 and register/login B.
  B has unread0/empty inbox and no A datasets/jobs. Refresh stale A is rejected and
  returns Sign in. Refresh B still succeeds empty; A denial does not revoke B.
- Normal B signout; owned API/PG stopped through harness sentinel and password
  file removed. No owner account, external service or local production data used.

Evidence: desktop-before/after-read.txt, desktop-before-read.jpg, tablet/mobile
JPG+DOM, reloaded-a.txt, open-owned-job.txt, deleted-job.txt, stale-a-before/denied.txt,
b-isolated-after-a-denied.txt and restart-smoke.json. Screenshot contents are
synthetic test fixtures, not a real trading performance claim.

## Security and limits

Actual SQL trigger inserts transactionally and unique job ID prevents duplicates;
fault test verifies rollback of job+terminal audit+notice. Concurrent mark-read
preserves first timestamp, account/credential/CSRF/rate gates remain enforced.
Frontend keying/captured identity prevents old responses crossing accounts; raw
malformed response JSON is not echoed. Responses bounded64KiB/25rows in client,
server1..50, SQL parameters only. No strategy/prompt/DSL/result/trades in notices.

On-demand inbox, not realtime delivery/web push/email. Existing terminal jobs are
not backfilled. Keyset is not a multi-request snapshot or commit-order guarantee;
refresh retrieves later commits. Retention30days,5000/batch/minute can lag during
outage/overload; expired rows hidden. Account deletion cascades. Job deletion keeps
logical ID and can make Open job unavailable. Point-in-time audits do not prove
absence of undisclosed vulnerabilities. Deployment ingress/disk/DB access remain
operator responsibilities. No new upload/URL/AI/crypto/payment/live-trading input;
these attack classes are N/A for this feature, existing regressions still run.

Publication/exact GitHub SHA/CI/Issue completed remain pending until recorded.

## Final local regression

`tmp/pb022-backend-final.log`: exit0,183 tests/0failures/errors/skipped,
9NotificationApiTests PASS including three real concurrent finish/cancel jobs.
Gradle clean/test/bootJar/dependencyInventory SUCCESS4m31. Owned c7cvipq_ stopped
and password file removed. Parsed all21 JUnit XML suites and asserted exact totals
and presence of the new race test. Frontend/source/engine/dependencies unchanged
since their201/44/lint/build/audit PASS. Local requirements all pass; exact published
SHA and actual GitHub CI remain the last delivery checks.
