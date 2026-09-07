import { expect, it } from 'vitest'
import type { Candle } from '../market/api'
import { atr, bollinger, cci, ema, macd, obv, rsi, sma, stochastic, vwap, wma } from '../market/chartMath'

it('every Replay study preserves revealed values when all future OHLCV changes', () => {
  const candles: Candle[] = Array.from({ length: 90 }, (_, ordinal) => ({ ordinal,
    time: new Date(Date.UTC(2025, 0, 1, ordinal)).toISOString(),
    open: String(100 + ordinal), high: String(104 + ordinal), low: String(98 + ordinal),
    close: String(101 + ordinal), volume: String(ordinal + 1) }))
  const cursor = 54
  const altered = candles.map((c, i) => i <= cursor ? c : { ...c, open: '1', high: '900000', low: '0.1', close: '500000', volume: '999999' })
  const studies = (items: Candle[]) => {
    const close = items.map(c => Number(c.close))
    const bands = bollinger(close, 20)
    return [sma(close, 20), ema(close, 20), wma(close, 20), rsi(close, 14),
      bands.middle, bands.upper, bands.lower, macd(close), vwap(items), atr(items, 14),
      stochastic(items, 14), cci(items, 20), obv(items)]
  }
  const revealed = studies(candles.slice(0, cursor + 1))
  for (const source of [candles, altered]) {
    studies(source).forEach((values, index) => expect(values.slice(0, cursor + 1)).toEqual(revealed[index]))
  }
})
