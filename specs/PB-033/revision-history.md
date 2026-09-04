# PB-033 — Revision history

All timestamps use Asia/Ho_Chi_Minh.

## 04/09/2026

- Created Issue #34 after inspecting the existing React SVG `CandleChart`, `DatasetChart`, `ChartToolsRail`, private dataset API and Spring market import service.
- Decided not to replace the maintained renderer or introduce `lightweight-charts`: the existing renderer already supports candles, crosshair, zoom/pan, responsive `ResizeObserver` layout and drawing state. The smallest justified addition is an independent public-data provider plus LiveChart adapter.
- Verified Binance public kline contract against official developer documentation. The public REST/stream integration requires no API key; it does not access user-data streams or trading endpoints.
- Added `MarketCandle` and `MarketDataProvider`, with `BinanceMarketDataProvider` as the first read-only implementation. REST history is limited to 1,000 and validated before render; WebSocket reconnection uses capped exponential backoff and cleanup closes the active socket/timer.
- Replaced the production `ChartView` static demo route with `LiveChart`: BTCUSDT/1m starts with 500 historical candles followed by one Binance kline stream. BTCUSDT, ETHUSDT and SOLUSDT plus the seven supported intervals are selectable.
- Reworked the left rail to use semantic project-owned SVG icons. Cursor/Crosshair are actual navigation modes; unsupported advanced tools are disabled. Magnet, stay-drawing, lock-all, hide-all and remove-all expose real state where the drawing engine supports it.
- Verification: frontend full suite 32 files/233 tests, ESLint and production build passed; backend Gradle test/build passed. A read-only live Binance REST request returned current BTCUSDT 1m OHLC rows. Interactive browser acceptance was not run because the local browser had no authenticated session; no credential was read or reused.
