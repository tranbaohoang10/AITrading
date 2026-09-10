import { catalogAccess } from './providerCatalog'

const instrument = { instrumentId: 'COINBASE:BTC-USD', provider: 'COINBASE', providerSymbol: 'BTC-USD', displaySymbol: 'BTC/USD', name: 'Bitcoin / US Dollar', exchange: 'Coinbase', assetClass: 'CRYPTO', base: 'BTC', quote: 'USD', priceIncrement: .01, supportedModes: ['HISTORICAL', 'REALTIME'] }
it('keeps provider identity internal and rejects historical-only or hostile catalog rows', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ items: [instrument], nextCursor: null })))
  const api = catalogAccess(fetcher)
  expect((await api.searchPage({ provider: 'COINBASE', query: '' })).items[0]).toMatchObject({ symbol: 'BTC-USD', providerSymbol: 'BTC-USD', modes: ['HISTORICAL', 'REALTIME'] })
  for (const items of [[{ ...instrument, provider: 'BINANCE' }], [{ ...instrument, providerSymbol: '../../private' }], [instrument, instrument], Array(51).fill(instrument)]) {
    fetcher.mockImplementationOnce(async () => new Response(JSON.stringify({ items, nextCursor: null })))
    await expect(catalogAccess(fetcher).searchPage({ provider: 'COINBASE', query: '' })).rejects.toThrow()
  }
  fetcher.mockImplementationOnce(async () => new Response(JSON.stringify({ items: [{ ...instrument, supportedModes: ['HISTORICAL'] }], nextCursor: null })))
  expect((await catalogAccess(fetcher).searchPage({ provider: 'COINBASE', query: '' })).items[0].modes).toEqual(['HISTORICAL'])
  const count = fetcher.mock.calls.length
  await expect(api.searchPage({ provider: 'UNKNOWN', query: '' })).rejects.toThrow()
  expect(fetcher.mock.calls).toHaveLength(count)
})

it('preserves configured historical providers separately from realtime readiness', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ items: [
    { providerId: 'COINBASE', displayName: 'Coinbase', assetClasses: ['CRYPTO'], configured: true, displayAllowed: true, licenseStatus: 'ACCEPTED', historical: true, realtime: true, delayed: false, eod: false },
    { providerId: 'BINANCE', displayName: 'Binance archive', assetClasses: ['CRYPTO'], configured: true, displayAllowed: true, licenseStatus: 'ACCEPTED', historical: true, realtime: false, delayed: false, eod: false },
    { providerId: 'FRANKFURTER', displayName: 'Frankfurter', assetClasses: ['FX_REFERENCE'], configured: true, displayAllowed: true, licenseStatus: 'ACCEPTED', historical: true, realtime: false, delayed: true, eod: true },
    { providerId: 'CTRADER', displayName: 'cTrader', assetClasses: ['FOREX', 'COMMODITY'], configured: false, displayAllowed: true, licenseStatus: 'CONDITIONAL', historical: true, realtime: true, delayed: false, eod: false },
  ] })))
  await expect(catalogAccess(fetcher).catalogProviders()).resolves.toEqual([expect.objectContaining({ providerId: 'COINBASE', realtime: true }), expect.objectContaining({ providerId: 'BINANCE', realtime: false }), expect.objectContaining({ providerId: 'FRANKFURTER', realtime: false }), expect.objectContaining({ providerId: 'CTRADER', configured: false })])
})

it('accepts account-discovered OANDA symbols without exposing route labels', async () => {
  const row = { ...instrument, instrumentId: 'OANDA:EUR_USD', provider: 'OANDA', providerSymbol: 'EUR_USD', displaySymbol: 'EUR/USD', name: 'Euro / U.S. Dollar', exchange: 'OANDA account', assetClass: 'FOREX', base: 'EUR', quote: 'USD' }
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ items: [row], nextCursor: null })))
  await expect(catalogAccess(fetcher).searchPage({ provider: 'OANDA', query: '' })).resolves.toMatchObject({ items: [expect.objectContaining({ symbol: 'EUR_USD', displaySymbol: 'EUR/USD', modes: ['HISTORICAL', 'REALTIME'] })] })
})

it('reuses bounded catalog responses only within one account provider and TTL', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ items: [instrument], nextCursor: null })))
  const first = catalogAccess(fetcher), second = catalogAccess(fetcher)
  const now = vi.spyOn(Date, 'now').mockReturnValue(100000)
  try {
    await first.searchPage({ provider: 'COINBASE', query: 'BTC' })
    await first.searchPage({ provider: 'COINBASE', query: 'BTC' })
    expect(fetcher).toHaveBeenCalledTimes(1)
    await second.searchPage({ provider: 'COINBASE', query: 'BTC' })
    expect(fetcher).toHaveBeenCalledTimes(2)
    now.mockReturnValue(401000)
    await first.searchPage({ provider: 'COINBASE', query: 'BTC' })
    expect(fetcher).toHaveBeenCalledTimes(3)
  } finally { now.mockRestore() }
})

it('shares catalog responses across remounted providers only for the same account scope', async () => {
  const firstFetch = vi.fn(async () => new Response(JSON.stringify({ items: [instrument], nextCursor: null })))
  const secondFetch = vi.fn(async () => new Response(JSON.stringify({ items: [instrument], nextCursor: null })))
  const first = catalogAccess(firstFetch as typeof fetch, 'account:remount-a')
  const remounted = catalogAccess(secondFetch as typeof fetch, 'account:remount-a')
  const otherAccount = catalogAccess(secondFetch as typeof fetch, 'account:remount-b')
  await first.searchPage({ provider: 'COINBASE', query: '' })
  await remounted.searchPage({ provider: 'COINBASE', query: '' })
  expect(firstFetch).toHaveBeenCalledTimes(1)
  expect(secondFetch).not.toHaveBeenCalled()
  await otherAccount.searchPage({ provider: 'COINBASE', query: '' })
  expect(secondFetch).toHaveBeenCalledTimes(1)
})
