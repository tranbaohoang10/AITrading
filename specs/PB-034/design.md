# PB-034 — Design

## Provider and rendering flow

```text
LiveChart -> CoinbaseMarketDataProvider.listProducts() -> Coinbase Exchange products
LiveChart -> getHistoricalCandles(symbol, interval) -> REST candles -> validate/sort/dedupe/aggregate
LiveChart -> subscribeCandles(symbol, interval, seed) -> public matches WebSocket
matches -> market-data OHLCV bucket aggregator -> mergeCandles -> existing CandleChart SVG
```

The SVG renderer remains provider-neutral. `CoinbaseMarketDataProvider` owns Coinbase payload parsing, timeframe source selection, UTC bucket aggregation, reconnection and socket cleanup. `LiveChart` only holds the selected domain candles.

## Timeframe mapping

| Display interval | Coinbase REST source | Transformation |
| --- | --- | --- |
| 1m | 60 seconds | direct |
| 5m | 300 seconds | direct |
| 15m | 900 seconds | direct |
| 30m | 900 seconds | aggregate UTC pairs |
| 1h | 3600 seconds | direct |
| 4h | 3600 seconds | aggregate UTC groups of four |
| 1d | 86400 seconds | direct |

The Exchange endpoint caps each request at 300 source candles, so a bounded number of contiguous requests obtains up to the requested 300 target candles for derived intervals. No candle is invented for an interval with no trade.

## Realtime sequence

```text
User -> LiveChart: change BTC-USD/1m to ETH-USD/5m
LiveChart -> old subscription: unsubscribe, clear timer, close socket
LiveChart -> Coinbase REST: load/validate ETH-USD 5m history
LiveChart -> Coinbase WS matches: subscribe ETH-USD
Coinbase WS -> provider: match(price,size,time)
provider -> provider: UTC bucket aggregate from seeded last candle
provider -> LiveChart: replace same openTime or append later openTime
Coinbase WS -> provider: close/error
provider -> LiveChart: RECONNECTING, capped exponential retry
provider -> LiveChart: reconnect callback -> history reconciliation
```

## UX decisions

`CandleChart` now resets chart state only for an identity change, not for each increase in candle count. New candles keep a following-latest viewport at the right edge but do not alter an historical pan or a manually adjusted price range. Price-axis hit detection precedes drawing-mode handling, enabling vertical scale drag from any active tool; double-click removes the manual price range.

The header is HTML over the SVG so its compact asset icon, market source and responsive text are accessible and do not collide with axis labels. The toolbar consolidates related tools under eight stable groups and keeps one flyout open. Unsupported functionality remains disabled rather than being represented as a working tool.
