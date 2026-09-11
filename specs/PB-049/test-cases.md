# PB-049 — Test cases

| ID | Coverage | Expected | Result |
| --- | --- | --- | --- |
| MD-01 | Capital mappings | Seven Forex and four commodity symbols resolve to explicit Capital epics | PASS |
| MD-02 | Historical source | Capital accepts historical `1m`; larger frames are local projections | PASS |
| MD-03 | Historical idempotency | Repeating the same real sync does not duplicate PostgreSQL M1 | PASS |
| MD-04 | Real multi-symbol history | All 11 Capital symbols persist real M1 and produce all seven frames | PASS |
| MD-05 | Real commodity history | GOLD produces multiple closed M1/M5/M15/M30/H1/H4/D1 candles | PASS |
| MD-06 | Historical before live-only cache | A live current M1 does not suppress the bounded historical sync | PASS |
| MD-07 | Quote bucket mapping | `10:23:25Z` maps to M1 10:23, M5 10:20, M15 10:15, M30/H1 10:00, H4 08:00, D1 00:00 | PASS |
| MD-08 | Immediate seven-frame update | One quote updates current M1/M5/M15/M30/H1/H4/D1 with the same MID close | PASS |
| MD-09 | No M1 wait | M5/H1/H4/D1 change before M1 closes | PASS |
| MD-10 | Boundary finalization | A larger current candle is not finalized before its own boundary | PASS |
| MD-11 | Duplicate/out-of-order | Duplicate event IDs and older quotes are ignored | PASS |
| MD-12 | Real Redis | One real EUR/USD quote is visible in all seven current Redis keys | PASS |
| MD-13 | Real SSE | A real Capital quote reaches an application `SseEmitter` | PASS |
| MD-14 | Realtime durability | Finalized real Capital M1 persists to PostgreSQL | PASS |
| MD-15 | History/live join | Equal live bucket replaces history; next bucket appends without duplicate/gap | PASS |
| MD-16 | Browser GOLD H1 | Historical H1 loads and the open H1 close changes immediately from a live quote | PASS |
| MD-17 | Weekend empty window | Capital price-window 404 is an empty gap, not a fabricated candle or false failure | PASS |
| MD-18 | Forex flags | Local EUR/USD flag assets render and return HTTP 200 | PASS |
| MD-19 | Dataset bound | 10,000 candles are accepted and 20,001 are rejected | PASS |
| MD-20 | Backend regression | Full isolated backend suite passes | PASS — 398 tests, 12 conditional skips |
| MD-21 | Frontend regression | Lint, build, 346 tests and audit pass | PASS |
| MD-22 | Python regression | Engine, cross-target and readiness tests pass | PASS |
| MD-23 | Migration ledger | Flyway V1–V22 names and canonical SHA-256 hashes are bound | PASS |
| MD-24 | Dependency audit | Locked backend inventory contains no reported finding | PASS — 145 components |

## Mandatory scenario mapping

1. Seed/load historical M1 and verify multiple closed candles in all seven frames: MD-04 and MD-05.
2. Receive a real Capital quote: MD-12 and MD-13.
3. Verify the same quote updates all seven Redis current candles immediately: MD-08 and MD-12.
4. Do not finalize a larger timeframe before its boundary: MD-10.
5. Do not wait for M1 close before larger frames change: MD-09 and MD-16.
6. Join chart history and current live candle at every timeframe: MD-15 plus frontend parameterized tests.

## Security negative coverage

Malformed REST/WebSocket JSON, unsupported symbols/timeframes, oversized responses,
invalid OHLC, invalid bid/offer, duplicate IDs, out-of-order timestamps, arbitrary
Redis tokens, invalid ranges, missing credentials, auth/CSRF failures and provider
network failures are rejected or degraded without secret leakage.
