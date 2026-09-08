import { precisionFromIncrement, validMarketCandle, type Instrument, type MarketDataProvider } from './liveMarket'
import { timeframeMilliseconds } from './chartMath'

export type CatalogProvider = { providerId: string; displayName: string; assetClasses: string[] }
export type CatalogRequest = { provider: string; query: string; assetClass?: string; cursor?: string; signal?: AbortSignal }
export type CatalogPage = { items: Instrument[]; nextCursor: string | null }
export function catalogAccess(fetcher: typeof fetch) {
  async function json(path: string, signal?: AbortSignal): Promise<unknown> {
    const response = await fetcher(`/api/market/providers${path}`, { credentials: 'same-origin', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error('Provider catalog unavailable. Retry later.')
    return response.json()
  }
  return {
    catalogProviders: async (signal?: AbortSignal): Promise<CatalogProvider[]> => {
      const raw = await json('/capabilities', signal) as { items: Array<CatalogProvider & { configured: boolean; displayAllowed: boolean; licenseStatus: string }> }
      if (!Array.isArray(raw.items)) throw new Error('Invalid provider capabilities')
      return raw.items.filter(p => ['COINBASE', 'BINANCE', 'FRANKFURTER', 'ALPACA'].includes(p.providerId) && p.configured && p.displayAllowed && ['ACCEPTED', 'CONDITIONAL'].includes(p.licenseStatus))
    },
    searchPage: async (request: CatalogRequest): Promise<CatalogPage> => {
      if (!['COINBASE', 'BINANCE', 'FRANKFURTER', 'ALPACA'].includes(request.provider) || request.query.length > 64) throw new Error('Invalid catalog query')
      const query = new URLSearchParams({ query: request.query, assetClass: request.assetClass ?? '' })
      if (request.cursor) query.set('cursor', request.cursor)
      const raw = await json(`/${request.provider}/catalog?${query}`, request.signal) as { items: Record<string, unknown>[]; nextCursor: string | null }
      if (!Array.isArray(raw.items) || raw.items.length > 50 || raw.nextCursor !== null && (typeof raw.nextCursor !== 'string' || raw.nextCursor.length > 160)) throw new Error('Invalid catalog page')
      const items = raw.items.map((i): Instrument => {
        if (i.provider !== request.provider || typeof i.providerSymbol !== 'string' || !/^[A-Z0-9][A-Z0-9.-]{0,31}$/.test(i.providerSymbol) || i.instrumentId !== `${request.provider}:${i.providerSymbol}` || typeof i.displaySymbol !== 'string' || i.displaySymbol.length > 80 || typeof i.exchange !== 'string' || i.exchange.length > 80) throw new Error('Invalid catalog instrument')
        const assetClass = i.assetClass === 'FX_REFERENCE' ? 'FOREX' : i.assetClass === 'US_EQUITY' ? 'STOCK' : i.assetClass
        if (!['CRYPTO', 'FOREX', 'STOCK', 'ETF'].includes(String(assetClass))) throw new Error('Unsupported catalog asset class')
        const increment = typeof i.priceIncrement === 'number' && i.priceIncrement > 0 ? i.priceIncrement : request.provider === 'FRANKFURTER' ? .000001 : .01
        return { instrumentId: String(i.instrumentId), symbol: request.provider === 'BINANCE' ? `BINANCE:${i.providerSymbol}` : i.providerSymbol, providerSymbol: i.providerSymbol, displaySymbol: i.displaySymbol, name: typeof i.name === 'string' && i.name.length <= 160 ? i.name : i.displaySymbol, assetClass: assetClass as Instrument['assetClass'], provider: request.provider, exchange: i.exchange, base: typeof i.base === 'string' ? i.base : undefined, quote: typeof i.quote === 'string' ? i.quote : undefined, feed: request.provider === 'ALPACA' ? 'IEX' : request.provider === 'FRANKFURTER' ? 'ECB · EOD' : request.provider === 'BINANCE' ? 'PUBLIC · HISTORICAL' : 'PUBLIC', priceIncrement: increment, pricePrecision: precisionFromIncrement(increment), modes: request.provider === 'BINANCE' ? ['HISTORICAL'] : ['HISTORICAL', 'DELAYED'] }
      })
      if (new Set(items.map(i => i.instrumentId)).size !== items.length) throw new Error('Duplicate catalog identity')
      return { items, nextCursor: raw.nextCursor }
    },
    binanceHistory: async (request: Parameters<MarketDataProvider['getHistoricalCandles']>[0]) => {
      const symbol = request.symbol.replace(/^BINANCE:/, ''), step = timeframeMilliseconds(request.interval)
      const to = Math.floor((request.before ?? Date.now()) / 86400000) * 86400000 - (request.before ? 0 : 86400000)
      const from = to - Math.min(300, request.limit, Math.floor(7 * 86400000 / step)) * step
      const raw = await json(`/BINANCE/history?${new URLSearchParams({ symbol, timeframe: request.interval, from: new Date(from).toISOString(), to: new Date(to).toISOString() })}`, request.signal)
      if (!Array.isArray(raw) || raw.length > 20000) throw new Error('Invalid history')
      return raw.map(c => validMarketCandle({ openTime: Date.parse(c.time), closeTime: Date.parse(c.time) + step - 1, open: String(c.open), high: String(c.high), low: String(c.low), close: String(c.close), volume: String(c.volume), closed: true }, request.symbol, request.interval)).filter(c => c !== null)
    },
  }
}
