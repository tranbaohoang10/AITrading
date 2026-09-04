# PB-034 — Coinbase realtime chart and compact chart UX

Issue: #35
Date: 04/09/2026 (Asia/Ho_Chi_Minh)

## Goal and scope

The production Chart Workspace uses Coinbase Exchange public market data only. It presents BTC-USD and ETH-USD historical OHLCV and public WebSocket trade updates through the existing React/SVG renderer. This feature also corrects the chart header, realtime viewport behavior, right price scale and drawing rail density. It does not change any strategy, backtest, broker, authentication, journal, RAG or database behavior.

## Use case: inspect a live Coinbase market

An authenticated workspace user opens the chart, selects a Coinbase USD product and interval, then inspects live candles, historical candles and drawing tools.

1. The chart obtains a Coinbase product list and keeps supported USD products, with BTC-USD and ETH-USD always available as safe initial choices.
2. It loads public REST history, validates external values into a neutral `MarketCandle`, sorts and deduplicates by UTC `openTime`.
3. It starts one public Coinbase matches subscription for that symbol/interval. Trade events are aggregated to OHLCV outside React.
4. A same-bucket event replaces the current candle; a later bucket finalizes/appends one candle. Changing symbol/interval aborts history and closes the former stream.
5. The user hovers a candle to see its formatted OHLC, intra-candle change and colored volume; leaving shows the latest received candle.
6. The user pans/zooms without a live update resetting their time/price viewport, and can drag/double-click the right price axis.

## Acceptance criteria

| ID | Requirement |
| --- | --- |
| AC-01 | Production chart has no Binance/OANDA/FXCM provider or selector; BTC-USD and ETH-USD use Coinbase public REST/WSS data, never generated prices. |
| AC-02 | The neutral candle contract carries symbol, interval, UTC open/close time, O/H/L/C, volume and closed state. History validates, orders and deduplicates. |
| AC-03 | `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d` map centrally. Coinbase-supported source granularities are used directly and 30m/4h aggregate in the market-data layer. |
| AC-04 | Realtime matches update the current bucket or append the next bucket without duplicate times. Old streams are cleaned up; reconnect uses bounded backoff and reconciles history. |
| AC-05 | Chart header shows an asset icon, `SYMBOL · COINBASE · INTERVAL`, formatted O/H/L/C and intra-candle change. Hover changes header/volume to that candle and volume color follows its candle direction. |
| AC-06 | Right price axis has vertical drag and double-click autoscale reset. Realtime and resize preserve a user zoom/pan/price scale. |
| AC-07 | Chart actions stay left after market selection/status and Refresh/Capture remain right. The drawing rail contains only Cursor/Crosshair, Lines, Fib, Draw/Shapes, Text, Position, Measure and More; destructive remove-all is confirmed. |

## Security and data impact

No schema, migration, credentials, authenticated exchange endpoint, order submission or persistence is added. Public JSON is treated as untrusted, parsed from `unknown`, constrained to valid decimal/timestamp/product values, and bounded to 1,000 rendered candles. Injection, IDOR/BOLA, CSRF, secret exposure and account authorization changes are not applicable because this is a read-only public-client integration with no user-entered remote endpoint.

## Definition of Done

All ACs have implementation and automated coverage; frontend lint/test/build pass; read-only Coinbase REST smoke and real-browser QA are recorded when the local authenticated workspace is reachable; no critical/high chart defect remains; documented commit is pushed to `origin/main` and the Issue has final evidence.
