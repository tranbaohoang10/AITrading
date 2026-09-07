# QA scorecard - Replay

07/09/2026. Refs #39, #43, #46, #47.

This is local execution evidence, not a CI/publication or independent-approval claim.
The exact acceptance steps remain in requirements.md. PASS names the recorded
check; fixture evidence does not assert access to an unconfigured external feed.

| QA | Local result | Evidence / interpretation |
| --- | --- | --- |
| QA-01 | PASS | ProviderHistoryTests, actual capabilities/transport evidence; disabled Alpaca is conditional. |
| QA-02 | PASS | Binance/Frankfurter browser source labels; Alpaca IEX/raw request assertions. |
| QA-03 | PASS | MarketRedisIntegrationTests: provider-specific keys and independent values. |
| QA-04 | PASS | ProviderHistoryTests: BINANCE:BTCUSDT versus COINBASE identity; no alias substitution. |
| QA-05 | PASS | Range validation, future rejection, UNKNOWN/PARTIAL coverage and actual source checks; no global earliest claim. |
| QA-06 | PASS | Coinbase chunk fixture, Binance archives, AlpacaHistoryPagingTests: encoded token, duplicate boundary, cycle/conflict rejection. Alpaca fixtures are not live entitlement evidence. |
| QA-07 | PASS | ProviderHistoryTests, AlpacaHistoryPagingTests, Replay prefix validation: ascending UTC and unique times. |
| QA-08 | PASS | Sparse paging fixture retains a missing minute; no synthetic candle is inserted. |
| QA-09 | PASS | Provider-bound registry and persisted session snapshot; rejected source responses do not invoke another provider. A fully saved historical snapshot remains usable without an upstream connection. |
| QA-10 | PASS | Real Redis integration: first source load, second cache hit, source count=1. |
| QA-11 | PASS | redis-down-browser.json: DEGRADED, 24 identical candles and unchanged persisted Journal rows. |
| QA-12 | PASS | Real malformed cached value rejected/replaced; MarketCacheTests validate size/JSON failures. |
| QA-13 | PASS | Two independent cache instances share an owner-safe lease; one source refresh. |
| QA-14 | PASS | Real 150ms expiry assertion, TTL upper bound and refresh. Hit check uses a separate 30-second TTL. |
| QA-15 | PASS | redis-live-bar.json: two actual Redis bars with advancing lastEventAt/volume; realtime-parity.json matches all five OHLCV values to official REST. |
| QA-16 | PASS | realtime-browser-recovery.json: network interruption/reconnection without workspace remount; MarketStreamTests exercise retired provider socket, partial snapshot, full next bucket and duplicate rejection. |
| QA-17 | PASS | ReplayPersistenceTests.futureFixtureMutationDoesNotChangeRevealedState; prefix-only API and malformed future payload rejection. |
| QA-18 | PASS | indicatorPrefix.test.ts: all 11 studies retain identical revealed values when future OHLCV changes. |
| QA-19 | PASS | ReplayExecutionTests: 10000 balance, 1 percent risk, 100 risk amount, quantity 10. |
| QA-20 | PASS | Same deterministic test: fixed 100 risk amount produces quantity 10 and reward/risk 2. |
| QA-21 | PASS | Same deterministic test: manual quantity 10; unsupported LOT rejected. |
| QA-22 | PASS | Short sizing fixture, actual Binance Short browser and final API 8081 HTTP execution. |
| QA-23 | PASS | Invalid Long/Short level fixtures, invalid amount/API validation and disabled invalid draft controls. |
| QA-24 | PASS | Actual draft SL/TP drag: zero commands; open SL/TP drag: one command on pointer-up. |
| QA-25 | PASS | Both-touched fixture: SL and BOTH_TOUCHED_STOP_FIRST; persisted immutable projection. |
| QA-26 | PASS | Gap fixture: open 80 below stop 90, 10bps adverse slippage, exact exit 79.92. |
| QA-27 | PASS | Concurrent identical confirms: one durable effect; HTTP exact repeated request returns same version/trade. |
| QA-28 | PASS | Stale version/conflicting request hash return 409; client preserves uncertain intent/exact retry. |
| QA-29 | PASS | ReplayPersistenceTests and HTTP smoke: close atomically creates one Journal row; duplicate close does not duplicate it. |
| QA-30 | PASS | Actual Journal source, provider, symbol, timeframe, session, execution facts and chart marker screenshots. |
| QA-31 | PASS | HTTP immutable-execution rejection; browser readonly quantities/prices/fees/direction while review notes save. |
| QA-32 | PASS | Calendar unit fixture and actual browser: February 2021 five rows/35 slots, August 2026 six rows/42 slots, Monday-based layout. |
| QA-33 | PASS | Synthetic profit day keeps purple activity and positive P&L; journal-calendar screenshots. |
| QA-34 | PASS | Synthetic loss day keeps purple activity and negative P&L; same browser dataset. |
| QA-35 | PASS | Calendar fixture and browser synthetic breakeven activity state; neutral realized zero. |
| QA-36 | PASS | Empty and open-only days do not acquire closed-trade activity highlight. |
| QA-37 | PASS | Actual 65-row browser: numbered page 4 shows 61-65 of 65. |
| QA-38 | PASS | HTTP combined source/symbol/side/state/session/date filters; browser symbol change resets page 4 to page 1 with 32 results. |
| QA-39 | PASS | Replay/Journal owner-isolation persistence and HTTP negative cases; source fetch instances retain their captured account. |
| QA-40 | PASS | Actual HTTP missing-CSRF denial; existing authentication/security regression. |
| QA-41 | PASS | Wrong-owner session, Journal and provenance reads return 404; wrong workspace binding returns 401. |
| QA-42 | PASS | Invalid provider/key namespaces rejected; cache key purpose/provider allowlists and hashed identity. |
| QA-43 | PASS | secret-signature-scan.json: 115 files including bundle/evidence/logs plus text Git history, zero known secret signatures; market Redis payloads contain normalized public facts only. |
| QA-44 | PASS | Malformed CSV/JSON/OHLC/cache cases; bounded archive subscriber and stalled-body deadline; no HTML/script execution. |
| QA-45 | PASS | LiveChartRenderIsolation.test.tsx and actual reconnect: chart node survives live updates; no workspace remount. |
| QA-46 | PASS | Instrumented 20000-bar chart receives no render during three independent one-second clock ticks. |
| QA-47 | PASS | Actual HTTP Step returns one new candle window; exact retry preserves cursor/version. GET restores the prefix; Step never refetches upstream history. |
| QA-48 | PASS | Bounded compressed input, incremental ZIP CSV parsing, expansion/line/row/checksum limits, complete-transfer timeout. |
| QA-49 | PASS | Real Redis two-instance concurrent miss: one bounded source refresh, owner-safe lease release; local singleflight tests. |

## Browser scenarios

- Crypto Long/Short: real Coinbase/Binance historical data; no broker order.
- Journal: actual 65-row synthetic account, responsive screenshots at 1440/1024/390.
- FX: 300 real Frankfurter observations, EOD only, intraday disabled, trading Replay unsupported.
- Redis outage: actual owned server stopped, source history and Journal unchanged.
- Stock: **BLOCKED_EXTERNAL**. No configured Alpaca credentials/display entitlement;
  IEX/raw pagination is fixture-tested, not claimed as a live stock execution.
- Forced provider socket lifecycle is covered by a controlled Java fixture;
  browser network loss/recovery and real Coinbase OHLCV parity are separate live checks.

## Verification baseline

Backend: 331 tests, 44 classes, zero failures/errors/skips, exit 0. Frontend: 292
tests, 48 files, exit 0. Frontend build/lint exit 0. Dependency audit: 144 Java
coordinates, no findings. Python engine: 58 tests PASS. Verification tools: 6 PASS.
See test-evidence/backend-regression.json, supporting-checks.json, browser-scenarios.json
and the chronological corrections in test-cases.md for failures and reruns.

Git publication and CI are pending at this revision. Issues remain open until the
complete Definition of Done, including final review and publication, is satisfied.
