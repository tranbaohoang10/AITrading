import { describe, expect, it } from 'vitest'
import { FrankfurterMarketDataProvider } from './FrankfurterMarketDataProvider'

const row = { openTime: 1_788_566_400_000, closeTime: 1_788_652_799_999, open: '1.1622', high: '1.1622', low: '1.1622', close: '1.1622', volume: '0', closed: true }

describe('FrankfurterMarketDataProvider', () => {
  it('maps the bounded same-origin daily reference response without inventing an intraday range', async () => {
    const calls: string[] = []
    const fetcher: typeof fetch = async input => { calls.push(String(input)); return new Response(JSON.stringify([row]), { status: 200, headers: { 'Content-Type': 'application/json' } }) }
    const provider = new FrankfurterMarketDataProvider(fetcher)
    await expect(provider.getHistoricalCandles({ symbol: 'EUR-USD', interval: '1d', limit: 700 })).resolves.toEqual([{ ...row, symbol: 'EUR-USD', interval: '1d' }])
    await expect(provider.listProducts()).resolves.toContain('XAU-USD')
    await expect(provider.listInstruments()).resolves.toContainEqual(expect.objectContaining({ symbol: 'XAU-USD', assetClass: 'COMMODITY', modes: ['HISTORICAL', 'DELAYED'] }))
    expect(calls[0]).toContain('symbol=EUR-USD')
    expect(calls[0]).toContain('limit=600')
  })

  it('rejects unsupported symbols and intraday requests before network access', async () => {
    let calls = 0
    const fetcher: typeof fetch = async () => { calls += 1; return new Response('[]') }
    const provider = new FrankfurterMarketDataProvider(fetcher)
    await expect(provider.getHistoricalCandles({ symbol: 'BTC-USD', interval: '1d', limit: 1 })).rejects.toThrow('Reference market data is available in 1D only.')
    await expect(provider.getHistoricalCandles({ symbol: 'EUR-USD', interval: '1m', limit: 1 })).rejects.toThrow('Reference market data is available in 1D only.')
    expect(calls).toBe(0)
  })
})
