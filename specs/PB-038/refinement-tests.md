# PB-038 refinement verification — 07/09/2026

Refs #39. Codex evidence, not independent approval. Issue remains OPEN while
Frankfurter live catalog and Alpaca credentials/display entitlement are blocked.
No Journal source or migration changed; synthetic Replay was confirmed and stepped
without closing a position. No broker endpoints were called.

## Acceptance and test results

| Case | Evidence | Result |
| --- | --- | --- |
| Replay toolbar Day/Month UTC calendar mapping, leap day, invalid date and coverage gate | ReplayLauncher.test.tsx; actual Coinbase 2026-08-01 hourly launch; Month maps 08-01 to 09-01 exclusive | PASS |
| Position Setup below More; Long/Short, revealed/manual entry, percentages and Quantity | Replay.test.tsx; browser Short risk 0.5%, SL 2%, TP 4%, risk 50 USD, R:R 2.00; CONFIRM then STEP -> OPEN | PASS within existing Replay |
| No draft API write; existing idempotency/uncertain retry and prefix | Existing Replay suites plus new draft test | PASS |
| No unverified Lot | Panel explanation, Binance parser test with null lot/contract size | PASS |
| Paginated search beyond 50, cursor bound to query, stale search cancellation | CatalogPagingTests: 121 synthetic provider fixtures across three pages; SymbolCatalogSearch.test.tsx; actual Coinbase second page | PASS |
| Catalog identity and hostile input rejection | providerCatalog.test.ts; CatalogPagingTests; catalog-http.json: anonymous/account mismatch 401, invalid provider/cursor/class 400 | PASS |
| Coinbase/Binance live catalog | HTTP 50-row pages and actual browser results; Binance public Spot filtered endpoint returns bounded real catalog | PASS |
| Frankfurter | Local catalog 502; direct official endpoint queries providers=ECB, base=EUR+ECB, base=EUR+quotes=USD+ECB all HTTP 403 | BLOCKED_EXTERNAL |
| Alpaca stock/ETF | Capabilities not configured; no credentials or display entitlement supplied | BLOCKED_EXTERNAL |
| Futures / CFD | No accepted verified contract source / no accepted display-entitled source | GATED per plan, no fake rows |
| Icons | Four CC0 assets pinned in public/symbol-icons/PROVENANCE.md, SVG allowlist review; deterministic fallback and remote URL rejection test | PASS |
| Timeframe/clock keyboard and portal geometry | ChartRefinement.test.tsx; 390 px popup top132 vs trigger bottom128, right382, document width390 | PASS |
| Crosshair simultaneous labels and edge clipping | ChartRefinement.test.tsx, desktop screenshot; moved crosshair above tick layer after finding overlap | PASS |
| UTC unchanged, named display updated | Browser axis announced Asia/Ho_Chi_Minh after selection; existing timezone unit tests | PASS |
| Responsive Chart and Replay | Browser interaction at 1440x900, 1024x900, 390x844; screenshots in test-evidence/refinement | PASS |

## Commands and limitations

- RED before runtime implementation: new launcher/catalog imports unavailable;
  timeframe hover and clock portal assertions failed; crosshair bounds failed.
  The subsequent targeted suites passed. Logs were kept under ignored tmp.
- `npm --prefix frontend test -- --run --maxWorkers=1 --testTimeout=15000`:
  exit 0, 53 files / 301 tests PASS. Single worker avoids contention with backend.
- `npm --prefix frontend test -- --run src/market/ChartRefinement.test.tsx src/replay/Replay.test.tsx src/market/LiveChart.test.tsx`:
  exit 0, two matching files / 10 tests PASS after final anchor geometry change.
- `npm --prefix frontend run lint` and `npm --prefix frontend run build`: exit 0.
  Existing bundle-size warning remains; no dependency added.
- Full backend harness: `JAVA_HOME=Java21`, `JAVA_TOOL_OPTIONS=-Dspring.test.context.cache.maxSize=1`,
  `python scripts/test_backend.py`: exit 0, clean/test/bootJar/dependencyInventory.
  Earlier attempts failed from concurrent build output and cached test-context DB locks;
  sequential isolated run passed without weakening assertions. Final rerun recorded below.
- `python scripts/test_backend.py --tests '*CatalogPagingTests'`: exit 0,
  paging and Binance metadata/duplicate/path checks PASS.
- `npm audit`: zero vulnerabilities. OSV scan: 144 resolved Java dependencies,
  no findings; see backend-dependencies.json.
- `python scripts/verify_readiness.py`: exit 0; offline verifier PASS. Its
  existing feature-DONE field concerns PB-026, not a declaration that #39 is done.

## Security applicability

Authentication/account binding, invalid provider/path/cursor, upstream size bounds,
redirect refusal, failed provider responses, duplicate identities, stale async results,
no arbitrary image URL fetch, and no draft write are covered above. Existing full
backend/Replay tests cover CSRF, owner isolation, replay/idempotency and concurrency.
No new upload, database write endpoint, SQL construction, credential handling or
broker operation is introduced. Dependencies and licensed assets were reviewed.
Runtime-only fixture credentials are omitted from committed evidence.

## Browser artifacts

`replay-1440.png`, `replay-1024.png`, `replay-390.png`, `chart-390.png`,
`chart-1024.png`, `chart-1440-crosshair.png`, `binance-catalog.png`, and
`forex-unavailable.png` are actual local browser captures. Screenshots show synthetic
account data and public market observations only. The desktop viewport may have
more/fewer visible candles than mobile; original candle UTC identities are retained.

## Resume verification — 08/09/2026

- Re-ran the final Replay launcher change that invalidates coverage whenever the
  selected calendar range changes: targeted PB-038 frontend tests passed 14/14.
- The full frontend suite initially exposed one existing multi-chart integration
  test exceeding its five-second per-test limit only under full parallel load.
  The same assertions passed alone in 2.71 seconds. Its local timeout is now ten
  seconds; the repeated full run passed 53 files and 301 tests in 42.54 seconds.
- Frontend lint and production build passed. Vite retained the known 636.03 kB
  chunk-size warning; no build failure or new runtime dependency was introduced.
- The disposable backend harness passed its complete build/test and dependency
  inventory in 4 minutes 51 seconds. Market-focused Gradle tests also passed.
- Verification tools passed 6/6, Python tests passed 58/58, readiness returned
  `passed=true`, production npm audit reported zero vulnerabilities, and
  `git diff --check` passed.
- Current-browser smoke used a new disposable local database and synthetic QA
  account. At 1440, 1024 and 390 CSS pixels the chart and Replay, Position Setup,
  timeframe and clock controls remained visible. Replay showed Day/Month with a
  disabled Start before coverage; Position Setup truthfully required Replay and
  Quantity; Coinbase catalog pagination loaded real rows; the 390px timeframe
  popover exposed seven choices; selecting Asia/Ho_Chi_Minh changed the chart's
  announced timezone without changing candle identity. Browser console contained
  no warning or error entries.
- External blockers are unchanged: Frankfurter catalog requests receive HTTP 403
  from the official upstream in this environment, and Alpaca credentials/display
  entitlement were not supplied. Futures/CFD remain gated and Issue #39 stays open.
