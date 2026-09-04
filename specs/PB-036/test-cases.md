# PB-036 — Cursor-centered chart zoom

Issue: #37

## Scope

Align the Quant wheel-zoom interaction with the observed LuxAlgo/Vela behavior:
the candle below the pointer stays at the same logical screen position while
the visible candle count changes. A live chart only continues following the
latest candle when the gesture is intentionally made at the right edge.

## Acceptance tests

| ID | Scenario | Expected result |
| --- | --- | --- |
| TC-01 | Zoom in over the middle of a following live chart | The visible window narrows around the pointer anchor; it does not jump to the newest candle. |
| TC-02 | Zoom out at the same pointer location | The visible window expands around the same anchor and remains continuous. |
| TC-03 | Zoom near the right edge | Follow-latest may remain enabled so new realtime candles stay visible. |
| TC-04 | Press `0` after zoom | The chart returns to the full/reset view without stale manual state. |
| TC-05 | Run market regression suite | Existing pan, crosshair, realtime, drawing and chart toolbar behavior remains green. |

## Evidence — 04/09/2026

- LuxAlgo browser inspection: one wheel step increased candle spacing, retained the candle under the pointer as the zoom anchor, and kept crosshair/time/price readouts aligned.
- Quant browser inspection after the fix: zoom-in at the chart center changed the window to `74–283 / 305` and exposed `Smooth cursor-centered wheel zoom`; zoom-out expanded it to `55–305 / 305` around the same anchor; `0` restored the chart.
- `frontend/npx vitest run src/market/liveMarket.test.ts --reporter=verbose --no-file-parallelism` — PASS, 1 file / 10 tests.
- `frontend/npm test -- --run --reporter=dot --no-file-parallelism` — PASS, 33 test files / 241 tests.
- `frontend/npm run lint` and `frontend/npm run build` — PASS; build retains only the existing chunk-size advisory.

## Implementation

- `CandleChart.tsx` now uses a pure `zoomViewport` calculation for pointer-anchored exponential wheel zoom.
- The old latest-candle shortcut is removed from wheel zoom; follow-latest is retained only for a right-edge gesture.
- No candle data, provider, drawing coordinates, or AI Capture payload semantics were changed.
