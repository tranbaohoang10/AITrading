# PB-033 — Live Chart Workspace and semantic drawing toolbar

Issue: #34
Date: 04/09/2026 (Asia/Ho_Chi_Minh)

## Goal and scope

Replace the production Chart Workspace's static demo series with read-only Binance Spot public candles and make the existing drawing toolbar communicate each tool's real meaning. The existing React SVG chart renderer, drawing engine and private imported-dataset APIs remain intact; this feature does not embed TradingView, copy its assets, place orders or write market data to the database.

## Use case: inspect a live public market

Actor: authenticated workspace user. Trigger: open Chart Workspace or select a supported symbol/interval.

Preconditions: browser can reach Binance public REST/WebSocket endpoints. Postconditions: the chart retains the most recently verified historical candles if its stream disconnects.

1. The workspace requests 500 historical Binance candles for the selected symbol and interval.
2. It validates, sorts and deduplicates them by UTC `openTime`, then renders them.
3. It opens exactly one kline stream for the same selection and exposes CONNECTING, LIVE or DISCONNECTED.
4. A message in the current `openTime` replaces the last candle; a new `openTime` appends exactly one candle.
5. A symbol/interval change cancels the old request/stream, clears display state, loads the new history and subscribes once.
6. A close/error retries with capped exponential backoff; successful reconnection resyncs historical data before continuing.

## Acceptance criteria

| ID | Requirement |
| --- | --- |
| AC-01 | Chart Workspace defaults to BTCUSDT/1m public Binance Spot candles, not a static/mock/fake-live series. |
| AC-02 | BTCUSDT, ETHUSDT and SOLUSDT plus 1m, 5m, 15m, 30m, 1h, 4h and 1d are selectable; stale subscriptions cannot update the new selection. |
| AC-03 | Historical data is validated, UTC-sorted and deduplicated; realtime merges replace matching `openTime` and append only new buckets. |
| AC-04 | Header exposes BINANCE and truthful CONNECTING/LIVE/DISCONNECTED status, current price and OHLC/crosshair data from the received candles. |
| AC-05 | The left rail has semantic Cursor/Crosshair, line, Fibonacci, brush, shape, text, pattern, position, measure and utility icons with labels, tooltips, active/disabled states. Unsupported tools are visibly disabled. |
| AC-06 | Reconnect is bounded exponential backoff and all timer/socket work is cleaned up on change/unmount. |

## Security and data impact

Only public, read-only Binance endpoints are used. No API key, secret, token, private user stream, order endpoint, backend proxy, PostgreSQL/Flyway migration or persistent market-data record is introduced. Public payloads are parsed as `unknown`, shape/number validated and bounded to 1,000 client candles. XSS, IDOR/BOLA, CSRF, injection, secret exposure and authorization changes are N/A because the feature accepts no user-generated markup and makes no authenticated mutation; malformed external payloads are rejected/ignored.

## Definition of Done

All ACs, provider mapping/merge/lifecycle/switch/toolbar tests, relevant frontend regression/lint/build, backend test/build and browser visual QA pass. The issue must contain evidence, no proprietary TradingView asset or fake realtime remains in production ChartView, and the verified commit is pushed to `origin/main`.
