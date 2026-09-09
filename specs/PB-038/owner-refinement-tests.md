# Product Owner refinement verification — 09/09/2026

Status: PARTIAL / IN_PROGRESS, not DONE. Issue #39. Source baseline 0cc370b87af09d5e47c1ae8134b277d1b8510a8f.

## Requirement reconciliation
Provider badges/technical text in normal Symbol Search and hidden unsupported categories are superseded. Seven categories remain, with truthful empty states. A four-coin icon/query allowlist is not a completed catalog. Current wall-clock belongs below the right-axis price and in the desktop toolbar. City labels use dynamic Intl/IANA offsets; raw UTC data is unchanged.

## Implemented and verified locally
- Actual paginated Coinbase discovery beyond four symbols, bounded at 400 pages with repeated-cursor rejection and abort cleanup. Licensed local ADA/DOGE/LINK/AVAX/LTC/BCH/USDT assets added.
- Canonical grouping retains candidate routes and keeps USD distinct from USDT. Historical catalog access is not equivalent to live readiness. Live picker still excludes historical-only routes.
- Memoized current-price SVG badge owns its one-second clock; parent geometry does not rerender from those ticks. Real chart integration is asserted, not merely a standalone component.
- Curated timezone list: UTC/Exchange/Local then offset/city order; seasonal New York, London, Sydney, Auckland; Mumbai half-hour; UTC-midnight preservation. Exchange metadata validation and unknown Exchange disabled.
- Realtime telemetry timestamps use the chart timezone, not the machine timezone.
- Distinct original gold, silver and oil illustrations are available but do not create fabricated market listings.

## Evidence boundaries
08/09 screenshots under test-evidence/owner-refinement show desktop/tablet/mobile current-price clocks, expanded actual Coinbase catalog and selected Ho Chi Minh timezone. They do not prove the later 09/09 changes or non-Coinbase feeds.
Full backend disposable harness on 09/09: clean/test/bootJar/dependencyInventory BUILD SUCCESSFUL, exit 0. No existing data was deleted.
Frontend is being rerun after the last commodity/Exchange changes; older 305-test PASS does not certify those later edits.

## Unfinished versus external blockers
| Scope | State | Exact remaining work |
| --- | --- | --- |
| Coinbase | QA in progress | Per-symbol actual event/update evidence for required BTC/ETH/SOL/XRP/ADA/DOGE |
| Alpaca | NOT IMPLEMENTED for realtime | Existing adapter polls historical bars; genuine authenticated IEX stream and stock/ETF icons still need implementation and real credentials/entitlement QA |
| OANDA | NOT IMPLEMENTED + EXTERNAL audit blocked | No adapter or account catalog. Official API site connection refused on 09/09; need verified current API/terms and authorized practice-account catalog |
| cTrader | NOT IMPLEMENTED + EXTERNAL audit blocked | No adapter or authenticated catalog. Official API documentation connection refused on 09/09; app/account authorization and actual symbol metadata required |
| XAU/XAG/USOIL/Forex | BLOCKED_EXTERNAL for live proof | No verified configured account route; original commodity icons and flags alone are not PASS |
| Binance/Frankfurter | Historical-only | Preserve history/Replay semantics; never label archive/EOD as realtime |
| Futures | BLOCKED_EXTERNAL | No approved real exchange-futures realtime route; CFDs must not be mapped to futures |

Cannot claim IMPLEMENTATION COMPLETE — EXTERNAL CREDENTIALS REQUIRED: provider code remains unfinished. Do not close Issue #39.

## Security and data model
No DB migration or Redis/session architecture changes. Provider identity stays in existing backend cache keys. No broker orders, secret values, arbitrary endpoints or frontend credentials added. SVGs are local, with fragment-only references. Existing auth, account binding, Replay identity and UTC storage are retained.

## 09/09 final verification update

