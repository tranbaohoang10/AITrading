# PB-038 — Alpaca authenticated QA — 10/09/2026

Status: **PASS** after the market-open follow-up below. The initial closed-market
audit tested commit `8aeb07588d1042612ed4c74979d4b4080f0492db` on `main`; the follow-up tests the
current PB-038 fix that publishes accepted Alpaca trades to CandleChart. No API key, secret, session token, request
authentication header or raw account response is present in this evidence.

## Runtime and credential safety

- Windows User Environment checks returned key configured `true`, secret
   configured `true`, and no control characters. Values were never printed.
- Patched backend was restarted through the repository-owned launcher and reached
  `READY` on `127.0.0.1:8080`; frontend remained on `127.0.0.1:5173`.
- Alpaca Paper account returned HTTP 200 and status `ACTIVE`.
- Active US-equity catalog returned HTTP 200 with 14,285 assets. All required
  symbols were present: AAPL, NVDA, MSFT, TSLA, SPY, QQQ, IWM and DIA.
- Alpaca clock observed `2026-09-10T00:15:19.83713878-04:00`, market closed,
  with next open `2026-09-10T09:30:00-04:00`.

## Corrective implementation

- Symbol Search no longer crawls roughly 286 Alpaca catalog pages. Empty-query
  discovery requests the bounded approved stock/ETF icon set; typed searches use
  the server query and one failing provider no longer removes healthy providers.
- Alpaca realtime uses one provider-level official IEX WebSocket and multiplexes
  the union of active symbols into per-symbol/timeframe hubs. It unsubscribes a
  symbol only after its last hub is removed and closes the socket after the last
  client disconnects.
- Each SSE subscriber receives truthful `AUTHENTICATED` then `SUBSCRIBED` state;
  only a real Alpaca trade can produce a live candle.
- The chart candle endpoint now sends bounded `start/end`, `sort=desc`,
  `adjustment=raw` and `feed=iex`. Alpaca returned `bars:null` without `start`,
  which caused the browser's earlier `ALPACA_INVALID_RESPONSE`.
- The unauthenticated Alpaca frontend provider no longer substitutes 30-second
  historical polling for realtime.

## Capability, catalog and pagination

- `/api/market/providers/capabilities`: HTTP 200, `configured=true`, STOCK/ETF,
  historical and realtime enabled, supported timeframes include 1m, 5m, 15m,
  30m, 1h, 4h and 1d.
- Catalog page 1: 50 rows and a next cursor. Page 2: 50 distinct rows.
- Required catalog result: 8/8 PASS. Stocks map to canonical `US_EQUITY`; SPY,
  QQQ, IWM and DIA map to `ETF`; every row supports HISTORICAL and REALTIME.

## Historical acceptance matrix

All candles were real application responses from Alpaca IEX/raw bars. Every row
passed HTTP 200, non-empty result, strictly increasing unique timestamps, OHLCV
invariants and range checks. Daily candles aligned to New York midnight
(`04:00Z` during EDT).

