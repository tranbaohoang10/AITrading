# PB-038 — Test cases

Issue: [#39](https://github.com/tranbaohoang10/AITrading/issues/39)

| ID | AC | Category | Scenario | Expected result |
| --- | --- | --- | --- | --- |
| TC-01 | 01–05 | Provider/audit | Inspect discovery candidates and official entitlement records | Each candidate has source, limits, history, mode, display rights and honest status; discovery lists are not runtime feeds. |
| TC-02 | 02–05 | Integration | Parse Coinbase and Alpaca payload fixtures into neutral Candle/Instrument | Invalid shape/value/time is rejected; mapping preserves UTC, feed, exchange, precision and mode. |
| TC-03 | 03,17,18 | Security | Start provider with missing/partial Alpaca secrets; inspect client bundle/logs | Crypto stays usable; stock/ETF is unavailable; no secret appears in response, bundle, error or log. |
| TC-04 | 05,18 | Resilience | Repeat identical history/metadata requests, receive 429/retry-after, abort stale selection, remove cell, and block direct Coinbase access | Requests dedupe, cache is bounded, retry is capped/backoff-aware, stale work aborts and streams close at zero refs; authenticated same-origin proxy or bounded `DELAYED` polling keeps the chart usable. |
| TC-05 | 06 | Layout/UI | Render 1/2H/2V/4/8 and resize/double-click splitters | Each requested layout fills the available workspace; 2H has no lower blank row; active cell is unique. |
| TC-06 | 07,08 | Navigation | Render 20k loaded bars; zoom at middle/right edge; drag left past latest; append realtime candle | Initial visible count is width-derived; pointer anchor remains stable; bounded blank future appears without fake candles; realtime preserves manual view. |
| TC-07 | 08,10,16 | Drawings | Create/delete/move/edit/clear drawing; Ctrl+Z/Y/Shift+Z; future time anchor; type in text field | History restores exact drawing state; text inputs are not intercepted; future anchor remains semantic after prepend/realtime. |
| TC-08 | 11,12 | Indicators | Open picker, search aliases, star/unstar, add overlay and oscillator studies | Modal library/category/source states work; favorites persist locally; formulas and pane placement match tests; empty Community is truthful. |
| TC-09 | 13,14 | Search/format | Search btc/apple/nvidia/name/exchange; low-price, BTC, stock and FX fixture precision | Results are debounced/bounded/provider-filtered; unsupported tabs hidden; one formatter is used across chart surfaces. |
| TC-10 | 09,15 | Time/settings | Tick clock, choose UTC/Exchange/Local/IANA timezone, open gear and all context menus | Clock updates without chart recomputation; storage remains UTC; only implemented settings/actions are enabled; Escape/outside closes menus. |
| TC-11 | 16 | Regression/security | Run Assistant, AI Capture, Strategy DSL, backtest, journal, Coinbase and authorization suites | Existing workflows remain green; no live order, schema, auth or ownership regression. |
| TC-12 | DoD | Build/QA | Run frontend/backend checks and real browser QA at desktop/tablet/mobile | Commands exit 0 where applicable; unavailable external credential/provider evidence is BLOCKED, not relabelled PASS. |

## Security applicability

Applicable: untrusted provider JSON, fixed outbound hosts/SSRF, secret isolation,
rate/resource limits, XSS-safe labels, stale/race cleanup and denial of unsupported
categories. Existing authenticated/private API ownership/CSRF contracts remain a
regression surface. SQL injection, password/auth semantics and database migration
are N/A for read-only provider data unless a new route accidentally crosses that
boundary; such a route must add targeted tests before acceptance.

## Execution results

To be appended after implementation. `PASS` requires actual command/evidence;
unavailable credentials or provider access remain `BLOCKED` with the exact reason.

## Execution results — 04/09/2026 (Asia/Ho_Chi_Minh)

| Case | Result | Evidence and limitation |
| --- | --- | --- |
| TC-01 | PASS | Provider audit committed in `docs/market-data/free-provider-audit.md`; discovery repositories are recorded as reference-only and official links/terms are attached. |
| TC-02 | PASS | Coinbase existing adapter plus `AlpacaMarketDataMapperTests` passed with strict OHLCV/timestamp/dedupe/20k-bound validation. |
| TC-03 | PASS | Alpaca credentials are read only from server environment placeholders; browser adapter sends same-origin requests and never receives secret values. Missing configuration returns `ALPACA_UNCONFIGURED`; no secret was read or added to the repository. |
| TC-04 | PARTIAL | Frontend has bounded history cache, shared in-flight dedupe, abort release and active-cell subscription cleanup; backend caches the Alpaca asset snapshot for 5 minutes and caps responses. Cross-cell subscription fan-out and a provider-wide rate limiter remain unverified/unfinished. |
| TC-05 | PASS | Chrome browser QA observed layouts `1`, `2H`, `2V`, `4`, `8`, active-cell state, directional splitters and implemented reset handlers. Desktop browser evidence is recorded separately; tablet/mobile viewport QA was not available through the current CUA surface. |
| TC-06 | PASS | Existing chart tests and browser QA covered width-derived visible density, zoom/pan/future blank area, and Coinbase live updates; no synthetic future candles are generated. |
| TC-07 | PASS | Existing drawing regression suite plus browser context-menu/toolbar review passed; undo/redo shortcuts/buttons and semantic future anchors remain wired. |
| TC-08 | PASS | `npm test` covered formulas and existing chart regressions; browser QA opened the library, verified Favorites/My Indicators/Built-ins/AI Quant/AITrading Community, added Stochastic, then removed it. |
| TC-09 | PASS | Symbol Search browser QA filtered `ETH`, showed Coinbase/provider-feed metadata, and settings/browser review verified precision controls. Category tabs now derive from returned instruments, so unconfigured Forex/Futures/Stocks/ETFs are not presented. Imported datasets preserve their source precision by inference when no instrument metadata exists. |
| TC-10 | PASS | Browser QA changed UTC/Local and restored UTC; clock/settings/context menu flows rendered and dismissed. |
| TC-11 | PASS | Frontend regression suite: 34 files, 247 tests passed. No database migration was added. |
| TC-12 | PARTIAL | Frontend tests and build passed; backend mapper test passed. GitHub workflow `33928030727` confirms the frontend job PASS after the lint hotfix. Its backend job fails at the pre-existing readiness check `migration ledger must bind V1–V18`, matching baseline workflow `33883471637` before PB-038; no migration/test was changed to hide it. Full backend harness is also BLOCKED locally: direct run requires `AITRADING_TEST_CLUSTER`, while the disposable-copy harness ran 292 tests with 86 failures because the copied fixture set omitted repository `specs/` inputs and AI-provider tests were intentionally disabled. A real Alpaca request is BLOCKED because no credentials were configured. |

### Commands

- `frontend`: `npm test -- --run --reporter=dot --no-file-parallelism --configLoader runner` → exit 0, 34/34 files and 247/247 tests.
- `frontend`: `npm run build` → exit 0; Vite emitted only the existing bundle-size warning (550.84 kB minified JS).
- `backend`: `./gradlew test --no-daemon --console=plain --tests com.aitrading.AlpacaMarketDataMapperTests` → exit 0, `BUILD SUCCESSFUL`.
- `git diff --check` → exit 0; only normal Git LF/CRLF conversion warnings were emitted.

## Execution results — 05/09/2026 (Asia/Ho_Chi_Minh)

| Case | Result | Evidence and limitation |
| --- | --- | --- |
| TC-02 | PASS | `CoinbaseMarketDataClientTests`: 3/3 passed. The client validates symbol, granularity, range, provider array shape, response size and 429 handling; authenticated local proxy returned HTTP 200 with 20,617 bytes for BTC-USD 1m. |
| TC-04 | PASS | Frontend provider tests covered REST timeout/retry, realtime-before-history, WebSocket cleanup and the 5-second fallback to authenticated same-origin polling. The browser extension blocked direct public Coinbase URLs, while the proxy path remained usable. |
| TC-08 | PASS | Chrome desktop showed `Indicators ^` horizontally; opening the picker exposed built-ins and selecting SMA followed by RSI left both indicators in the active legend/panes. |
| TC-11 | PASS | Full frontend regression: 34 files, 251 tests passed. |
| TC-12 | PARTIAL | `npm run lint`, `npm run build`, and `npm audit --audit-level=high` passed. Desktop browser evidence passed; tablet/mobile viewport remains unavailable through the current CUA surface. Full backend CI still has the previously recorded V1–V18 migration-ledger baseline failure and is not relabelled PASS. |

### Commands

- `frontend`: `npm test -- --run --maxWorkers=1 --minWorkers=1` → exit 0, 34/34 files and 251/251 tests.
- `frontend`: `npm run lint` → exit 0.
- `frontend`: `npm run build` → exit 0; existing bundle-size warning only (558.20 kB minified JS).
- `frontend`: `npm audit --audit-level=high` → exit 0, 0 vulnerabilities.
- `backend`: `./gradlew.bat test --tests com.aitrading.market.CoinbaseMarketDataClientTests --no-daemon --console=plain` → exit 0, 3/3 tests.
- Authenticated local proxy request `GET /api/market/coinbase/series/BTC-USD/60` → HTTP 200, 20,617 bytes.

### Browser evidence

Chrome at `http://127.0.0.1:5173/` showed live Coinbase candles with `COINBASE · PUBLIC · LIVE`, Symbol Search, ETH selection, indicator library, settings/timezone, right-click chart menu, layouts and splitters. The final state was restored to BTC-USD / UTC / one chart with temporary Stochastic removed. No Alpaca real request was claimed.

## Main integration recovery — 05/09/2026 (Asia/Ho_Chi_Minh)

The local screenshot that triggered the recovery was serving `main` before the two
PB-038 chart commits had been integrated. Both commits were applied to `main` as
`c455d92` and pushed to `origin/main`.

- `npm exec -- vitest run src/market/liveMarket.test.ts src/Workspace.test.tsx` → exit 0, 22/22 tests.
- `npm run build` and `npm run lint` → exit 0; Vite emitted only the existing bundle-size warning.
- `npm audit --audit-level=high` → exit 0, 0 vulnerabilities.
- `./gradlew.bat test --tests com.aitrading.market.CoinbaseMarketDataClientTests --no-daemon --console=plain` → `BUILD SUCCESSFUL`.
- A synthetic local QA account made an authenticated request to `GET /api/market/coinbase/series/BTC-USD/60`; the same-origin proxy returned 350 Coinbase candles.

The disposable local backend was restarted to load the new JAR. Its previous
database and session cookies are intentionally not retained, so a browser tab
that was open before the restart must reload and sign in or create a local test
account again before it can call authenticated market endpoints.

## Toolbar and unauthenticated chart recovery — 05/09/2026 (Asia/Ho_Chi_Minh)

- Symbol is a single compact trigger that opens Symbol Search; the native browser select list is no longer used.
- Timeframe is a compact custom menu. Symbol, Timeframe and Indicators have transparent resting states and only receive a subdued background on hover/focus. Indicators uses a down-facing chevron and remains multi-select.
- `GET /api/market/coinbase/**` is now public read-only data, constrained by the existing Coinbase symbol/granularity/range validation and an IP rate limit of 180 requests per 15 minutes. Private datasets and all write operations remain authenticated.
- The first public rate-limit key exceeded the persisted 80-character limit and returned `UNAVAILABLE`; the bucket key was shortened and a regression test now checks that it fits the column.
- A no-session local request to `GET /api/market/coinbase/series/BTC-USD/60` returned HTTP 200 with 350 candles after the fix.

## Forex reference feed and Symbol Search icons — 05/09/2026 (Asia/Ho_Chi_Minh)

| Case | Result | Evidence and limitation |
| --- | --- | --- |
| TC-01 | PASS | Official Frankfurter documentation establishes its no-key API, daily historical data, provider filtering and commercial-use statement. Direct query pinned to ECB returned EUR/USD reference rows. Stooq was rejected after every intended CSV endpoint returned anti-bot HTML rather than a stable API response. |
| TC-02 | PASS | `FrankfurterMarketDataClientTests` verify fixed-pair validation, fixed host/query, malformed-row rejection, provider 429 handling and honest equal O/H/L/C with zero volume for a daily reference observation. |
| TC-03 | PASS | Frankfurter requires no key. The browser reaches only a same-origin Spring endpoint; no upstream URL or secret is accepted from UI input. |
| TC-04 | PASS | Backend restricts seven pairs, 600 rows, date range and one hard-coded HTTPS host; public read-only route reuses the existing IP request bucket. Frontend polls the delayed daily reference at 15-minute intervals only. |
| TC-09 | PASS | Symbol Search browser inspection showed crypto badges, a Forex tab, seven currency-flag icons and `ECB · EOD` labels. Component test selects EUR/USD, automatically switches to 1D and disables intraday choices. |
| TC-12 | PASS | Targeted frontend regression: 4 files/25 tests; `npm run lint` and `npm run build` passed. Backend market/auth tests passed. Local `GET /api/market/frankfurter/candles?symbol=EUR-USD&limit=10` returned HTTP 200 and ten valid reference candles. |

### Commands

- `frontend`: `npm exec -- vitest run src/market/FrankfurterMarketDataProvider.test.ts src/market/LiveChartForex.test.tsx src/market/liveMarket.test.ts src/Workspace.test.tsx` → exit 0, 4 files/25 tests.
- `frontend`: `npm run lint; npm run build` → exit 0; Vite reported only the existing >500 kB bundle-size warning.
- `backend`: `./gradlew.bat test --tests com.aitrading.market.FrankfurterMarketDataClientTests --tests com.aitrading.market.CoinbaseMarketDataClientTests --tests com.aitrading.auth.AuthRateLimiterTests --no-daemon --console=plain` → exit 0, `BUILD SUCCESSFUL`.
- `local integration`: `GET /api/market/frankfurter/candles?symbol=EUR-USD&limit=10` → HTTP 200; 10 UTC daily candles, values `open=high=low=close`, `volume=0` as declared reference-point semantics.

## Loading recovery and recognizable crypto logos — 05/09/2026 (Asia/Ho_Chi_Minh)

| Case | Result | Evidence and limitation |
| --- | --- | --- |
| TC-04 | PASS | A deliberately never-settling history provider now reaches the explicit 12-second deadline, removes the stale in-flight request, presents a safe retryable error and enables `Retry market data`. The request cache also rejects an aborted or expired shared entry before a new selection can reuse it. |
| TC-09 | PASS | Symbol Search renders inline, accessible SVG marks for BTC, ETH, SOL, XRP, ADA, DOGE, LTC, BCH, LINK, AVAX and POL. Ethereum is asserted as a multi-facet vector icon rather than the former `Ξ` text badge. Other catalog assets receive a neutral crypto glyph instead of an arbitrary letter. |
| TC-12 | PASS | Targeted frontend regression passed 19/19 tests and production build completed. Vite emitted only its existing chunk-size warning. The same-origin Coinbase range route returned 300 rows locally. |

### Commands

- `frontend`: `npm test -- --run src/market/liveMarket.test.ts src/market/LiveChartForex.test.tsx` → exit 0, 19/19 tests.
- `frontend`: `npm run build` → exit 0; existing >500 kB bundle warning only.
- `local integration`: `GET /api/market/coinbase/series/BTC-USD/60/1788593168716/1788611168716` through Vite proxy → HTTP 200; 300 Coinbase OHLCV rows.

### Runtime note

The automated in-app browser pauses page timers while its control surface is idle, so it cannot truthfully time a 12-second browser deadline. It did confirm the refreshed Symbol Search catalog and ETH/SOL/XRP/etc. icon controls. The deadline behavior is covered by the deterministic React test above; a normal interactive browser is not timer-paused.
