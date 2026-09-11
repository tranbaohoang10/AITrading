# PB-049 — Test cases

| ID | Coverage | Expected | Result |
| --- | --- | --- | --- |
| MD-01 | Required canonical mappings | 19 distinct provider routes | PASS |
| MD-02 | Flyway V21 | Real PostgreSQL migration and repeat validation | PASS |
| MD-03 | M1 idempotent upsert | Duplicate batch does not duplicate rows | PASS |
| MD-04 | Range read | Bounded ordered local rows | PASS |
| MD-05 | UTC aggregation | M5/M15/M30/H1/H4/D1 deterministic OHLCV | PASS |
| MD-06 | Current M1 | Duplicate/out-of-order ignored; rollover finalizes prior minute | PASS |
| MD-07 | Dukascopy BI5 | Big-endian LZMA decode and symbol scales | PASS |
| MD-08 | Alpaca empty range | HTTP 200 `bars:null` becomes empty history | PASS |
| MD-09 | Provider availability | Binance and Alpaca derive earliest accessible M1 | PASS |
| MD-10 | PostgreSQL integration | V21 store/read/coverage/aggregation on disposable PostgreSQL 17 | PASS |
| MD-11 | Redis integration | Real Redis latest/current/status serialization | PASS |
| MD-12 | Real current historical | Binance 2/2 and Alpaca 6/6 persist and aggregate | PASS |
| MD-13 | Real Dukascopy historical | Required 11 symbols return actual data | FAIL_EXTERNAL |
| MD-14 | Effective-start probe | No symbol is falsely reported as available from 2017 | PASS |
| MD-15 | Local backtest | Real persisted Binance data reaches actual Python worker | PASS |
| MD-16 | All required timeframes | M1/M5/M15/M30/H1/H4/D1 worker runs succeed | PASS |
| MD-17 | Determinism | Repeated identical M1 snapshot has identical result hash | PASS |
| MD-18 | Real Binance live | Real event updates current candle more than once | PASS |
| MD-19 | Redis live chain | Provider event → latest/current/status keys | PASS |
| MD-20 | Application stream | SSE observer receives normalized candle event | PASS |
| MD-21 | Minute close | Finalized real Binance M1 persists to PostgreSQL | PASS |
| MD-22 | Missing optional provider config | Startup remains healthy; no secret output | PASS |
| MD-23 | Backend regression | Full isolated backend suite | PASS — 384 tests, 8 conditional skips |
| MD-24 | Frontend lint/build/tests/audit | Affected web gates | PASS — 340 tests, zero vulnerabilities |
| MD-25 | Dependency audit | Locked dependency inventory and high vulnerability check | PASS — 145 components, zero findings |

## Security negative coverage

Malformed JSON/BI5/ZIP payloads, unsupported symbols and timeframes, oversized
responses, duplicate candles, non-monotonic event IDs, invalid OHLC, arbitrary
Redis tokens, invalid ranges, missing credentials, auth/CSRF on private APIs and
provider network failures are rejected or degraded without secret leakage.