| Symbol | Timeframe | HTTP | Candles | First UTC | Last UTC | Result |
| --- | --- | ---: | ---: | --- | --- | --- |
| AAPL | 1m | 200 | 390 | 2026-09-09T13:30:00Z | 2026-09-09T19:59:00Z | PASS |
| AAPL | 5m | 200 | 78 | 2026-09-09T13:30:00Z | 2026-09-09T19:55:00Z | PASS |
| AAPL | 15m | 200 | 26 | 2026-09-09T13:30:00Z | 2026-09-09T19:45:00Z | PASS |
| AAPL | 30m | 200 | 13 | 2026-09-09T13:30:00Z | 2026-09-09T19:30:00Z | PASS |
| AAPL | 1h | 200 | 6 | 2026-09-09T14:00:00Z | 2026-09-09T19:00:00Z | PASS |
| AAPL | 1d | 200 | 6 | 2026-09-01T04:00:00Z | 2026-09-09T04:00:00Z | PASS |
| NVDA | 1m | 200 | 390 | 2026-09-09T13:30:00Z | 2026-09-09T19:59:00Z | PASS |
| NVDA | 5m | 200 | 78 | 2026-09-09T13:30:00Z | 2026-09-09T19:55:00Z | PASS |
| NVDA | 15m | 200 | 26 | 2026-09-09T13:30:00Z | 2026-09-09T19:45:00Z | PASS |
| NVDA | 30m | 200 | 13 | 2026-09-09T13:30:00Z | 2026-09-09T19:30:00Z | PASS |
| NVDA | 1h | 200 | 6 | 2026-09-09T14:00:00Z | 2026-09-09T19:00:00Z | PASS |
| NVDA | 1d | 200 | 6 | 2026-09-01T04:00:00Z | 2026-09-09T04:00:00Z | PASS |
| MSFT | 1m | 200 | 388 | 2026-09-09T13:30:00Z | 2026-09-09T19:59:00Z | PASS |
| MSFT | 5m | 200 | 78 | 2026-09-09T13:30:00Z | 2026-09-09T19:55:00Z | PASS |
| MSFT | 15m | 200 | 26 | 2026-09-09T13:30:00Z | 2026-09-09T19:45:00Z | PASS |
| MSFT | 30m | 200 | 13 | 2026-09-09T13:30:00Z | 2026-09-09T19:30:00Z | PASS |
| MSFT | 1h | 200 | 6 | 2026-09-09T14:00:00Z | 2026-09-09T19:00:00Z | PASS |
| MSFT | 1d | 200 | 6 | 2026-09-01T04:00:00Z | 2026-09-09T04:00:00Z | PASS |
| TSLA | 1m | 200 | 388 | 2026-09-09T13:30:00Z | 2026-09-09T19:59:00Z | PASS |
| TSLA | 5m | 200 | 78 | 2026-09-09T13:30:00Z | 2026-09-09T19:55:00Z | PASS |
| TSLA | 15m | 200 | 26 | 2026-09-09T13:30:00Z | 2026-09-09T19:45:00Z | PASS |
| TSLA | 30m | 200 | 13 | 2026-09-09T13:30:00Z | 2026-09-09T19:30:00Z | PASS |
| TSLA | 1h | 200 | 6 | 2026-09-09T14:00:00Z | 2026-09-09T19:00:00Z | PASS |
| TSLA | 1d | 200 | 6 | 2026-09-01T04:00:00Z | 2026-09-09T04:00:00Z | PASS |
| SPY | 1m | 200 | 390 | 2026-09-09T13:30:00Z | 2026-09-09T19:59:00Z | PASS |
| SPY | 5m | 200 | 78 | 2026-09-09T13:30:00Z | 2026-09-09T19:55:00Z | PASS |
| SPY | 15m | 200 | 26 | 2026-09-09T13:30:00Z | 2026-09-09T19:45:00Z | PASS |
| SPY | 30m | 200 | 13 | 2026-09-09T13:30:00Z | 2026-09-09T19:30:00Z | PASS |
| SPY | 1h | 200 | 6 | 2026-09-09T14:00:00Z | 2026-09-09T19:00:00Z | PASS |
| SPY | 1d | 200 | 6 | 2026-09-01T04:00:00Z | 2026-09-09T04:00:00Z | PASS |
| QQQ | 1m | 200 | 385 | 2026-09-09T13:30:00Z | 2026-09-09T19:59:00Z | PASS |
| QQQ | 5m | 200 | 78 | 2026-09-09T13:30:00Z | 2026-09-09T19:55:00Z | PASS |
| QQQ | 15m | 200 | 26 | 2026-09-09T13:30:00Z | 2026-09-09T19:45:00Z | PASS |
| QQQ | 30m | 200 | 13 | 2026-09-09T13:30:00Z | 2026-09-09T19:30:00Z | PASS |
| QQQ | 1h | 200 | 6 | 2026-09-09T14:00:00Z | 2026-09-09T19:00:00Z | PASS |
| QQQ | 1d | 200 | 6 | 2026-09-01T04:00:00Z | 2026-09-09T04:00:00Z | PASS |
| IWM | 1m | 200 | 388 | 2026-09-09T13:30:00Z | 2026-09-09T19:59:00Z | PASS |
| IWM | 5m | 200 | 78 | 2026-09-09T13:30:00Z | 2026-09-09T19:55:00Z | PASS |
| IWM | 15m | 200 | 26 | 2026-09-09T13:30:00Z | 2026-09-09T19:45:00Z | PASS |
| IWM | 30m | 200 | 13 | 2026-09-09T13:30:00Z | 2026-09-09T19:30:00Z | PASS |
| IWM | 1h | 200 | 6 | 2026-09-09T14:00:00Z | 2026-09-09T19:00:00Z | PASS |
| IWM | 1d | 200 | 6 | 2026-09-01T04:00:00Z | 2026-09-09T04:00:00Z | PASS |
| DIA | 1m | 200 | 210 | 2026-09-09T13:30:00Z | 2026-09-09T19:59:00Z | PASS |
| DIA | 5m | 200 | 75 | 2026-09-09T13:30:00Z | 2026-09-09T19:55:00Z | PASS |
| DIA | 15m | 200 | 26 | 2026-09-09T13:30:00Z | 2026-09-09T19:45:00Z | PASS |
| DIA | 30m | 200 | 13 | 2026-09-09T13:30:00Z | 2026-09-09T19:30:00Z | PASS |
| DIA | 1h | 200 | 6 | 2026-09-09T14:00:00Z | 2026-09-09T19:00:00Z | PASS |
| DIA | 1d | 200 | 6 | 2026-09-01T04:00:00Z | 2026-09-09T04:00:00Z | PASS |