- Full frontend after cache refinement: pending final run below; earlier full run passed 311 tests.
- Full backend: 333 discovered, 330 passed, 3 Redis-only cases skipped in the default harness. The three Redis integration cases were then run explicitly against owned disposable Redis on loopback 6387: BUILD SUCCESSFUL, exit 0.
- Java dependency audit: OSV querybatch, 144 resolved dependencies, zero findings, exit 0. Production npm audit: zero vulnerabilities. Readiness/secret scan passed; its legacy currentFeature DONE field does not represent this new refinement.
- Browser diagnosed repeated catalog requests exhausting the existing 60 requests / 15 minutes account quota. Final fix caches validated pages for five minutes within the account-bound provider instance and performs ticker filtering locally. Existing limiter remains unchanged.
- Canonical compact ticker searches such as ETHUSD match ETH/USD. Cache TTL and separate-account tests pass.
- Remaining adapter and credential limitations in the table above still apply; no full-feature completion claim.

## Required symbol status

| Symbol | Icon | Historical/live | Result |
| --- | --- | --- | --- |
| BTCUSD, ETHUSD, SOLUSD, XRPUSD, ADAUSD, DOGEUSD | Local licensed token logos | Real Coinbase candles and events observed; latest rerun evidence in owner-refinement-09 | See final browser JSON |
| XAUUSD | Original gold SVG | No verified configured OANDA/cTrader route | BLOCKED_EXTERNAL (adapter also unfinished) |
| XAGUSD | Original silver SVG | No verified configured OANDA/cTrader route | BLOCKED_EXTERNAL (adapter also unfinished) |
| USOIL | Original oil SVG | No verified account mapping | BLOCKED_EXTERNAL (adapter also unfinished) |
| EURUSD, GBPUSD, USDJPY | Currency flags | Frankfurter EOD is not realtime; authorized trading feed absent | BLOCKED_EXTERNAL (adapter also unfinished) |
| AAPL, NVDA, SPY, QQQ | Required stock/ETF icons unfinished | Existing Alpaca history; realtime adapter unfinished and credentials absent | FAIL / BLOCKED_EXTERNAL |

## Provider status

| Provider | Adapter | Configured | Realtime | Status |
| --- | --- | --- | --- | --- |
| Coinbase | History + backend SSE | Public | Actual events | Live QA performed |
| Binance | Historical archive | Public | Not implemented | HISTORICAL_ONLY |
| Alpaca | Historical / polling | No credentials | Not implemented | PARTIAL / BLOCKED_EXTERNAL |
| OANDA | Not implemented | No account route | Not implemented | PARTIAL / BLOCKED_EXTERNAL |
| cTrader | Not implemented | No approved app/account route | Not implemented | PARTIAL / BLOCKED_EXTERNAL |
| Frankfurter | Reference history | Public | Intentionally unsupported | EOD_ONLY |

### Latest automated run

09/09/2026: `npm --prefix frontend test -- --maxWorkers=1` passed 55 files / 311 tests, exit 0. `npm --prefix frontend run lint` and `npm --prefix frontend run build` exit 0; only the pre-existing bundle-size warning remains. The earlier immediate timeframe assertion was updated to await the asynchronous rendered result without changing its expected 25 candles or API-call assertion.

Browser rerun is deliberately waiting for the existing account quota window after previous QA runs; no account change, rate-limit override or security bypass is used. Screenshots are observations of local synthetic-user sessions with actual public Coinbase data, not mocked provider events.

### Shared clock verification — 09/09/2026

Toolbar and current-price badge now subscribe to one second-boundary clock through useSyncExternalStore. Different mount times no longer create independent timer phases. Only clock consumers update; the parent geometry isolation test remains passing. The shared timer is removed when the last consumer unmounts.

Verification: npm --prefix frontend test -- --maxWorkers=1: exit 0, 55 files / 312 tests passed (tmp/pb038-clock-sync-tests.log). ESLint, TypeScript/Vite build and git diff --check passed; the existing bundle-size warning remains. Added staggered-mount synchronization and shared-timer cleanup assertions. Prior browser screenshots predate this synchronization patch and are not new browser verification of it.

Delivery remains PARTIAL: genuine Alpaca streaming, OANDA and cTrader adapters and required stock/ETF icons remain unfinished code, independently of missing account credentials. Issue #39 must remain open. No commit or push is claimed for this verification entry.

## Provider completion verification — 09/09/2026

