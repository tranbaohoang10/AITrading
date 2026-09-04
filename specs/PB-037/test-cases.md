# PB-037 — Chart workspace, deep history, indicators and multi-chart

Issue: #38

## Scope

Complete the Coinbase live chart workspace while preserving the existing chat,
history navigation, drawing tools, realtime updates and AI Capture workflow.
The visual language follows the observed LuxAlgo reference: compact topbar,
Inter-based typography, dark surfaces, visible-window chart rendering and
pointer-anchored zoom.

## Acceptance tests

| ID | Scenario | Expected result |
| --- | --- | --- |
| TC-01 | Open the live chart on desktop | No permanent desktop Q rail is visible; the Q mark in Assistant opens the left navigation drawer; chat remains usable. |
| TC-02 | Inspect the chart topbar | The left cluster contains symbol, timeframe and current price; the right action cluster is adjacent to layout/indicator/refresh/capture controls; provider status is a compact accessible state indicator. |
| TC-03 | Load and update live Coinbase candles | Historical candles are real Coinbase OHLCV data, realtime updates merge by timestamp, and the bounded shared cache can retain up to 20,000 bars. |
| TC-04 | Pan to the left edge | Older pages request at most 300 source candles, prepend in chronological order, preserve the viewport anchor and show a non-blocking loading state. |
| TC-05 | Add studies | SMA, EMA, Bollinger Bands and VWAP render on price; RSI, MACD and ATR render in separate oscillator panes; volume is a separate pane. |
| TC-06 | Change multi-chart layout | Layouts 1, 2H, 2V, 4 and 8 render the requested number of cells; one cell is visibly active and controls target that cell. |
| TC-07 | Switch cells and return | Each cell preserves its own symbol/timeframe, candles, indicators, drawings and chart type; returning to a cell does not reset its state. |
| TC-08 | Zoom around a candle | Wheel zoom is cursor-centered like LuxAlgo: the candle under the pointer remains the logical anchor and the view does not jump to latest. |
| TC-09 | Preserve AI workflows | Existing chat/history navigation, drawing tools, realtime connection and AI Capture continue to function without fake providers or synthetic market candles. |
| TC-10 | Automated regression | Frontend type-check, build, unit/integration tests and lint pass. |

## Evidence — 04/09/2026

Automated verification (PowerShell, `H:\AITrading\frontend`):

- `npm run lint` — exit 0.
- `npm run build` — exit 0; TypeScript check and Vite production build passed.
- `npx vitest run --reporter=dot --no-file-parallelism` — exit 0; 33 files and
  244 tests passed. The live-chart UI test emits two React `act(...)` warnings,
  but no test failure.

Browser QA on local Vite app (`http://127.0.0.1:5173/`) with Chrome:

- Desktop view has no permanent Q rail. The Q button in the Assistant header
  opens a drawer from the left edge; the chat composer remains visible at 360px.
- Compact chart topbar shows symbol/timeframe/current price on the left and
  chart type/layout/indicators/refresh/capture actions on the right. The visual
  treatment uses the existing Inter stack and compact Quant type scale.
- Layout 4 visibly renders four chart cells. c1 retained its EMA and 5m state;
  c2 retained its independent Coinbase chart state after switching cells.
- Indicators menu visibly contains SMA, EMA, Bollinger Bands, VWAP, RSI, MACD
  and ATR. The chart visibly renders the volume pane and overlay/pane studies.
- Wheel zoom remained anchored to the pointer candle, matching the observed
  LuxAlgo behavior, without jumping to the latest candle. Zooming out at the
  left edge triggered lazy loading from 1,201 to 1,502 Coinbase 5m candles.

Limitation: the public Coinbase endpoint returned no older page after 1,502
candles in this browser session, so browser QA cannot truthfully claim that the
20,000-bar cache was filled or that >10,000 bars are available for this market /
timeframe. The implementation keeps the requested 20,000-bar bound and requests
older pages in source-sized batches of at most 300; deeper history depends on
Coinbase availability/rate limits.

## Implementation notes

- `LiveChart.tsx` owns the bounded shared history cache and per-cell chart state.
- `CoinbaseMarketDataProvider.ts` keeps Coinbase's maximum source request at 300
  candles and supports the `before` cursor for lazy older-page loading.
- `CandleChart.tsx` renders only the visible SVG window, computes the supported
  OHLCV studies locally and keeps the cursor-centered zoom/pan interaction.
- Typography uses the existing global Inter stack and Quant sizing tokens in
  `styles.css`; no external font dependency is introduced.