Historical result: **48/48 PASS; 8/8 symbols PASS**.

## Official WebSocket and application SSE

- Official `wss://stream.data.alpaca.markets/v2/iex`: connected, authenticated
  and subscription acknowledgement contained AAPL, NVDA, MSFT, TSLA, SPY and
  QQQ. No trade event arrived while the provider clock reported market closed.
- Six simultaneous application SSE streams all returned HTTP 200 and reached
  `AUTHENTICATED` and `SUBSCRIBED` through one shared provider socket. None
  emitted a candle without an actual provider trade.
- After all streams closed, reopening AAPL reached `AUTHENTICATED` and
  `SUBSCRIBED` again. Unit tests also prove last-timeframe unsubscribe and
  provider socket cleanup.
- Alpaca Basic permits one connection. A direct QA attempt made while the browser
  QQQ stream was intentionally open was rejected; after switching the browser to
  Coinbase and releasing that socket, direct official auth/subscription passed.

## Browser QA

- Symbol Search `All` displayed real crypto plus the bounded approved Alpaca set.
- Stocks displayed AAPL, NVDA, MSFT and TSLA; ETFs displayed SPY, QQQ, IWM and
  DIA. Every required row used its approved local icon.
- Normal rows contained ticker and company/fund name only; neither `Alpaca` nor
  `IEX` appeared in row text.
- AAPL rendered real historical candles for 1m, 5m, 15m, 30m, 1h and 1D.
  NVDA, SPY and QQQ also rendered real 1m history after symbol switching.
- Symbol/timeframe switching showed no stale symbol candle and no market-data
  error. Final browser state is QQQ 1m with 300 real historical candles.
- Realtime label remained `Waiting`, not `Live`, because no provider trade arrived
  during the closed market.

## Verification

- Backend targeted Alpaca tests: PASS.
- Canonical backend disposable PostgreSQL harness: 348 discovered, 345 passed,
  3 Redis-dependent skipped, 0 failed; `bootJar` and dependency inventory PASS.
