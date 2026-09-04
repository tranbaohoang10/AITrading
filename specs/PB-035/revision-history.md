# PB-035 — Revision history

All timestamps use Asia/Ho_Chi_Minh.

## 04/09/2026

- Created Issue #36 for the post-#35 chart interaction, grouped drawings and AI Chart Capture phase.
- Confirmed from repository inspection that the chart is a custom SVG renderer and `lightweight-charts` is not installed; no dependency upgrade is justified before proving a requirement needs it.
- Confirmed Assistant conversation persistence is text-only at the current API boundary, while Image Analysis is a separate validated multipart flow. Integration must therefore reuse existing state/provider abstractions or report an honest capability boundary.
- Reviewed official TradingView, Lightweight Charts and LuxAlgo documentation for time/price navigation, grouped data-space drawings, capture workflow, Magnet/Stay/Eraser and keyboard patterns. No source, logo or asset was copied.
- Implemented custom-SVG viewport navigation, Coinbase-only chart context, grouped drawing rail, transient AI Capture overlay, full-chart export actions and the existing Assistant attachment route. Earlier binary attachments are not replayed into later provider turns; only the current capture is sent as image data.
- Added frontend chart-capture bridge tests and OpenAI/Gemini inline-image contract tests. Browser QA used the running local Quant tab with live Coinbase candles; unsupported pattern tools were confirmed disabled.
- Browser pointer QA then found and fixed Escape cleanup when the capture prompt input had focus. A second run verified drag creation, 8-handle resize, selection move, Escape cleanup and right-click cleanup on the live chart.
