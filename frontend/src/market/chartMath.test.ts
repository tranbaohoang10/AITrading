import type { Candle } from './api'
import { aggregateCandles, atr, bollinger, ema, macd, rsi, sma, timeframeAvailability, vwap } from './chartMath'

const candle = (minute: number, open: number, high: number, low: number, close: number, volume: number): Candle => ({
  ordinal: minute,
  time: new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString().replace('.000Z', 'Z'),
  open: String(open), high: String(high), low: String(low), close: String(close), volume: String(volume),
})

describe('PB-031 chart display math', () => {
  it('aggregates OHLCV into deterministic UTC buckets without fabricating gaps', () => {
    const source = [
      candle(0, 10, 12, 9, 11, 2), candle(1, 11, 14, 10, 13, 3), candle(4, 13, 15, 8, 9, 5),
      candle(10, 20, 23, 19, 22, 7),
    ]
    const result = aggregateCandles(source, '1m', '5m')
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ time: '2026-01-01T00:00:00Z', open: '10', high: '15', low: '8', close: '9', volume: '10' })
    expect(result[1]).toMatchObject({ time: '2026-01-01T00:10:00Z', open: '20', close: '22', volume: '7' })
  })

  it('does not derive lower or incompatible intervals', () => {
    const source = [candle(0, 1, 2, 1, 2, 1)]
    expect(aggregateCandles(source, '5m', '1m')).toBe(source)
    const availability = timeframeAvailability('15m')
    expect(availability.find(item => item.value === '5m')).toMatchObject({ enabled: false })
    expect(availability.find(item => item.value === '1h')).toMatchObject({ enabled: true })
  })

  it('calculates SMA and seeded EMA with explicit warm-up gaps', () => {
    expect(sma([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3])
    expect(ema([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3])
  })

  it('calculates Wilder RSI deterministically', () => {
    const result = rsi([1, 2, 3, 2, 4, 5], 3)
    expect(result.slice(0, 3)).toEqual([null, null, null])
    expect(result[3]).toBeCloseTo(66.6667, 3)
    expect(result[5]).toBeCloseTo(87.8788, 3)
  })

  it('calculates the supported Coinbase OHLCV studies without future values', () => {
    const source = [candle(0, 10, 12, 9, 11, 2), candle(1, 11, 14, 10, 13, 3), candle(2, 13, 15, 12, 14, 5), candle(3, 14, 16, 13, 15, 7)]
    const bands = bollinger(source.map(item => Number(item.close)), 3, 2)
    expect(bands.middle.slice(0, 2)).toEqual([null, null])
    expect(bands.upper[2]).toBeGreaterThan(bands.middle[2]!)
    expect(vwap(source)[0]).toBeCloseTo(10.6666667, 5)
    expect(atr(source, 3).slice(0, 2)).toEqual([null, null])
    expect(atr(source, 3)[3]).toBeCloseTo((3 + 4 + 3) / 3, 5)
    expect(macd([10, 11, 12, 13, 14], 2, 3).slice(0, 2)).toEqual([null, null])
    expect(macd([10, 11, 12, 13, 14], 2, 3)[4]).toBeCloseTo(.5, 5)
  })
})
