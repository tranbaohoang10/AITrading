import { catalogAccess } from './providerCatalog'

const instrument = { instrumentId: 'BINANCE:BTCUSDT', provider: 'BINANCE', providerSymbol: 'BTCUSDT', displaySymbol: 'BTC/USDT', name: 'BTC/USDT', exchange: 'Binance', assetClass: 'CRYPTO', base: 'BTC', quote: 'USDT', priceIncrement: .01 }
it('keeps provider identity separate and rejects hostile catalog rows and oversized pages', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ items: [instrument], nextCursor: null })))
  const api = catalogAccess(fetcher)
  expect((await api.searchPage({ provider: 'BINANCE', query: '' })).items[0]).toMatchObject({ symbol: 'BINANCE:BTCUSDT', providerSymbol: 'BTCUSDT', feed: 'PUBLIC · HISTORICAL' })
  for (const items of [[{ ...instrument, provider: 'COINBASE' }], [{ ...instrument, providerSymbol: '../../private' }], [instrument, instrument], Array(51).fill(instrument)]) {
    fetcher.mockImplementationOnce(async () => new Response(JSON.stringify({ items, nextCursor: null })))
    await expect(api.searchPage({ provider: 'BINANCE', query: '' })).rejects.toThrow()
  }
  const count = fetcher.mock.calls.length
  await expect(api.searchPage({ provider: 'https://localhost', query: '' })).rejects.toThrow()
  expect(fetcher.mock.calls).toHaveLength(count)
})
