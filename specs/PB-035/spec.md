# PB-035 — Chart interaction, grouped drawings and AI Chart Capture

Issue: #36
Date: 04/09/2026 (Asia/Ho_Chi_Minh)

## Goal and scope

Improve the existing Coinbase-only SVG chart experience without changing the fixed stack, market provider, Strategy DSL or authentication model. The chart must provide stable time and price navigation, a left-gutter grouped drawing rail, and an honest capture-to-Assistant path using the existing conversation/provider boundary.

The repository does not contain Lightweight Charts or a chart library version. `CandleChart` is the current SVG renderer, so this feature uses its data-space projection and adds equivalent observable behavior rather than introducing a dependency for hypothetical API access.

## Acceptance criteria

| ID | Requirement |
| --- | --- |
| AC-01 | Topbar has an explicit left cluster containing market controls, Coinbase status/current price and chart/workspace actions. Refresh and Camera are in a separate right cluster with the only auto margin. |
| AC-02 | The chart distinguishes time pan, time zoom, price-scale zoom and price-range pan. Manual AUTO/MANUAL price state survives realtime ticks, new candles, crosshair movement, resize and assistant-panel resize; symbol/timeframe reset may return to AUTO. Double-click axis, Auto and `0` reset cleanly. |
| AC-03 | Price axis uses sensible dynamic ticks/precision and margins, with no fake unsupported scale modes. |
| AC-04 | Drawings remain anchored by `{time, price}` after time/price pan, zoom, resize and realtime updates. The rail is a compact left gutter with one last-used main cell per group and one open flyout; Parallel Channel and Price Note are real tools. Unsupported pattern tools are visibly disabled rather than fake. |
| AC-05 | AI Capture enters a transient mode, dims outside a plot-bounded selection, supports 8-handle resize and move, shows an Ask Quant prompt, and cleans up on Escape/right-click/outside/success. It is never persisted as a drawing. |
| AC-06 | Capture and full-chart Camera use one bounded PNG pipeline with correct region/DPR handling and safe chart metadata. They send through the existing Assistant path when supported; unconfigured/unavailable provider state is reported honestly without fabricated AI output. |
| AC-07 | Coinbase remains the sole production market-data source; no broker, execution, secret or unrelated strategy changes are introduced. |

## Security and data impact

Capture includes only the active chart plot crop and allow-listed metadata (symbol, provider, timeframe, visible/captured ranges, current price and selected drawing IDs). It never serializes browser DOM, sidebar content, credentials or provider keys. The image path is bounded and the existing AI provider validation remains authoritative. No database migration is required unless inspection proves an existing attachment contract can be extended safely; otherwise the honest unavailable state is retained.

## Definition of Done

Implementation, focused automated tests, lint, TypeScript/Vite build and real browser QA cover AC-01–07. The exact commit is pushed fast-forward to `origin/main`, evidence is appended to this feature history, and Issue #36 is closed only if all P0 criteria and the capture integration are verified.