This append-only entry supersedes the unfinished-state tables above without
rewriting their historical evidence. The provider implementation is now complete
locally; authenticated Alpaca/OANDA/cTrader market events remain external QA
blockers because no credentials or account entitlements are configured.

### Completed implementation

- Alpaca: server-side IEX WebSocket authentication and trade subscription,
  validated trade mapping, OHLCV aggregation, shared SSE hubs, provider-isolated
  Redis state, authentication timeout and bounded exponential reconnect.
- OANDA: configured-account instrument catalog, bounded midpoint candle paging,
  pricing stream, midpoint candle aggregation and actual `WTICO_USD` -> `USOIL`
  alias only when returned by the account. Unsupported index/equity CFDs are not
  mislabeled as commodities.
- cTrader: TLS hostname-verified Open API session, application/account auth,
  broker/account symbol discovery, bounded protobuf frames, trendbars and spot
  subscriptions. Only supported fiat pairs and metal/oil commodities are exposed;
  crypto/index CFDs are not mislabeled as Forex.
- Symbol Search: provider/feed names remain hidden, seven categories remain, and
  a five-minute bounded cache is shared only by remounts of the same account.
  Desktop/tablet/mobile remounts no longer reload the full catalog or cause 429.
- Icons: required stock, ETF, crypto, Forex and commodity icon paths are local,
  deterministic and documented in `docs/market-data/icon-sources.md`.

### Provider truth table

| Provider | Implementation | Configured | Real authenticated event QA | Result |
| --- | --- | --- | --- | --- |
| Coinbase | History + backend trade SSE | YES (public) | BTC/ETH/SOL/XRP/ADA/DOGE observed | PASS |
| Binance | Historical archive only | YES (public) | Not a realtime route | HISTORICAL_ONLY |
| Frankfurter | Daily reference history only | YES (public) | Not a realtime route | EOD_ONLY |
| Alpaca | History + IEX trade WebSocket | NO | Requires credentials and display entitlement | BLOCKED_EXTERNAL |
| OANDA | Account catalog + candles + pricing stream | NO | Requires authorized account and token | BLOCKED_EXTERNAL |
| cTrader | Auth + account catalog + trendbars + spots | NO | Requires approved app/token/account | BLOCKED_EXTERNAL |

### Browser and network evidence

- Headless Chrome at 1440x900, 1024x900 and 390x844: chart and Symbol Search
  rendered; current-price clock and toolbar clock advanced and matched exactly;
  provider labels were absent; approved icons loaded.
- UTC, Asia/Ho_Chi_Minh, America/New_York, Exchange and Local produced synchronized
  toolbar/right-axis wall-clock values. Candle identities remained UTC.
- BTC/USD, ETH/USD, SOL/USD, XRP/USD, ADA/USD and DOGE/USD each reached
  `REALTIME · Live`, received actual Coinbase events and changed the current candle.
- Final run recorded 26 market responses, all HTTP 200, no page errors and no 429.
  Evidence: `test-evidence/owner-refinement-09/browser-qa.json` and adjacent PNGs.
- Capabilities reported `configured=false` for Alpaca, OANDA and cTrader. No mock
  or historical poll was counted as a real provider PASS.

### Final verification

- Frontend: 55 files / 316 tests PASS; ESLint PASS; TypeScript/Vite build PASS.
  The existing >500 kB bundle warning remains informational.
- Backend disposable PostgreSQL harness: 48 suites / 342 tests discovered,
  339 passed, 3 Redis tests skipped, zero failures/errors; bootJar and dependency
  inventory PASS.
- Redis integration: the three skipped-by-default Redis tests PASS separately
  against owned disposable Redis 8.4.2 on port 6387; no persistence; service
  shutdown and free port verified afterward.
- Security/dependencies: production npm audit zero vulnerabilities; OSV scanned
  144 Java dependencies with zero findings; readiness PASS and secret scan covered
  950 text files. The PB-023-only security smoke tool rejected a PB-038 report
  path by design, so its historical evidence was not overwritten.

### External credentials still required

