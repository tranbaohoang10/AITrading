# Replay verification

Refs #39, #43, #46, #47. 06/09/2026.

The exact QA01–49 steps/expected outcomes are retained in requirements.md.
All are NOT RUN for this mission until fresh execution evidence is recorded.
Previous delivery evidence is baseline context only.

| Scope | Cases | Required evidence |
| --- | --- | --- |
| Provider #39 | QA01–09 | adapter fixtures, boundary paging, actual source calls |
| Redis #47 | QA10–16 | real Redis hit/miss/down/malformed/TTL/lock and WS events |
| Replay #46 | QA17–28 | future mutation invariance, hand-calculated sizing/gaps/ambiguity, idempotency/version |
| Journal #43/#46 | QA29–38 | atomic projection, immutable execution, calendar/filters/65 rows |
| Security | QA39–44 | owner/CSRF/BOLA/key injection/secret and malformed external input |
| Performance | QA45–49 | render/request counts, streaming memory bound, shared misses |

Integration fixtures use synthetic accounts and disposable PostgreSQL. Live market
evidence must retain actual provider provenance; missing Alpaca entitlement is
BLOCKED_EXTERNAL, never fixture-based PASS. Browser screenshots/network at
1440/1024/390 must exercise crypto Long/Short, FX unsupported and Redis-down.

Commands: npm test -- --run; npm run lint; npm run build (frontend).
python scripts/test_backend.py (Gradle Wrapper with disposable PostgreSQL).
Targeted tests precede full suite after implementation. Record exit codes/counts.

## 07/09/2026 — evidence update (work in progress)

- Actual Edge browser, Coinbase BTC-USD Long: next-candle fill, manual close,
  balance 10015.729068908 USD, Journal projection observed. Binance BTCUSDT Long
  and Short: displayed balances 10008.13 USDT and 9991.87 USDT;
  inspect persisted execution for exact decimals before final financial assertions.
- Binance initial full-notional draft was CANCELLED/INSUFFICIENT_BALANCE when
  next open exceeded available balance. This was correct execution; added visible
  cancellation reason. Successful Long/Short browser runs used 0.5% risk.
- Screenshots and status-only network records: test-evidence/. Each provider's
  Replay remained mounted at 1440/1024/390; document body width matched viewport.
  Fixed responsive shell remount by hosting Replay above shell branches.
- Frontend build and lint exit 0 (tmp/replay-build-current.log,
  tmp/replay-lint-current.log). Targeted Replay tests: 4 PASS, including frozen
  uncertain intent/exact retry and cancellation explanation. Calendar test: PASS.
- MarketCacheTests: 4 PASS (mocked Redis, including concurrent singleflight).
  Real MarketRedisIntegrationTests: 2 PASS, 0 skipped, 0 failures. Actual Redis
  8.4.2 on isolated WSL loopback 6387; hit skips provider, malformed value replaced,
  TTL expires, provider keys separated, server shutdown yields source fallback and
  DEGRADED. tmp/replay-market-redis-current.log exit 0. Distributed lock and WS
  parity remain pending, so QA10–16 as a group are not declared complete.
- Daily note exact lost-response retries now return the saved version; stale
  differing edits conflict. Replay Journal execution selects/time inputs locked;
  daily trades sorted chronologically. Fresh persistence tests pending.
- Docker error was bypassed using a dedicated imported Alpine WSL distribution
  AITrading-Redis-QA under tmp/redis-qa/distro, not by resetting Docker. Rootfs
  SHA256 fae0d78ad39563573ddececfdd55ae1040ed428442e95ea5401cf66d9079b327.
  Redis is test infrastructure only; no Spring Session migration.

These observations do not constitute final QA01–49 completion. Full regression,
HTTP security, Journal browser scenarios, provider audit, realtime parity,
commit/push and CI remain required. Issues #39/#43/#46/#47 remain open.


## 07/09/2026 — regression and browser evidence, 20:45 ICT

This entry supersedes the pending observations above only for the checks named.
The overall QA01–49 matrix and delivery remain in progress.

