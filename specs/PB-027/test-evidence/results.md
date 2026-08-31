# PB-027 execution evidence

## 31/08/2026 — Unchanged backend baseline

Command: JAVA_HOME=Java21 python scripts/test_backend.py; exit1.
Owned PostgreSQL pg-test-jfii9sb1 stopped; generated password removed.
New tests ran against unchanged production backend at ae59734.

- WorkspaceIdentityTests.staleConversationReadAndWriteCannotUseReplacementSession(): org.opentest4j.AssertionFailedError: [{"items":[],"nextCursor":null}]  expected: 401  but was: 200

- WorkspaceIdentityTests.privateSurfacesRejectMissingWrongMalformedAndAmbiguousIdentity(): org.opentest4j.AssertionFailedError: [{"items":[],"nextCursor":null}]  expected: 401  but was: 200

- WorkspaceIdentityTests.staleLogoutMustLeaveReplacementSessionAuthenticated(): org.opentest4j.AssertionFailedError:  expected: 401  but was: 204

- MarketApiTests.maximumDatasetPersistsAllRowsAndReadDeleteThrottlesStayIndependent(): org.opentest4j.AssertionFailedError: [{"code":"UNAVAILABLE","requestId":"0ea88053-5988-4c4c-b4fc-527df9810978"}]  expected: 200  but was: 503

These are failures, not PASS evidence. The three new identity regressions prove
the pre-fix boundary. Existing market503 requires investigation/re-run unchanged
expectations; no test removed or relaxed.

## 31/08/2026 — Implementation and local verification

- `JAVA_HOME=Java21 python scripts/test_backend.py`: final exit0,141 tests,
  zero failures/errors/skips, bootJar/dependencyInventory PASS. Owned cluster
  qji4xmez stopped and generated credential file removed. The preceding run had
  140tests/1failure: existing BacktestApiTests pagination produced SNAPSHOT_INVALID.
  Final full re-run passed that unchanged business assertion and the earlier
  market503. Exact environmental cause was not established; no expectation,
  timeout, transaction, accounting logic or test was weakened to obtain PASS.
- `npm test -- --run`: final exit0,166 tests/18files. Earlier parallel-load run
  had a one-second DOM wait failure in existing backtest setup; independent full
  re-run PASS with unchanged timeout. During editing a UTF-8 middle dot was
  accidentally re-encoded in two files; restored before final run, not hidden by
  changing display expectations.
- `npm run lint`, `npm run build`: exit0, TypeScript/Vite production output PASS.
- `python -m unittest discover -s scripts -p test_verification_tools.py -v`:
  exit0,6 tests; `python scripts/check_dsl_fixtures.py`: exit0,6 fixtures.
- `python -m unittest discover -s python/tests -v`: exit0,40 tests;
  `python scripts/backtest_ui_fixtures.py --check`: exit0,6 fixtures.
- `python scripts/check_dependencies.py backend/build/reports/dependencies.txt
  tmp/pb027-java-audit.json`: exit0,118 resolved artifacts/no findings.
  `npm audit --audit-level=moderate --json`: exit0,zero findings.
- Existing authenticated test actors now carry their captured account ID;
  authentication tests capture it once after successful explicit login, not on
  every request. Existing ownership, input, CSRF, rate, race and business
  assertions remain. New tests deliberately use missing/wrong/malformed/duplicate
  IDs, including valid B cookies with expected A and stale logout.

### Browser on final API

Real loopback API JVM21636 + owned PostgreSQL xj5hnv4t, actual frontend via Vite.
Two in-app browser tabs, synthetic pb027-a/b accounts, no provider/real credentials.
A registered/signed in, created a conversation and saved a private baseline
message. A then held an unsent private draft while tab2 signed out A and signed
in B. B's catalog was empty. Old A clicked Save message and returned to Sign in;
B refreshed and remained empty. This exercises the actual HTTP implementation,
not mocked component behavior. No network status was inferred from screenshots;
exact401 is independently asserted by real HTTP integration tests.

For stale logout, signed A back in, left tab1 on Account; tab2 reloaded A, signed
out and signed in B. Old A's Sign out returned tab1 to Sign in. Reloaded tab2
still authenticated as B with unchanged display name and empty conversations.
Thus stale logout did not invalidate B's server session. B was then signed out
normally. Saved DOM evidence and two JPEG screenshots were visually inspected.
No new layout, target-runtime or real AI-provider certification is claimed.

### Coverage / limitations

IDENTITY-01/03: WorkspaceIdentityTests plus full existing HTTP integration suites.
IDENTITY-02: WorkspaceIdentity.test.ts real transport mocks cover all nine write
paths across a delayed CSRF response; expected A stays A after synthetic session B.
Private reads/pages and bootstrap are separately checked; missing identity fails
closed. Actual backend decides ownership solely from principal, never the header.
IDENTITY-04: account remount/401 tests, existing provider late-response tests,
new exact uncertain retry tests for chat/market/strategy and post-ack backtest429;
existing journal uncertain-delete/account tests remain PASS.
IDENTITY-05: baseline reproduction, final suites/audits/browser; publication pending.

The focused threat is shared-session account confusion/side effects. CSRF/Origin,
IDOR/BOLA, session revocation, parameter/body bounds, quota/rate/concurrency and
private rendering regressions run through existing suites. No new upload, SQL,
URL fetch, shell, crypto or dependency surface is added. Header knowledge alone
never grants access. This does not solve session theft or automatically erase
already-displayed A content when another tab changes account; the next private
request rejects mismatch. In-flight work accepted as A can finish as A, but never
becomes B's work; old provider lifetimes reject late UI updates.

### Final smoke, scope and cleanup

`python scripts/smoke_backtest.py --owned tmp/pg-test-xj5hnv4t --report
specs/PB-027/test-evidence/backtest-smoke.json`: exit0; actual HTTP/Python/PG
hand-calculated result net100, source deletion, replay, session/job/result
persistence after owned JVM21636→8188 restart PASS. Synthetic smoke account signed
out. The browser accounts also signed out; owned API/PG then stopped and generated
password file removed. No existing/production database was used.

`git diff --check`: exit0. Complete source/test/docs diff reviewed; exact scoped
file manifest is change-scope.md. Protected legacy blobs, migrations1–8, engine,
stack/dependencies, CI and governance unchanged. UTF8, Markdown fences/local links,
JSON/JPEG formats and limited secret-pattern checks PASS. Final staging and remote
publication are separate steps; not claimed complete here.

## 31/08/2026 — PB-027 delivered; PB-015 selected

PB-027 commit7e741be780a94ce0279ecaa198a6460c1a73181b verified on local/main,
origin/main and GitHub after normal push. CI33376664265 SUCCESS; actual frontend
166PASS log and backend141/0/0/0 + OSV118 artifact verified. Issue16 CLOSED /
COMPLETED, comment5476292888. Tree clean after delivery. No protected old mvp-ui
re-review file included. All owned API/PG stopped and password files removed.

PB-015 Issue17 created before code. Implement versioned owned Pine v6 research
export, with custom closed-bar simulator to retain DSL stop-first/cost semantics;
never label native Strategy Tester or live orders equivalent. Actual TradingView
Pine Editor opens anonymously, but Add to chart on its default script opens Sign
in; no target compilation/runtime result available. PO notified to sign in using
a test account if available, no credential collection or bypass. Continue local
work and independent READY items; keep target validation unverified if absent.
PB-008 remains OPEN/BLOCKED#12 for actual project AI credentials/smoke.
