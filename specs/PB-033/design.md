# PB-033 — Design

## Component and provider flow

```text
LiveChart
  -> MarketDataProvider.getHistoricalCandles(symbol, interval, 500)
  -> Binance REST /api/v3/klines
  -> validate + sort + deduplicate MarketCandle[]
  -> CandleChart (existing SVG renderer)

LiveChart
  -> MarketDataProvider.subscribeCandles(symbol, interval)
  -> Binance kline WebSocket
  -> validate MarketCandle -> merge by openTime -> CandleChart update
```

`MarketDataProvider` is the extension boundary. `BinanceMarketDataProvider` is the only implementation in this MVP; a future MT5/Forex/Futures provider can implement the same historical/subscribe contract without coupling `CandleChart` to Binance JSON.

## Sequence: selection and reconnect

```text
User -> LiveChart: select BTCUSDT / 5m
LiveChart -> old subscription: unsubscribe + close socket
LiveChart -> Binance REST: GET klines (500)
Binance REST --> LiveChart: historical rows
LiveChart -> LiveChart: validate/sort/dedupe/render
LiveChart -> Binance WS: btcusdt@kline_5m
Binance WS --> LiveChart: current kline
LiveChart -> LiveChart: replace last / append new openTime
Binance WS --> LiveChart: close/error
LiveChart -> LiveChart: DISCONNECTED, bounded backoff
LiveChart -> Binance WS: reconnect
LiveChart -> Binance REST: resync latest history
```

## Domain model

```text
MarketCandle
  symbol: BTCUSDT | ETHUSDT | SOLUSDT
  interval: 1m | 5m | 15m | 30m | 1h | 4h | 1d
  openTime, closeTime: Unix milliseconds / UTC
  open, high, low, close, volume: validated decimal strings
  closed: boolean
```

The existing renderer receives a small adapter with ISO UTC time and ordinal. It is intentionally not coupled to Binance's array/object payloads.

## UI design

The dark AITrading rail remains vertical on desktop and horizontally scrollable on small viewports. Each icon is a project-owned SVG path (no TradingView branding or asset). Cursor and Crosshair are distinct selectable navigation states; unsupported pattern/advanced tools are disabled with a reason in their tooltip. Magnet, stay-drawing, lock-all, hide-all and remove-all reflect real drawing state; zoom remains intentionally disabled because the renderer's supported control is wheel zoom, rather than pretending the button is wired.
