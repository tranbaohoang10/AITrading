import { catalogAccess } from './providerCatalog'
import { workspaceHeaders } from '../auth/api'
import { AlpacaMarketDataProvider, alpacaMarketData } from './AlpacaMarketDataProvider'
import { coinbaseMarketData, coinbaseMarketDataFor } from './CoinbaseMarketDataProvider'
import { FrankfurterMarketDataProvider, frankfurterMarketData } from './FrankfurterMarketDataProvider'
import { backendProviderStream } from './backendCoinbaseStream'
import { DEFAULT_INSTRUMENTS, FRANKFURTER_DEFAULT_SYMBOLS, type Instrument, type LiveSymbol, type MarketDataProvider } from './liveMarket'

const isForex = (symbol: LiveSymbol) => (FRANKFURTER_DEFAULT_SYMBOLS as readonly string[]).includes(symbol)
const isCrypto = (symbol: LiveSymbol) => !isForex(symbol) && symbol.includes('-')
const liveRouteProviders = ['CTRADER', 'CAPITAL'] as const
const canonicalRouteSymbol = (item: Instrument): LiveSymbol => {
  if (liveRouteProviders.includes(item.provider as typeof liveRouteProviders[number]) && item.base && item.quote) return `${item.base}-${item.quote}`
  return item.symbol
}
export function createMarketDataProvider(accountId?: string, onUnauthorized?: () => void): MarketDataProvider {
  const coinbase = accountId ? coinbaseMarketDataFor(accountId) : coinbaseMarketData
  const ownerFetch: typeof fetch = async (input, options = {}) => {
    const headers = new Headers(options.headers)
    workspaceHeaders(accountId).forEach((value, name) => headers.set(name, value))
    const response = await globalThis.fetch(input, { ...options, headers })
    if (response.status === 401) onUnauthorized?.()
    return response
  }
  const forex = accountId ? new FrankfurterMarketDataProvider(ownerFetch) : frankfurterMarketData
  const stocks = accountId ? new AlpacaMarketDataProvider(ownerFetch, accountId) : alpacaMarketData
  const identities = new Map<string, Instrument>()
  const catalog = catalogAccess(ownerFetch, accountId ? `account:${accountId}` : 'public')
  const remember = (item: Instrument): Instrument => {
    const symbol = canonicalRouteSymbol(item), normalized = symbol === item.symbol ? item : { ...item, symbol }
    identities.set(symbol, normalized)
    if (normalized.provider === 'FRANKFURTER') forex.registerCatalogSymbol(symbol)
    return normalized
  }
  const rememberPage = (page: Awaited<ReturnType<NonNullable<MarketDataProvider['searchPage']>>>): Awaited<ReturnType<NonNullable<MarketDataProvider['searchPage']>>> => ({ ...page, items: page.items.map(remember) })
  const liveCatalog = async (assetClass: 'FOREX' | 'COMMODITY', query = '', signal?: AbortSignal): Promise<Instrument[]> => {
    if (!accountId) return []
    const pages = await Promise.all(liveRouteProviders.map(async provider => {
      try { return rememberPage(await catalog.searchPage({ provider, query, assetClass, signal })) .items } catch { return [] }
    }))
    const seen = new Set<string>()
    return pages.flat().filter(item => !seen.has(item.symbol) && seen.add(item.symbol))
  }
  const forexSymbol = (symbol: string) => identities.get(symbol)?.provider === 'FRANKFURTER' || isForex(symbol)
  const provider: MarketDataProvider = {
    searchPage: async request => {
      if (!['COINBASE', 'ALPACA', 'CTRADER', 'CAPITAL'].includes(request.provider)) throw new Error('Provider is no longer enabled. Select a Coinbase crypto pair.')
      return rememberPage(await catalog.searchPage(request))
    },
    catalogProviders: async () => (await catalog.catalogProviders()).filter(item => ['COINBASE', 'ALPACA', 'CTRADER', 'CAPITAL'].includes(item.providerId)),
    searchCatalogPage: async request => {
      const page = await catalog.searchCatalogPage(request)
      return { ...page, items: page.items.filter(item => ['COINBASE', 'ALPACA', 'CTRADER', 'CAPITAL'].includes(item.provider)).map(item => item.modes.length ? remember(item) : item) }
    },
    capabilities: { provider: 'MULTI', assetClasses: ['CRYPTO', 'STOCK', 'ETF', 'FOREX', 'COMMODITY'], modes: ['HISTORICAL', 'REALTIME', 'DELAYED'], configured: true, status: 'ACCEPTED' },
    getHistoricalCandles: request => {
      const route = identities.get(request.symbol)
      if (request.symbol.startsWith('BINANCE:')) return Promise.reject(new Error('Binance is no longer enabled. Select a crypto pair from Coinbase.'))
      if (route && ['ALPACA', 'CAPITAL', 'CTRADER'].includes(route.provider)) return catalog.providerHistory(route.provider, { ...request, symbol: route.providerSymbol ?? request.symbol }).then(items => items.map(candle => ({ ...candle, symbol: request.symbol })))
      return (forexSymbol(request.symbol) ? forex : isCrypto(request.symbol) ? coinbase : stocks).getHistoricalCandles(request)
    },
    listInstruments: async signal => {
      const crypto = await coinbase.listInstruments?.(signal).catch(() => []) ?? coinbaseSymbols
      const live = [...await liveCatalog('FOREX', '', signal), ...await liveCatalog('COMMODITY', '', signal)]
      const liveSymbols = new Set(live.map(item => item.symbol))
      const references = forexSymbols.filter(item => !liveSymbols.has(item.symbol))
      const equities = await stocks.listInstruments(signal).catch(() => [])
      return [...crypto, ...live, ...references, ...equities]
    },
    searchInstruments: async (query, signal) => {
      const normalized = query.trim().toLowerCase()
      const local = (await coinbase.listInstruments?.(signal).catch(() => []) ?? coinbaseSymbols).filter(item => `${item.symbol} ${item.name} ${item.base ?? ''} ${item.quote ?? ''}`.toLowerCase().includes(normalized))
      const live = [...await liveCatalog('FOREX', query, signal), ...await liveCatalog('COMMODITY', query, signal)]
      const liveSymbols = new Set(live.map(item => item.symbol))
      const references = forexSymbols.filter(item => !liveSymbols.has(item.symbol) && `${item.symbol} ${item.name} ${item.base ?? ''} ${item.quote ?? ''} ${item.exchange ?? ''}`.toLowerCase().includes(normalized))
      const equities = await stocks.searchInstruments(query, signal).catch(() => [])
      return [...local, ...live, ...references, ...equities]
    },
    listProducts: async signal => (await (provider.listInstruments?.(signal) ?? Promise.resolve(coinbaseSymbols))).map(item => item.symbol),
    subscribeCandles: (request, subscription) => {
      if (request.symbol.startsWith('BINANCE:')) { subscription.onStatus('DISCONNECTED'); return () => {} }
      const route = identities.get(request.symbol)
      if (accountId && route && ['ALPACA', 'CAPITAL', 'CTRADER'].includes(route.provider)) {
        return backendProviderStream(accountId, route.provider, route.providerSymbol ?? request.symbol, request.interval, subscription, ownerFetch, request.symbol)
      }
      return (forexSymbol(request.symbol) ? forex : isCrypto(request.symbol) ? coinbase : stocks).subscribeCandles(request, subscription)
    },
  }
  return provider
}
export const marketDataProvider = createMarketDataProvider()
const coinbaseSymbols: Instrument[] = DEFAULT_INSTRUMENTS.filter(item => item.assetClass === 'CRYPTO')
const forexSymbols: Instrument[] = DEFAULT_INSTRUMENTS.filter(item => item.assetClass === 'FOREX')