- Backend full regression: 324 tests, 42 classes, zero failures/errors/skips;
  `python scripts/test_backend.py`, exit 0, `tmp/replay-full-backend-serial.log`.
  This run predates the bounded archive subscriber and incremental command window.
  The first resource-contended run failed a database cleanup timeout; isolated
  ConversationTests and the complete serial rerun passed without weakening tests.
- Frontend full regression: 45 files, 286 tests, exit 0,
  `tmp/replay-full-frontend-final.log`. This run predates the indicator/window and
  latest Journal source-state fixes. Fresh affected tests/build are required below.
- Dependency inventory audit: 144 coordinates, no findings; evidence
  `test-evidence/dependency-audit.json`. npm audit: zero vulnerabilities.
  Verification-tool unit tests: 6 PASS.
- Real Redis integration: 3 tests, zero skips, including independent cache
  instances, UUID-owner lease release, malformed payload, TTL and shutdown fallback.
  Actual Coinbase closed 1m OHLCV matches REST exactly; evidence
  `test-evidence/realtime-parity.json`. Forced transport recovery remains pending.
- Actual HTTP smoke on owned API 8083: 7 scenario groups PASS, exit 0,
  `test-evidence/http-replay-security.json`, `tmp/replay-http-window.log`.
  Includes anonymous denial, CSRF, wrong owner, duplicate command, stale version,
  one-new-candle Step window/exact retry, Short close, atomic Journal projection,
  immutable quantities with editable review, day-note retries, namespace injection.
- Replay indicators: all 11 study types tested against a mutated future OHLCV
  suffix; revealed arrays remain identical, including warm-up nulls. Seven Replay
  tests PASS (`tmp/replay-window-test.log`), including missing/mismatched window
  rejection and exact uncertain-request retry.
- Binance archive market tests PASS after streaming-body bound changes
  (`tmp/replay-market-final.log`); two new body-subscriber tests cover an exact
  fragmented limit and cancellation before oversized chunk accumulation.
- Actual browser SL and TP: draft drag sends zero commands; active drag sends one
  command on pointer-up. EMA can be selected in Replay. Current TP/indicator
  screenshots: `test-evidence/replay-tp-indicator-{1440,1024,390}.png`.
  Logs: `tmp/browser-qa/drag-result.log`, `tmp/browser-qa/tp-result.log`.
- Actual Journal: 65 synthetic records, page 4 shows 61–65, symbol filter resets
  to page 1 with 32 matching records, day note persists. The first mobile screenshot
  exposed Journal disappearing into Chart on responsive shell remount; fixed and
  rerun at all three widths. Files: `test-evidence/journal-trades-*.png`.
- Actual Replay Journal review: execution inputs readonly, direction disabled,
  review note saved, new manual entry quantity editable. Screenshot files
  `test-evidence/journal-replay-review-{1440,1024,390}.png`; body width equals
  viewport at every size. Source-state is now bound to the selected entry id.

Issues #39, #43, #46, #47 remain OPEN. No final commit/push or CI claim is made.

## 07/09/2026 - later verification and corrections, 21:11 ICT

- Latest complete backend run before bulk-fixture statistics refresh: 328 tests,
  one failure in ConversationTests setup (DELETE app_user exceeds the existing
  2-second query timeout). Earlier loaded run: 327 tests, 20 failures including
  propagated cleanup failures and an expired 2-second Redis hit fixture.
  These failed runs are retained, not reported as PASS.
- A rolled-back, synthetic 100-conversation/2000-message cascade benchmark in the
  owned browser database completed in 79.310 ms. No blocking database process was
  found in the later full-run probe. The fixture now ANALYZEs conversation_message
  after its bulk insert; production timeout and quota/cascade assertions are intact.
- Redis hit uses a 30-second test TTL, independently of the existing explicit
  150-ms expiry check. Latest market tests, including real Redis, stalled-body
  timeout, retired-socket rejection and partial recovery, PASS with exit 0:
  tmp/replay-market-recovery.log. A fresh complete run is pending.
- Actual authenticated Frankfurter chart initially returned 401: its request
  missed the rendered-workspace binding. Both Forex and Alpaca adapters now use
  an account-bound fetcher. Test verifies two account instances cannot swap headers.
