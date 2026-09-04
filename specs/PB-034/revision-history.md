# PB-034 — Revision history

All timestamps use Asia/Ho_Chi_Minh.

## 04/09/2026

- Created Issue #35 and scoped the replacement of the immediately prior Binance production chart integration to Coinbase-only public market data at Product Owner direction.
- Confirmed against Coinbase official Exchange documentation: REST candles are public, capped at 300 source rows per request, expose the `[time, low, high, open, close, volume]` schema and support 60/300/900/3600/21600/86400-second granularities. The public `matches` WebSocket channel supplies `product_id`, `price`, `size` and UTC `time` for market-layer OHLCV aggregation.
- Diagnosed the original realtime viewport regression: a `CandleChart` effect keyed by `total` reset `manualPrices`, full viewport and following state whenever a new candle was appended. The implementation will key identity reset to symbol only and preserve user navigation across updates/resizes.
- Replaced the production Binance provider with `CoinbaseMarketDataProvider`. It uses public `/products`, `/products/{id}/candles` and `wss://ws-feed.exchange.coinbase.com` matches only; BTC-USD/ETH-USD are default choices and the rendered product menu is populated from validated public products.
- Added centralized timeframe milliseconds and provider-owned UTC aggregation for 30m and 4h, as the public Exchange candles endpoint does not support those granularities directly. The UI never aggregates provider raw rows.
- Rebuilt the rail as eight compact groups. Cursor/Crosshair and related drawing variants use a flyout; More contains magnet, lock/hide all and a two-step remove-all confirmation. No fake unavailable action was left on the primary rail.
- Added asset icon/header formatting and candle-local `C - O` change; hover and volume inspect the same candle and use its own direction color. Realtime preserves a manually navigated viewport and manual price range; right-axis drag works before drawing-mode handling and double-click resets autoscale.
- Browser QA on the local running app confirmed BTC-USD/1m, ETH-USD/1m and ETH-USD/30m Coinbase history/live status, compact toolbar and header. Automated frontend tests, lint and build pass; a read-only Coinbase BTC-USD REST response was sampled without credentials.
