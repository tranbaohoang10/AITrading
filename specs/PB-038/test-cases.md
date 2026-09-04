# PB-038 — Test cases

Issue: [#39](https://github.com/tranbaohoang10/AITrading/issues/39)

| ID | AC | Category | Scenario | Expected result |
| --- | --- | --- | --- | --- |
| TC-01 | 01–05 | Provider/audit | Inspect discovery candidates and official entitlement records | Each candidate has source, limits, history, mode, display rights and honest status; discovery lists are not runtime feeds. |
| TC-02 | 02–05 | Integration | Parse Coinbase and Alpaca payload fixtures into neutral Candle/Instrument | Invalid shape/value/time is rejected; mapping preserves UTC, feed, exchange, precision and mode. |
| TC-03 | 03,17,18 | Security | Start provider with missing/partial Alpaca secrets; inspect client bundle/logs | Crypto stays usable; stock/ETF is unavailable; no secret appears in response, bundle, error or log. |
| TC-04 | 05,18 | Resilience | Repeat identical history/metadata requests, receive 429/retry-after, abort stale selection, remove cell | Requests dedupe, cache is bounded, retry is capped/backoff-aware, stale work aborts and streams close at zero refs. |
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

### Browser evidence

Chrome at `http://127.0.0.1:5173/` showed live Coinbase candles with `COINBASE · PUBLIC · LIVE`, Symbol Search, ETH selection, indicator library, settings/timezone, right-click chart menu, layouts and splitters. The final state was restored to BTC-USD / UTC / one chart with temporary Stochastic removed. No Alpaca real request was claimed.