- One earlier full backend run overlapped the CPU-heavy frontend suite and had
  four database statement timeouts. Both affected classes passed alone and the
  canonical backend-only rerun passed completely; no code was changed to weaken
  those tests.
- Frontend: 57 files, 322/322 tests PASS.
- ESLint: PASS.
- TypeScript and Vite production build: PASS. Existing chunk-size warning only.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `git diff --check`: PASS.

## Required result matrix

| Symbol | Catalog | Icon | Historical | WS Auth | Live Event | Candle Update | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AAPL | PASS | PASS | PASS 6/6; browser PASS | PASS | PASS | PASS | PASS |
| NVDA | PASS | PASS | PASS 6/6; browser PASS | PASS shared IEX | PASS | PASS | PASS |
| SPY | PASS | PASS | PASS 6/6; browser PASS | PASS shared IEX | PASS | PASS | PASS |
| QQQ | PASS | PASS | PASS 6/6; browser PASS | PASS shared IEX | PASS | PASS | PASS |

## Final result

- Credential, account, catalog, Stocks, ETFs, 48-case historical, realtime auth,
  reconnect, browser, icons, backend tests, frontend tests, lint and build: PASS.
- Actual realtime event and realtime candle update: **PASS** in the market-open
  follow-up below.
- Global result: **PASS** for the requested authenticated Alpaca PB-038 scope.

## Market-open follow-up — 10/09/2026 21:01–21:15 Asia/Ho_Chi_Minh

- Root cause: `AlpacaStreamProvider.Hub.accept()` aggregated each real trade,
  published `LIVE`, and stored the current bar in Redis, but did not publish the
  SSE `candle` event. The browser therefore remained at `Connected` even though
  Redis already contained the current NVDA bar.
- Fix: each accepted, deduplicated provider trade now publishes the current
  partial candle to all matching SSE clients before storing the same snapshot in
  Redis. No history polling or mock event is used.
- The repository-owned backend lifecycle manager restarted from the rebuilt JAR,
  preserving its database and configured environment. Health returned `UP`.
- Browser Symbol Search retained correct local icons and did not expose Alpaca or
  IEX in normal AAPL, NVDA, SPY or QQQ rows.
- Browser actual-provider observations:

| Symbol | Browser timeframe | First provider tick UTC | Later provider tick UTC | Observed current price | Candle/volume update | Result |
| --- | --- | --- | --- | ---: | --- | --- |
| AAPL | 30m | 14:06:04 | 14:06:15 | 319.71 | OHLC updated; volume 1.37K | PASS |
| NVDA | 1m | 14:03:23 | 14:03:27 | 218.21 | OHLC updated; volume 649 | PASS |
| SPY | 30m | 14:04:33 | 14:04:43 | 757.41 | OHLC updated; volume 634 | PASS |
| QQQ | 30m | 14:04:59 | 14:05:40 | 708.89 | OHLC updated; volume 322 | PASS |

- Redis current-bar keys for `AAPL|30m`, `NVDA|1m`, `SPY|30m` and `QQQ|30m`
  all existed after their browser provider events. Observed TTLs were between 82
  and 299 seconds and payload lengths were 178–179 bytes; values and credentials
  were not printed.
- Symbol switching exercised unsubscribe/cleanup by moving NVDA → SPY → QQQ →
  AAPL. Each new symbol received only its own candle and reached `Live`; no stale
  previous-symbol candle appeared.
- Focused backend regression: 8 tests, 0 failed/error/skipped. The new regression
  requires an accepted trade to produce both SSE status and candle sends and a
  five-minute Redis current-bar write.
- Full backend: 49 suites, 354 tests, 0 failed/error, 3 Redis integration tests
  skipped because the canonical disposable PostgreSQL command did not start an
  owned Redis instance; `bootJar` and dependency inventory PASS. The already
  running Redis relay was independently verified above.
- Full frontend: 57 files, 336 tests PASS; ESLint, production build and production
  dependency audit PASS with zero vulnerabilities. Existing bundle-size warning
  only.
