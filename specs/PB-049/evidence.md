# PB-049 — Real integration evidence

Date: 11/09/2026 (Asia/Ho_Chi_Minh)

Overall Issue result: `IMPLEMENTATION_COMPLETE_INTEGRATION_PARTIAL`

Capital historical/realtime correction: `PASS`

## Environment

- PostgreSQL disposable integration database and Redis QA instance on `127.0.0.1:6387`.
- Java 21, Spring Boot, Gradle Wrapper, React, TypeScript and Vite.
- Real configured Capital.com Demo REST and WebSocket session.
- Provider credentials remained environment-backed and are not recorded here.

## Historical evidence

Capital historical uses REST M1 as its sole source and aggregates locally after
idempotent PostgreSQL persistence.

Real GOLD window `2024-01-03T00:00:00Z` to `2024-01-08T00:00:00Z`:

| Timeframe | Closed candles | Result |
| --- | ---: | --- |
| M1 | 4,123 | PASS |
| M5 | 825 | PASS |
| M15 | 276 | PASS |
| M30 | 138 | PASS |
| H1 | 69 | PASS |
| H4 | 19 | PASS |
| D1 | 4 | PASS |

Real one-hour sync for the eleven required Capital symbols produced 61 M1
candles each except PALLADIUM with 57. Every symbol produced non-empty
M1/M5/M15/M30/H1/H4/D1 projections, and repeating the sync preserved the same
PostgreSQL candle count.

The runtime history controller performs the bounded sync before reading history,
including when Redis or the frontend already has one live M1 candle. A bounded
Capital 404 for an empty weekend price window is treated as a real empty gap and
does not create synthetic candles.

## Realtime evidence

A real EUR/USD Capital quote traversed:

`Capital WebSocket -> RealtimeTimeframeAggregator -> Redis seven frames -> SSE -> React`

- The same MID close appeared immediately in current M1/M5/M15/M30/H1/H4/D1.
- Each Redis `openTime` aligned to its own UTC boundary.
- Larger timeframe values changed without waiting for M1 close.
- Duplicate/out-of-order protection remained active.
- An application `SseEmitter` received the real quote update.
- Crossing an M1 boundary persisted the finalized M1 to PostgreSQL.
- No larger current timeframe was finalized early.

## Browser evidence

Real browser smoke at `http://127.0.0.1:5173/`:

- GOLD H1 loaded 222 candles instead of a single live candle.
- The open H1 close changed immediately from `4,370.03` to `4,369.49` on a new quote without waiting for M1 close.
- EUR and USD local flag SVG requests returned HTTP 200 and rendered as overlapping pair flags.
- Local screenshots were captured as `tmp/browser-gold-h1-live.png` and `tmp/browser-forex-flags.png`.

## Regression evidence

| Command / gate | Result |
| --- | --- |
| Real `RealCapitalMarketDataIntegrationTests` | PASS — 3/3 |
| Focused backend Capital/aggregation tests | PASS |
| `python scripts/test_backend.py` | PASS — 398 tests, 0 failures/errors, 12 conditional skips; boot JAR and inventory PASS |
| Frontend focused market/icon tests | PASS — 29/29 |
| Frontend full tests | PASS — 57 files, 346 tests |
| Frontend lint and build | PASS; only the existing Vite chunk warning |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `python -m unittest discover -s python/tests -v` | PASS after V22 expectation update |
| `python scripts/verify_cross_target.py` | PASS — 8 fixtures, 51 bars, zero divergence |
| `python scripts/backtest_ui_fixtures.py --check` | PASS — six fixtures |
| `python scripts/verify_readiness.py` | PASS — 22 migrations, 36 tables, zero unexplained gaps |
| Dependency audit | PASS — 145 components, 0 findings |

## Migration and dataset evidence

- V22 canonical SHA-256: `bc2c8604fd1f58309d9f8a9d8b0f2f4113e19e1dc493913ff63ae14452c32de7`.
- The Python contract accepts up to 20,000 candles and rejects 20,001.
- The Pine fixture verifier canonicalizes checkout CRLF to repository LF before comparing pinned SHA-256; content changes still fail closed.

## Remaining Issue-level limitations

This Capital correction satisfies the newly required historical/realtime split.
Issue #49 remains open because the original Issue also records broader full-range
and independently requested non-Capital live evidence that has not all been
re-executed in this correction. No `FULL_PASS` is claimed for those unrelated
remaining conditions.
