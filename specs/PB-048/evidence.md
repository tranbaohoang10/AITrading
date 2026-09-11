# PB-048 — Verification evidence

Date: 11/09/2026 (Asia/Ho_Chi_Minh)

## Real ingestion

Authenticated `GET /api/market/providers/catalog/status` after a clean V20 migration and completed scheduler run:

| Asset class | Active canonical instruments |
| --- | ---: |
| STOCK | 49,329 |
| ETF | 16,579 |
| FOREX | 642 |
| COMMODITY | 16 |
| CRYPTO regression coverage | 1,841 |

| Provider | State | Snapshot rows | Note |
| --- | --- | ---: | --- |
| ALPACA | SUCCESS | 14,309 | Authenticated server-side catalog; credentials never recorded |
| FREE_TICKER_DB | SUCCESS | 61,733 | Global stock/ETF reference snapshot |
| FRANKFURTER_REFERENCE | SUCCESS | 656 | Dynamic Forex/metals reference catalog |
| COINBASE | SUCCESS | 484 | Existing route preserved |
| BINANCE | SUCCESS | 1,362 | Existing route preserved |
| FRANKFURTER | SUCCESS | 11 | Existing daily route preserved |
| TWELVE_DATA | DISABLED | 0 | Optional key absent in this QA process; clean free-first fallback |
| OANDA / CTRADER | DISABLED | 0 | Optional provider credentials/configuration absent |

Search evidence:

- `AAPL` and `Apple` return a routable Alpaca row plus distinct global reference listings.
- `SPY` and `QQQ` return routable ETF rows first; same ticker on other exchanges remains distinct.
- `EURUSD` and `EUR/USD` resolve to `EUR/USD`.
- `Gold`, `XAUUSD` and `XAU/USD` resolve to `XAU/USD`.
- Reference-only rows remain visible but cannot open an unsupported chart route.

## Browser QA

Chromium headless against `http://127.0.0.1:5173/` and the real local backend:

- One unified `/api/market/providers/catalog` request per debounced search/category change; no provider fan-out.
- All preview begins with balanced featured rows such as BTC/USD, AAPL, SPY, EUR/USD and XAU/USD.
- Curated crypto rows prefer USD and omit non-featured empty-query noise.
- AAPL, NVDA, SPY, QQQ, BTC, ETH, SOL and commodity SVG icons loaded with non-zero natural width.
- Normal rows did not display `Alpaca`, `IEX` or reference provider identifiers.
- Reference-only rows were disabled and labelled truthfully.
- Selecting AAPL closed the modal, loaded 300 candles and updated CandleChart to AAPL; `Market closed` was truthful outside the U.S. regular session.
- Local screenshots: `tmp/pb048-symbol-search.png`, `tmp/pb048-aapl-chart.png` (not committed).

## Automated verification

| Command | Result |
| --- | --- |
| `python scripts/test_backend.py --tests com.aitrading.market.InstrumentCatalogProviderTests` | PASS |
| `python scripts/test_backend.py --tests com.aitrading.market.InstrumentCatalogPersistenceTests` | PASS |
| `python scripts/test_backend.py --tests com.aitrading.AiTradingApplicationTests.databaseMigrationAndRepeatValidationAreRealAndIdempotent` | PASS |
| `python scripts/test_backend.py` | PASS — 367 tests completed, 3 conditionally skipped; V20 migration, `bootJar` and dependency inventory passed |
| `npm test` | PASS — 57 files, 339 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS — TypeScript and Vite production build; existing bundle-size advisory only |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS — line-ending notices only |

No secret value, generated QA password or provider credential is present in this evidence.
