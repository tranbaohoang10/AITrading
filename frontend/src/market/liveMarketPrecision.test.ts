import { describe, expect, it } from 'vitest'
import { formatMarketPrice, precisionFromIncrement, validMarketCandle } from './liveMarket'

describe('PB-038 neutral market metadata', () => {
  it('derives precision from the instrument tick increment', () => {
    expect(precisionFromIncrement(.01)).toBe(2)
    expect(precisionFromIncrement(.0001)).toBe(4)
    expect(formatMarketPrice(1.23456, .0001)).toBe('1.2346')
  })

  it('rejects malformed or impossible provider candles before rendering', () => {
    const valid = { openTime: 1, closeTime: 2, open: '1.00', high: '1.20', low: '0.90', close: '1.10', volume: '0', closed: true }
    expect(validMarketCandle(valid, 'BTC-USD', '1m')).toMatchObject({ symbol: 'BTC-USD', interval: '1m' })
    expect(validMarketCandle({ ...valid, high: '0.80' }, 'BTC-USD', '1m')).toBeNull()
  })
})
