# PB-035 — Design

## Current architecture facts

`LiveChart` owns Coinbase history/subscription state and passes neutral candles into the custom SVG `CandleChart`. `ChartControls` owns the drawing rail and PNG export utility. `ConversationProvider` owns the current Assistant conversation and only persists text messages; image analysis currently has a separate multipart endpoint and structured result store. No Lightweight Charts package is installed.

## Smallest justified design

1. Keep market data and candle/drawing data-space models unchanged. Extend `CandleChart` navigation with an explicit manual price range state and anchored Y-scale transform. Keep the identity reset on symbol/timeframe only.
2. Make the chart header `topbar > leftCluster + rightCluster`; `ChartUtilities` becomes the right utility cluster and no longer decides global alignment.
3. Extend the existing grouped rail with only tools already renderable by the SVG engine, and mark pattern placeholders disabled. Parallel Channel uses the existing three-anchor renderer; Price Note reuses the existing text anchor path.
4. Add a reusable chart capture module for SVG-to-PNG and a transient capture overlay in `CandleChart`. Capture emits a typed request upward; it does not mutate `drawings`.
5. Reuse the existing Assistant state/service only at its current public boundary. If the current conversation API cannot carry an image without a safe backend/provider extension, show the provider/unavailable result and do not simulate an assistant answer. Any backend extension must use the existing `AiProvider` abstraction for both Gemini and OpenAI.

## Interaction state

```text
AUTO --axis scale drag or chart Y pan--> MANUAL
MANUAL --new candle / tick / resize / crosshair--> MANUAL
MANUAL --double click axis / Auto / 0--> AUTO
symbol or timeframe change ---------------------> AUTO
```

Time viewport is separate from price state. Horizontal drag changes bar start; wheel changes bar count around the cursor. A chart drag can change both axes according to pointer delta. Axis drag changes span around the pointer's initial price (scale zoom), preventing the old edge-pinning bug.

## Reference review

- TradingView time-scale documentation: https://tradingview.com/charting-library-docs/latest/ui_elements/Time-Scale/
- Lightweight Charts price scale and visible-range documentation: https://tradingview.github.io/lightweight-charts/docs/5.1/time-scale and https://tradingview.github.io/lightweight-charts/docs/4.0/api/interfaces/PriceScaleOptions
- LuxAlgo official drawings documentation: https://docs.luxalgo.com/platform/charts/drawings
- LuxAlgo official selected-region workflow: https://docs.luxalgo.com/platform/quant/indicators

These are behavior/IA references only. No proprietary source, logo or asset is copied.
