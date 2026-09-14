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

it('notifies the authenticated shell when a market request finds an expired session', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } })))
  const expired = vi.fn(), provider = createMarketDataProvider('00000000-0000-4000-8000-000000000001', expired)
  await expect(provider.catalogProviders?.()).rejects.toThrow('Provider catalog unavailable')
  expect(expired).toHaveBeenCalledTimes(1)
})

it('routes live Capital catalog symbols through the authenticated backend stream', async () => {
  const accountId = '00000000-0000-4000-8000-000000000001'
  const catalogRow = { instrumentId: 'CAPITAL:EURUSD', provider: 'CAPITAL', providerSymbol: 'EURUSD', displaySymbol: 'EUR/USD', name: 'Euro / US Dollar CFD', exchange: 'Capital.com', assetClass: 'FOREX', base: 'EUR', quote: 'USD', supportedModes: ['HISTORICAL', 'REALTIME'] }
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [catalogRow], nextCursor: null }), { headers: { 'Content-Type': 'application/json' } }))
    .mockResolvedValueOnce(new Response('', { status: 503, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetcher)
  const provider = createMarketDataProvider(accountId)
  const selected = (await provider.searchPage!({ provider: 'CAPITAL', query: '', assetClass: 'FOREX' })).items[0]
  expect(selected).toMatchObject({ symbol: 'EUR-USD', providerSymbol: 'EURUSD', provider: 'CAPITAL' })
  provider.subscribeCandles({ symbol: selected.symbol, interval: '1m' }, { onCandle: vi.fn(), onStatus: vi.fn(), onReconnect: vi.fn() })
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(fetcher.mock.calls[1][0]).toContain('/api/market/stream?symbol=EUR-USD&timeframe=1m&provider=CAPITAL')
  expect(new Headers(fetcher.mock.calls[1][1]?.headers).get('X-Workspace-User')).toBe(accountId)
})
