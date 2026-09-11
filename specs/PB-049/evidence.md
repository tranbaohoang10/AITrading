# PB-049 — Real integration evidence

Date: 11/09/2026 (Asia/Ho_Chi_Minh)

Overall result: `IMPLEMENTATION_COMPLETE_INTEGRATION_PARTIAL`

## Environment

- PostgreSQL 17 disposable native clusters created by `scripts/test_backend.py`.
- Redis 8.4.2 isolated QA instance on `127.0.0.1:6387`.
- Java 21, Spring Boot 4.1.1, Gradle Wrapper 9.7.1.
- Real configured Alpaca IEX account; public Binance REST/WebSocket; public Dukascopy BI5 endpoint.
- No Twelve Data key is required for startup or these tests.

## Historical evidence

Real probe window `2026-09-09T00:00:00Z` to `2026-09-10T00:00:00Z`:

| Provider | Symbols | Result | Persisted/aggregated evidence |
| --- | --- | --- | --- |
| Binance | BTC/USDT, ETH/USDT | READY | each M1 1440, M5 288, H1 24, D1 1 |
| Alpaca IEX | AAPL, MSFT, NVDA, SPY, QQQ, DIA | READY | M1 391, 389, 391, 395, 411, 211; every symbol produced M5/H1/D1 |
| Dukascopy | 7 FX + 4 metals | ERROR | `DUKASCOPY_HISTORY_UNAVAILABLE`; three retries per daily request; zero persisted rows |

Earliest accessible provider observations on this machine/account:

- Binance BTC/USDT and ETH/USDT: `2017-08-17T04:00:00Z`.
- Alpaca IEX: AAPL/MSFT/NVDA `2020-07-27T13:30:00Z`, SPY `12:49:00Z`, QQQ `13:31:00Z`, DIA `13:29:00Z`.
- Dukascopy metadata: major FX/XAU/XAG from 2003; XPT/USD from `2021-11-01T00:00:00Z`; XPD/USD from `2021-07-04T22:00:00Z`. Data retrieval could not be verified because the endpoint refused connections.

The provider-derived availability checks prevent a false 2017 claim. Full
2017/effective-start-to-present M1 backfill is not complete.

## Backtest evidence

`RealProviderBacktestIntegrationTests` synced two real Binance days, read only
local PostgreSQL during execution and ran the actual supervised Python worker:

| Timeframe | Candles | Result hash | Result |
| --- | ---: | --- | --- |
| M1 | 2,880 | `d6a919989ff971ad8e2495b6b23a2e8ebce5a2c61b60294533911e95dd3fb27b` | SUCCEEDED |
| M5 | 576 | `e744a83aff99d87b84c50015c9792f3179d02c63415929225fbe4bdfd1590051` | SUCCEEDED |
| M15 | 192 | `1d9ca7623da145909ca49be65265df51c0435d8538599de1f427bb62f4fc1024` | SUCCEEDED |
| M30 | 96 | `15919ddbc4892a0281a1d1360bde4c74e76dfe98274ad0756e6971bf70326c26` | SUCCEEDED |
| H1 | 48 | `f33c7c9f167d659599c8609e2b3ccb0b188331af323c3f8b30861c2c4f8` | SUCCEEDED |
| H4 | 12 | `44f201041cdc8a2f72e66d9dc0534a08aafef0c3b33d594e9e56f377f0ae8769` | SUCCEEDED |
| D1 | 2 | `b9021bf5464fa188e72c557efd24ed3c3046844d402ce27b369d03fc65274c71` | SUCCEEDED |

Repeating the identical M1 snapshot produced the identical M1 result hash.

## Realtime and Redis evidence

Real Binance BTC/USDT `aggTrade` test:

- Two distinct current-M1 Redis values were observed from subsequent events.
- Latest evidence: `eventCount=176`, `price=77428.01000000`, `lastEventAt=2026-09-11T08:42:00.653Z`.
- Redis key: `aitrading:v2:market:BINANCE:BTCUSDT:M1:current`.
- Redis latest/current/status writes succeeded against Redis 8.4.2.
- A real `SseEmitter` observer received backend candle events.
- Minute rollover persisted the finalized M1 in PostgreSQL.

ETH/USDT and Alpaca symbols were not independently live-tested. At the test time,
US equities were outside regular market hours, so they are
`NOT_VERIFIED_MARKET_CLOSED`, not fake LIVE PASS. Dukascopy realtime is not implemented.

## Required symbol matrix