| Provider | Required variable | Configured | What remains | QA enabled after supply |
| --- | --- | --- | --- | --- |
| Alpaca | `ALPACA_API_KEY_ID`, `ALPACA_API_SECRET_KEY` | NO | Authorized Market Data account and applicable IEX/display entitlement | Asset catalog, history, auth, actual AAPL/SPY trade events, candle update and reconnect |
| OANDA | `OANDA_API_TOKEN`, `OANDA_ACCOUNT_ID`, `OANDA_ENVIRONMENT` | NO | Authorized practice/live account whose actual catalog contains requested instruments and permits display | EURUSD/GBPUSD/USDJPY and available metals/oil history, pricing events, candle update and reconnect |
| cTrader | `CTRADER_CLIENT_ID`, `CTRADER_CLIENT_SECRET`, `CTRADER_ACCESS_TOKEN`, `CTRADER_ACCOUNT_ID`, `CTRADER_ENVIRONMENT` | NO | Approved Open API app, OAuth token and authorized demo/live broker account | Broker catalog, trendbars, actual spot events, supported Forex/commodity candle update and reconnect |

Final local status: **IMPLEMENTATION COMPLETE — EXTERNAL CREDENTIALS REQUIRED**.
Issue #39 remains OPEN because the Definition of Done requires genuine
authenticated events for the three conditional providers before DONE/closure.

## Chart interaction correction — 09/09/2026

The Product Owner clarified from the supplied screenshots that Position Setup
must remain an inline chart planning surface, Bar Replay must select its starting
candle directly on the chart, and the realtime badge must not hide the current
price. This correction preserves the existing Replay simulation workspace and
provider adapters; it does not add broker execution or a new data source.

### Delivered behavior

- Position Setup opens below the chart rail button and exposes Long/Short, Entry,
  Stop Loss %, Take Profit %, default capital and Account % or Lot/quantity sizing.
  It calculates Entry/SL/TP/quantity/risk/reward and emits one visual position
  drawing. It does not navigate to or create a Replay session.
- Bar Replay launcher no longer contains Day/Month/calendar/coverage fields.
  Selecting the toolbar action enters candle-selection mode on the active chart;
  the selected candle receives a blue cut marker and candles to the right are
  dimmed as unrevealed. The inline confirmation starts the existing Replay using
  the selected candle as `from` and the latest loaded candle close as `to`.
- Realtime status now renders only a compact colored dot and state label. First
  tick, last tick, active candle and partial-candle details remain available in
  the element `title` and accessible name.

### Verification

- Targeted Vitest: 4 files / 11 tests PASS.
- Regression Vitest after updating the compact-status contract: 1 file / 17
  tests PASS.
- Full frontend Vitest: 56 files / 319 tests PASS.
- ESLint: PASS. TypeScript + Vite build: PASS; the existing >500 kB chunk warning
  remains informational. `npm audit --audit-level=high`: PASS, 0 vulnerabilities.
- `git diff --check`: PASS.
- Browser QA at `http://127.0.0.1:5173/`: Position Setup displayed all requested
  fields and calculations; Replay selected a real visible BTC/USD candle, rendered
  `Replay start`, exposed Start/choose/cancel controls and left the chart usable;
  the toolbar showed compact `Live` beside the current price. Browser console had
  zero warning/error entries after these interactions.

### Provider/account handoff

- Official registration/account pages were opened for Alpaca, OANDA, cTrader,
  Twelve Data and Alpha Vantage, plus the official Binance public-data repository.
- The Product Owner reported successful login to four provider sites. No password,
  token or API key was read, copied, entered into the application or committed.
- Coinbase and Binance public data require no account for the already implemented
  public routes; Frankfurter remains no-key daily ECB reference data.
- Alpaca, OANDA and cTrader remain the conditional runtime integrations because
  their backend adapters are implemented and their credentials/entitlements are
  required for authenticated browser evidence. Twelve Data remains RESEARCH_ONLY
  for this human-visible chart under the audited individual-plan display terms;
  Alpha Vantage remains rejected for active multi-chart use under its standard
  free request limit and realtime entitlement constraints.

Final status after this correction remains
**IMPLEMENTATION COMPLETE — EXTERNAL CREDENTIALS REQUIRED**. Issue #39 stays OPEN
until authorized backend environment credentials and real authenticated provider
events are available; account login alone is not recorded as configured API access.
