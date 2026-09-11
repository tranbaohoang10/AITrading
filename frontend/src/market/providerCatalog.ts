import { validExchangeTimezone } from './chartTimezone'
import { precisionFromIncrement, validMarketCandle, type Instrument, type MarketDataProvider } from './liveMarket'
import { timeframeMilliseconds } from './chartMath'

export type CatalogProvider = { providerId: string; displayName: string; assetClasses: string[]; historical?: boolean; realtime: boolean; delayed?: boolean; eod?: boolean; configured?: boolean }
export type CatalogRequest = { provider: string; query: string; assetClass?: string; cursor?: string; signal?: AbortSignal }
export type UnifiedCatalogRequest = { query: string; assetClass?: string; exchange?: string; country?: string; active?: boolean; cursor?: string; signal?: AbortSignal }
export type CatalogPage = { items: Instrument[]; nextCursor: string | null }
type CatalogCache = Map<string, { expires: number; value: unknown }>
const sharedCatalogCaches = new Map<string, CatalogCache>()
function catalogCacheFor(scope?: string): CatalogCache {
  if (!scope) return new Map()
  const existing = sharedCatalogCaches.get(scope)
  if (existing) { sharedCatalogCaches.delete(scope); sharedCatalogCaches.set(scope, existing); return existing }
  if (sharedCatalogCaches.size >= 32) sharedCatalogCaches.delete(sharedCatalogCaches.keys().next().value!)
  const cache = new Map<string, { expires: number; value: unknown }>()
  sharedCatalogCaches.set(scope, cache)
  return cache
}
export function catalogAccess(fetcher: typeof fetch, cacheScope?: string) {
  const catalogCache = catalogCacheFor(cacheScope)
  async function json(path: string, signal?: AbortSignal): Promise<unknown> {
    const cacheable = path === '/capabilities' || path.includes('/catalog?')
    const cached = cacheable ? catalogCache.get(path) : undefined
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (cached && cached.expires > Date.now()) return structuredClone(cached.value)
    const response = await fetcher(`/api/market/providers${path}`, { credentials: 'same-origin', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error('Provider catalog unavailable. Retry later.')
    const value: unknown = await response.json()
    return value
  }
  async function localHistory(request: Parameters<MarketDataProvider['getHistoricalCandles']>[0], symbol: string): Promise<unknown> {
    const step = timeframeMilliseconds(request.interval), to = request.before ?? Date.now(), from = to - Math.min(1000, Math.max(1, request.limit)) * step
    const query = new URLSearchParams({ symbol, timeframe: request.interval, from: new Date(from).toISOString(), to: new Date(to).toISOString(), limit: String(Math.min(1000, Math.max(1, request.limit))) })
    const response = await fetcher(`/api/market/local/history?${query}`, { credentials: 'same-origin', signal: request.signal ? AbortSignal.any([request.signal, AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000) })
    if (!response.ok) throw new Error('Local market history unavailable. Retry later.')
    return response.json()
  }
  function remember(path: string, value: unknown, signal?: AbortSignal) {
    if (signal?.aborted) return
    if (catalogCache.size >= 400) catalogCache.delete(catalogCache.keys().next().value!)
    catalogCache.set(path, { value: structuredClone(value), expires: Date.now() + 300_000 })
  }
  return {
    catalogProviders: async (signal?: AbortSignal): Promise<CatalogProvider[]> => {
      const raw = await json('/capabilities', signal) as { items: Array<CatalogProvider & { displayAllowed: boolean; licenseStatus: string }> }
      if (!Array.isArray(raw.items)) throw new Error('Invalid provider capabilities')
      remember('/capabilities', raw, signal)
      return raw.items.filter(p => ['COINBASE', 'BINANCE', 'FRANKFURTER', 'ALPACA', 'DUKASCOPY', 'OANDA', 'CTRADER'].includes(p.providerId) && p.displayAllowed && ['ACCEPTED', 'CONDITIONAL'].includes(p.licenseStatus))
    },
    searchPage: async (request: CatalogRequest): Promise<CatalogPage> => {
      if (!['COINBASE', 'BINANCE', 'FRANKFURTER', 'ALPACA', 'DUKASCOPY', 'OANDA', 'CTRADER'].includes(request.provider) || request.query.length > 64) throw new Error('Invalid catalog query')
      const query = new URLSearchParams({ query: request.query, assetClass: request.assetClass ?? '' })
      if (request.cursor) query.set('cursor', request.cursor)
      const path = `/${request.provider}/catalog?${query}`
      const raw = await json(path, request.signal) as { items: Record<string, unknown>[]; nextCursor: string | null }
      if (!Array.isArray(raw.items) || raw.items.length > 50 || raw.nextCursor !== null && (typeof raw.nextCursor !== 'string' || raw.nextCursor.length > 160)) throw new Error('Invalid catalog page')
      const items = raw.items.map((i): Instrument => {
        if (i.provider !== request.provider || typeof i.providerSymbol !== 'string' || !/^[A-Z0-9][A-Z0-9._-]{0,31}$/.test(i.providerSymbol) || i.instrumentId !== `${request.provider}:${i.providerSymbol}` || typeof i.displaySymbol !== 'string' || i.displaySymbol.length > 80 || typeof i.exchange !== 'string' || i.exchange.length > 80) throw new Error('Invalid catalog instrument')
        const assetClass = i.assetClass === 'FX_REFERENCE' ? 'FOREX' : i.assetClass === 'US_EQUITY' ? 'STOCK' : i.assetClass
        if (!['CRYPTO', 'FOREX', 'STOCK', 'ETF', 'COMMODITY'].includes(String(assetClass)) || !Array.isArray(i.supportedModes) || !i.supportedModes.every(mode => typeof mode === 'string')) throw new Error('Unsupported catalog instrument')
        const increment = typeof i.priceIncrement === 'number' && i.priceIncrement > 0 ? i.priceIncrement : .01
        const modes = i.supportedModes.filter((mode): mode is Instrument['modes'][number] => ['HISTORICAL', 'REALTIME', 'DELAYED', 'SNAPSHOT'].includes(String(mode)))
        return { instrumentId: String(i.instrumentId), symbol: request.provider === 'BINANCE' ? `BINANCE:${i.providerSymbol}` : i.providerSymbol, providerSymbol: i.providerSymbol, displaySymbol: i.displaySymbol, name: typeof i.name === 'string' && i.name.length <= 160 ? i.name : i.displaySymbol, assetClass: assetClass as Instrument['assetClass'], provider: request.provider, exchange: i.exchange, exchangeTimezone: validExchangeTimezone(i.timezone), base: typeof i.base === 'string' ? i.base : undefined, quote: typeof i.quote === 'string' ? i.quote : undefined, feed: request.provider === 'ALPACA' ? 'IEX' : request.provider === 'FRANKFURTER' ? assetClass === 'COMMODITY' ? 'DAILY · REFERENCE' : 'ECB · EOD' : request.provider === 'BINANCE' ? 'PUBLIC · HISTORICAL' : 'PUBLIC', priceIncrement: increment, pricePrecision: precisionFromIncrement(increment), modes }
      })
      if (new Set(items.map(i => i.instrumentId)).size !== items.length) throw new Error('Duplicate catalog identity')
      remember(path, raw, request.signal)
      return { items, nextCursor: raw.nextCursor }
    },
    searchCatalogPage: async (request: UnifiedCatalogRequest): Promise<CatalogPage> => {
      if (request.query.length > 64) throw new Error('Invalid catalog query')
      const query = new URLSearchParams({ query: request.query, assetClass: request.assetClass ?? '', exchange: request.exchange ?? '', country: request.country ?? '', active: String(request.active ?? true) })
      if (request.cursor) query.set('cursor', request.cursor)
      const path = `/catalog?${query}`
      const raw = await json(path, request.signal) as { items: Record<string, unknown>[]; nextCursor: string | null }
      if (!Array.isArray(raw.items) || raw.items.length > 50 || raw.nextCursor !== null && (typeof raw.nextCursor !== 'string' || raw.nextCursor.length > 80)) throw new Error('Invalid catalog page')
      const items = raw.items.map((item): Instrument => {
        const assetClass = item.assetClass
        const provider = item.provider
        const providerSymbol = item.providerSymbol
        if (typeof item.instrumentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(item.instrumentId) || !['CRYPTO', 'FOREX', 'STOCK', 'ETF', 'COMMODITY', 'FUTURES'].includes(String(assetClass)) || typeof provider !== 'string' || !/^[A-Z][A-Z0-9_]{1,31}$/.test(provider) || typeof providerSymbol !== 'string' || providerSymbol.length > 64 || typeof item.displaySymbol !== 'string' || item.displaySymbol.length > 80 || typeof item.exchange !== 'string' || item.exchange.length > 80 || !Array.isArray(item.supportedModes) || !Array.isArray(item.supportedTimeframes)) throw new Error('Invalid unified catalog instrument')
        const modes = item.supportedModes.filter((mode): mode is Instrument['modes'][number] => ['HISTORICAL', 'REALTIME', 'DELAYED', 'SNAPSHOT'].includes(String(mode)))
        const increment = typeof item.priceIncrement === 'number' && item.priceIncrement > 0 ? item.priceIncrement : .01
        const symbol = provider === 'BINANCE' ? `BINANCE:${providerSymbol}` : providerSymbol
        return { instrumentId: item.instrumentId, symbol, providerSymbol, displaySymbol: item.displaySymbol, name: typeof item.name === 'string' && item.name.length <= 200 ? item.name : item.displaySymbol, assetClass: assetClass as Instrument['assetClass'], provider, exchange: item.exchange, exchangeTimezone: validExchangeTimezone(item.timezone), base: typeof item.base === 'string' ? item.base : undefined, quote: typeof item.quote === 'string' ? item.quote : undefined, feed: provider === 'ALPACA' ? 'IEX' : provider === 'FRANKFURTER' ? assetClass === 'COMMODITY' ? 'DAILY · REFERENCE' : 'ECB · EOD' : modes.length ? 'PUBLIC' : 'REFERENCE', priceIncrement: increment, pricePrecision: precisionFromIncrement(increment), modes }
      })
      if (new Set(items.map(item => item.instrumentId)).size !== items.length) throw new Error('Duplicate catalog identity')
      remember(path, raw, request.signal)
      return { items, nextCursor: raw.nextCursor }
    },
    binanceHistory: async (request: Parameters<MarketDataProvider['getHistoricalCandles']>[0]) => {
      const step = timeframeMilliseconds(request.interval)
      const raw = await localHistory(request, request.symbol)
      if (!Array.isArray(raw) || raw.length > 20000) throw new Error('Invalid history')
      return raw.map(c => validMarketCandle({ openTime: Date.parse(c.time), closeTime: Date.parse(c.time) + step - 1, open: String(c.open), high: String(c.high), low: String(c.low), close: String(c.close), volume: String(c.volume), closed: true }, request.symbol, request.interval)).filter(c => c !== null)
    },
    providerHistory: async (provider: string, request: Parameters<MarketDataProvider['getHistoricalCandles']>[0]) => {
      if (!['ALPACA', 'OANDA', 'CTRADER', 'DUKASCOPY'].includes(provider)) throw new Error('Unsupported history provider')
      const step = timeframeMilliseconds(request.interval), to = request.before ?? Date.now(), from = to - Math.min(1000, Math.max(1, request.limit)) * step
      const raw = provider === 'DUKASCOPY' ? await localHistory(request, request.symbol) : await json(`/${provider}/history?${new URLSearchParams({ symbol: request.symbol, timeframe: request.interval, from: new Date(from).toISOString(), to: new Date(to).toISOString() })}`, request.signal)
      if (!Array.isArray(raw) || raw.length > 20000) throw new Error('Invalid history')
      return raw.map(c => validMarketCandle({ openTime: Date.parse(c.time), closeTime: Date.parse(c.time) + step - 1, open: String(c.open), high: String(c.high), low: String(c.low), close: String(c.close), volume: String(c.volume), closed: true }, request.symbol, request.interval)).filter(c => c !== null)
    },
  }
}