| Symbol | Asset | Provider | Historical From | M1 Historical | Backtest From 2017 | Realtime | Redis Live | Current Candle | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EUR/USD | FOREX | Dukascopy | 2003-05-04 | FAIL endpoint | FAIL | UNSUPPORTED | NOT VERIFIED | NOT VERIFIED | FAIL_HISTORICAL |
| GBP/USD | FOREX | Dukascopy | 2003-05-04 | FAIL endpoint | FAIL | UNSUPPORTED | NOT VERIFIED | NOT VERIFIED | FAIL_HISTORICAL |
| USD/JPY | FOREX | Dukascopy | 2003-05-04 | FAIL endpoint | FAIL | UNSUPPORTED | NOT VERIFIED | NOT VERIFIED | FAIL_HISTORICAL |
| AUD/USD | FOREX | Dukascopy | 2003-08-03 | FAIL endpoint | FAIL | UNSUPPORTED | NOT VERIFIED | NOT VERIFIED | FAIL_HISTORICAL |
| USD/CAD | FOREX | Dukascopy | 2003-08-03 | FAIL endpoint | FAIL | UNSUPPORTED | NOT VERIFIED | NOT VERIFIED | FAIL_HISTORICAL |
| USD/CHF | FOREX | Dukascopy | 2003-05-04 | FAIL endpoint | FAIL | UNSUPPORTED | NOT VERIFIED | NOT VERIFIED | FAIL_HISTORICAL |
| NZD/USD | FOREX | Dukascopy | 2003-08-03 | FAIL endpoint | FAIL | UNSUPPORTED | NOT VERIFIED | NOT VERIFIED | FAIL_HISTORICAL |
| XAU/USD | COMMODITY | Dukascopy | 2003-05-05 | FAIL endpoint | FAIL | UNSUPPORTED | NOT VERIFIED | NOT VERIFIED | FAIL_HISTORICAL |
| XAG/USD | COMMODITY | Dukascopy | 2003-05-04 | FAIL endpoint | FAIL | UNSUPPORTED | NOT VERIFIED | NOT VERIFIED | FAIL_HISTORICAL |
| XPT/USD | COMMODITY | Dukascopy | 2021-11-01 | FAIL endpoint | N/A before availability | UNSUPPORTED | NOT VERIFIED | NOT VERIFIED | FAIL_HISTORICAL |
| XPD/USD | COMMODITY | Dukascopy | 2021-07-04 | FAIL endpoint | N/A before availability | UNSUPPORTED | NOT VERIFIED | NOT VERIFIED | FAIL_HISTORICAL |
| BTC/USDT | CRYPTO | Binance | 2017-08-17 04:00Z | PASS | PARTIAL, effective start + snapshot cap | PASS | PASS | PASS | PARTIAL_HISTORICAL |
| ETH/USDT | CRYPTO | Binance | 2017-08-17 04:00Z | PASS | NOT RUN FULL RANGE | NOT VERIFIED | NOT VERIFIED | NOT VERIFIED | PARTIAL_HISTORICAL |
| AAPL | STOCK | Alpaca IEX | 2020-07-27 13:30Z | PASS | N/A before availability | NOT_VERIFIED_MARKET_CLOSED | NOT VERIFIED | NOT VERIFIED | PARTIAL_HISTORICAL |
| MSFT | STOCK | Alpaca IEX | 2020-07-27 13:30Z | PASS | N/A before availability | NOT_VERIFIED_MARKET_CLOSED | NOT VERIFIED | NOT VERIFIED | PARTIAL_HISTORICAL |
| NVDA | STOCK | Alpaca IEX | 2020-07-27 13:30Z | PASS | N/A before availability | NOT_VERIFIED_MARKET_CLOSED | NOT VERIFIED | NOT VERIFIED | PARTIAL_HISTORICAL |
| SPY | ETF | Alpaca IEX | 2020-07-27 12:49Z | PASS | N/A before availability | NOT_VERIFIED_MARKET_CLOSED | NOT VERIFIED | NOT VERIFIED | PARTIAL_HISTORICAL |
| QQQ | ETF | Alpaca IEX | 2020-07-27 13:31Z | PASS | N/A before availability | NOT_VERIFIED_MARKET_CLOSED | NOT VERIFIED | NOT VERIFIED | PARTIAL_HISTORICAL |
| DIA | ETF | Alpaca IEX | 2020-07-27 13:29Z | PASS | N/A before availability | NOT_VERIFIED_MARKET_CLOSED | NOT VERIFIED | NOT VERIFIED | PARTIAL_HISTORICAL |

## Failed / partial root causes

- **Dukascopy 11 symbols:** fixed official data host was attempted with bounded daily BID BI5 requests and three retries. This machine received connection failures, mapped to `DUKASCOPY_HISTORY_UNAVAILABLE`. Redis remained untouched. Next action: restore network reachability or document an approved alternative provider; do not silently substitute.
- **Binance:** exchange history begins after January 1, 2017. The implementation records the true August 17 start. Only BTC/USDT live and backtest paths were independently verified; ETH remains partial.
- **Alpaca 6 symbols:** the configured IEX entitlement's first accessible M1 is July 27, 2020, discovered per symbol with a real ascending one-bar request. Current historical data passes; live evidence awaits an open U.S. session.
- **Full-range backtest:** `market_dataset`/worker admission is intentionally bounded at 5,000 candles. A multi-year M1 run needs a separately designed chunked/streaming immutable snapshot contract; it was not bypassed or weakened.

## Verification commands

| Command | Result |
| --- | --- |
| `python scripts/test_backend.py` | PASS — 384 tests, 0 failures/errors, 8 conditional skips; boot JAR and dependency inventory pass |
| `python -m unittest discover -s python/tests -v` | PASS — 59 tests |
| `npm run lint` | PASS |
| `npm run build` | PASS; existing Vite large-chunk warning only |
| `npm test -- --run --maxWorkers=1` | PASS — 57 files, 340 tests |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `python scripts/check_dependencies.py backend/build-verification/reports/dependencies.txt backend/build-verification/reports/dependency-audit.json` | PASS — 145 components, 0 findings |
| `python -m unittest python.tests.test_readiness -v` | PASS — 6 adversarial readiness tests |
| `python scripts/verify_readiness.py` | PASS — 21 Flyway migrations, 36 SQL tables, no unexplained gaps |
| `git diff --check` | PASS |

Provider test XML is generated under
`backend/build-verification/test-results/test` and contains the `REAL_MATRIX`,
`HISTORICAL_2017_MATRIX`, `BACKTEST_MATRIX`, `BACKTEST_DETERMINISM` and
`REALTIME_MATRIX` evidence lines. Real-provider tests are intentionally separate
from the ordinary credential-stripped regression gate.
