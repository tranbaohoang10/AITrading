# PB-024 verification evidence

31/08/2026 Asia/Ho_Chi_Minh. Issue #19. Synthetic local data only.

## Executed checkpoints

- First backend run `python scripts/test_backend.py`:172 tests,1 failure. New test
  incorrectly expected auth PATCH with query to succeed; existing AuthInputFilter
  correctly returns400. Split valid mutation from explicit query-denial/redaction
  assertion. No production gate/test disabled. Cluster3jnxkt2q stopped/password
  file removed. Log `tmp/pb024-backend-1.log` retained ignored.
- Second run:172 tests,0failures/errors/skipped, Gradle build/dependencyInventory
  SUCCESS4m31. Cluster6m2rgb40 stopped/password removed. Nine new AuditApiTests
  passed actual HTTP/PostgreSQL including retention5001→5000+1, concurrent purge,
  concurrent writes, private pagination/negative bounds/CSRF/owner/revocation/rate,
  forced audit failure and job transaction rollback/recovery, expiry/cancel/retry.
- Final source review added explicit safe MVC numeric-parameter error handler plus
  registration/password/revocation and query-log redaction tests. Final regression
  `tmp/pb024-backend-final.log` pending; do not conflate previous172 with final suite.
- Frontend192 tests/23files, lint/build PASS. First TypeScript test compile failed
  because mock-call options were typed unknown; added a typed RequestInit local.
  No assertion/runtime code weakened. Final repeat in `tmp/pb024-frontend-final.log`.
- Python44 PASS13.587s; verifier6 PASS, independent DSL canonical6 PASS and real
  engine UI fixtures6 PASS. Java OSV118/no findings, npm audit0. No new dependencies.

## Actual browser and restart

Owned browser clusterl08ntn80, Java17128→5288 through restart sentinel. Actual
`scripts/smoke_audit.py --owned tmp/pg-test-l08ntn80 --report
specs/PB-024/test-evidence/restart-smoke.json` exit0: server-generated profile event
request UUID, page free of private profile/email, identical page/session after
observed API down/up, logout and private401. Synthetic smoke account signed out.
Browser run used audit implementation before the final numeric-error-handler
addition; UI, audit persistence and restart paths are unchanged by that addition.

Real app5173/API8080, no API interception/browser mocks. Synthetic A and B accounts:

- A register/login, Account → Load activity: actual LOGIN204. Rename with inert
  `<script>` text then refresh: PROFILE200 metadata without profile text in events.
  Request IDs98c6b538-8510-4181-9559-f65c555923f8 and
  7a50efec-f1fe-4855-8282-be9bb440b3b8 observed from rendered UI.
- Desktop1600x1000, tablet900x1000 and mobile390x844 screenshots captured and
  visually inspected. UUIDs fit; buttons keyboard accessible, no page horizontal
  overflow (clientWidth=scrollWidth900/390). Responsive breakpoint remount resets
  panel to explicit Load; reload retrieves same persisted events. PageDown reveals
  activity inside the normal scroll container. No CSS width hack/mock content.
- Two tabs both A: keep tab1 activity; tab3 signout/register/login B. B activity
  contains its own LOGIN UUID729fe559-120f-46a1-aaf6-3a44c94f355d, no A profile/event.
  Refresh stale A tab sends captured A identity, denied and returns Sign in. B
  session remains authenticated and isolated. DOM evidence before/after retained.
- B signed out normally; both local tabs at Sign in. Temporary viewport override
  reset. Owned API/PG stopped via sentinel and password file removed. Vite may run.

Evidence files: browser-desktop/tablet/mobile.jpg plus corresponding DOM,
browser-stale-a-before/denied.txt, browser-b-isolation.txt, restart-smoke.json.
Screenshots contain only synthetic test accounts, never owner credentials/data.

## Applicability and limits

All job transition checks use actual database triggers; successful worker test uses
real Python engine. Fault triggers/tables exist only briefly in owned disposable
DB, restored in finally blocks; no application security trigger disabled.
Retention is batch bounded; account deletion intentionally removes history.
HTTP audit remains best effort after business processing; crash/outage gaps are
documented, not an exactly-once/outbox claim. Successful reads/anonymous login
attempts are not shown in user timeline; anonymous metadata is operator-only.
SQL superuser/backup policy, ingress/distributed flood and disk capacity remain
deployment responsibilities. Public health tests read availability only.

New endpoint has no file upload, URL/network fetch, model output, custom crypto,
financial execution or privileged role assignment. SSRF/upload/path traversal/AI
prompt injection are N/A here; existing full regressions still execute. Tested
auth/CSRF/BOLA/account-binding, mutation replay, SQL/log injection, inert rendering,
secret redaction, credential revocation/rates and concurrency instead. Dependency
audit is point-in-time, not a guarantee against undisclosed vulnerabilities.

Publication/exact GitHub SHA/CI/Issue completed remain pending until recorded.

## Final regression checkpoint

Final backend `tmp/pb024-backend-final.log`:174 tests,0failures/errors/skipped,
11AuditApiTests PASS; build/dependencyInventory SUCCESS5m24. This includes the
safe numeric-query handler, registration/password event redaction/revocation and
actual global application-log non-echo assertion. Clusterba8yfndm stopped/password
removed. Refreshed JavaOSV118/no findings (`tmp/pb024-java-audit-final.json`).

Concurrent frontend repeat:189 PASS/3timeouts at existing5000ms in Market,
Backtest and Journal rendering tests. No assertion failure or audit-test failure;
logs retained `tmp/pb024-frontend-final.log`. Earlier unchanged192 had passed.
Run unchanged full suite in isolation (`tmp/pb024-frontend-retry.log`) before
claiming final frontend PASS. No test timeout/configuration changed.

Isolated repeat completed:192/192 PASS,23files,45.28s; lint/build also exit0.
Same tests/assertions/5000ms limits, no source/test/config changes between runs.
This supports machine contention as the timeout cause; keep the failed run visible.

Final exact source restart smoke: owned b2my_5ah, Java25336→25212, exit0; identical audit page/session across observed down/up. See restart-smoke-final.json. Synthetic user signed out; harness stopped/password removed. All required local verification PASS; publication/CI still required.
