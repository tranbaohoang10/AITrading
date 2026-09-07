import { afterEach, expect, it, vi } from 'vitest'
import { createMarketDataProvider } from './MarketDataProviders'

afterEach(() => vi.unstubAllGlobals())
it('binds Forex and equity requests to the account that created the provider', async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetcher)
  const firstId = '00000000-0000-4000-8000-000000000001', secondId = '00000000-0000-4000-8000-000000000002'
  const first = createMarketDataProvider(firstId), second = createMarketDataProvider(secondId)
  await first.getHistoricalCandles({ symbol: 'EUR-USD', interval: '1d', limit: 10 })
  await second.getHistoricalCandles({ symbol: 'AAPL', interval: '1d', limit: 10 })
  await first.getHistoricalCandles({ symbol: 'AAPL', interval: '1d', limit: 10 })
  expect(fetcher.mock.calls.map(([, options]) => new Headers(options.headers).get('X-Workspace-User'))).toEqual([firstId, secondId, firstId])
})