- FX browser rerun: HTTP 200 with 300 real observations, EOD label, intraday disabled,
  no Frankfurter trading Replay choice; 1440/1024/390 screenshots are in evidence.
  An earlier label-only observation was insufficient and is not used as PASS.
- Stable accessible labels added to Replay provider/timeframe selects so their
  names do not depend on the asynchronous option text.
- Feed freshness had a parent-level one-second timer. It now lives inside the
  small FeedStatus component. Instrumented 20k-bar chart receives zero extra renders
  during three clock ticks; live update retains the chart DOM node and makes no
  extra history request. Affected chart regression: 36 tests PASS, exit 0,
  tmp/replay-chart-regression.log. Chart render was instrumented in this test;
  it is not a browser FPS or heap measurement.
- Full frontend run before the UTF-8 label correction: 292 tests, seven failures
  (six status labels and one loaded-host timeout). Invalid newly written Windows
  bytes were normalized to UTF-8; all four affected chart files now pass.
  A fresh full frontend run remains required.
- Journal Entry/Exit markers now use their actual execution prices and explicit
  ENTRY/EXIT kinds. Replay review browser was rerun after this change.
- Consolidated sanitized browser checks: test-evidence/browser-scenarios.json.
  Issues remain open; final QA matrix, commit/push and CI remain outstanding.

## Final local verification — 07/09/2026 (Asia/Ho_Chi_Minh)

- Complete backend rerun: `AITRADING_REDIS_DISPOSABLE=6387 python scripts/test_backend.py`, exit 0; 331 tests in 44 classes, zero failures/errors/skips. Report: test-evidence/backend-regression.json. This supersedes the failed runs above without erasing them.
- Complete frontend rerun: `npm test -- --run`, exit 0; 292 tests in 48 files. `npm run build` and `npm run lint`, exit 0. The build retains its informational large-chunk warning.
- Final readiness check: exit 0, 19 migrations and 30 tables; this verifies the existing readiness ledger and documentation, not publication of this mission. Production npm dependency audit: zero vulnerabilities, exit 0. Java audit: 144 coordinates, zero findings.
- Journal browser rerun verifies 35 slots for February 2021 and 42 for August 2026. The 65-row dataset, page 4, filter reset, review notes, execution locks and all three viewport screenshots are recorded in the QA scorecard.
- User website at http://127.0.0.1:5175/ now serves the verified backend build. Its owned database was preserved; actual HTTP smoke against API 8081 passes seven groups. Redis current-bar evidence was refreshed with two advancing actual bars; Redis was restarted after the outage check.
- QA-01 through QA-49 local evidence is mapped in qa-scorecard.md. Live Alpaca stock verification remains BLOCKED_EXTERNAL; fixture tests do not establish credentials or display entitlement. No real broker order was placed.
- Final local review preserves six unrelated untracked files outside the staged delivery. Git publication and exact-SHA CI verification remain pending at this revision.

## CI correction — 07/09/2026 (Asia/Ho_Chi_Minh)

- Implementation commit 317b60356f9c89e69c230d40ee890fd94fafa1e0 was pushed normally and its remote SHA verified. Run 34134055259 failed in the Python readiness fixture, before Java tests: the fixture still created 18 migrations after the verifier was updated to V19. The earlier 58-test local PASS preceded that verifier change and was not sufficient evidence for the published combination.
- Updated the synthetic ledger fixture to 19 migrations, retaining CRLF normalization and tampered-hash rejection, and explicitly checking that an unexpected V20 is rejected. No applied migration or production security check was changed.
- Full Python rerun after the correction: 58 tests PASS, exit 0, tmp/replay-python-ci-correction.log. Frontend job in run 34134055259 passed lint/build/292 tests/dependency audit; backend must pass a new run.
- Run 34134266248 at 057628ca0a585274b78607b9cc930b88d1d38cef completed SUCCESS for both jobs. Downloaded backend artifact: 331 tests/44 classes, zero failures/errors/skips. Frontend 292 tests, full npm audit zero vulnerabilities, Java 144 coordinates/zero findings, Python 58 and verification tools 6 PASS. Publication details and external limitations: publication.md.
