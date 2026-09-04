# PB-033 — Test cases

Issue: #34

| ID | AC | Scenario | Expected evidence |
| --- | --- | --- | --- |
| TC-01 | AC-01, AC-03 | Map Binance REST kline arrays | Neutral Candle values validate, sort ascending and deduplicate `openTime`. |
| TC-02 | AC-03 | Merge current/live candle | Same open time replaces the last candle; new bucket appends once. |
| TC-03 | AC-02, AC-06 | Change symbol / close socket | Previous unsubscribe runs; reconnection is backoff-capped and cleanup closes active socket. |
| TC-04 | AC-04 | Render provider-backed chart | BINANCE state and received current price render; error has explicit retry and no mock fallback. |
| TC-05 | AC-05 | Inspect toolbar | Semantic labels/tooltips present; Crosshair active state works; unsupported group/action is disabled. |
| TC-06 | AC-01–06 | Browser QA | BTCUSDT/1m shows real history then LIVE stream; 1m→5m and BTCUSDT→ETHUSDT leave no stale data. |

## Security applicability

Malformed public response/event tests cover parser rejection. No secret, private account, storage, authorization, mutation, upload, SQL, CSRF or AI trust boundary is introduced; these attack classes are not applicable to the feature's read-only public provider.

## Execution results — 04/09/2026

| ID | Result | Evidence |
| --- | --- | --- |
| TC-01 | PASS | `liveMarket.test.ts`: Binance REST array mapping, chronological sort and open-time deduplication. |
| TC-02 | PASS | `liveMarket.test.ts`: matching `openTime` replaces the last candle; a new bucket appends once. |
| TC-03 | PASS | `liveMarket.test.ts`: reconnect backoff, socket cleanup, BTCUSDT→ETHUSDT and 1m→5m old-subscription cleanup. |
| TC-04 | PASS | Provider-backed LiveChart test checks BINANCE LIVE/current received candle; public read-only REST verification returned current BTCUSDT/1m OHLC rows on 04/09/2026. |
| TC-05 | PASS | Toolbar test checks Cursor, Crosshair, semantic lock/hide/remove controls and disabled Pattern group. Existing chart/accessibility regressions pass. |
| TC-06 | PARTIAL | DOM visual coverage and direct Binance REST response pass. Interactive authenticated-browser observation is not run because the local browser was at the login boundary and no user credential was read or reused. |

Commands and exit codes:

- `npm test -- --run --reporter=dot --no-file-parallelism` — exit 0; 32 files, 233 tests passed.
- `npm run lint` — exit 0.
- `npm run build` — exit 0.
- `backend\\gradlew.bat test --no-daemon --console=plain` — exit 0.
- `backend\\gradlew.bat build --no-daemon --console=plain` — exit 0.
- Public read-only Binance REST request for `BTCUSDT`, `1m`, `limit=2` — exit 0; returned two current UTC OHLC rows without a credential.
