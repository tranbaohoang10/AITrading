import { workspaceHeaders } from '../auth/api'
import { AlpacaMarketDataProvider, alpacaMarketData } from './AlpacaMarketDataProvider'
import { coinbaseMarketData, coinbaseMarketDataFor } from './CoinbaseMarketDataProvider'
import { FrankfurterMarketDataProvider, frankfurterMarketData } from './FrankfurterMarketDataProvider'
import { DEFAULT_INSTRUMENTS, FRANKFURTER_DEFAULT_SYMBOLS, type Instrument, type LiveSymbol, type MarketDataProvider } from './liveMarket'

const isForex = (symbol: LiveSymbol) => (FRANKFURTER_DEFAULT_SYMBOLS as readonly string[]).includes(symbol)
const isCrypto = (symbol: LiveSymbol) => !isForex(symbol) && symbol.includes('-')
export function createMarketDataProvider(accountId?: string): MarketDataProvider {
  const coinbase = accountId ? coinbaseMarketDataFor(accountId) : coinbaseMarketData
  const ownerFetch: typeof fetch = (input, options = {}) => {
    const headers = new Headers(options.headers)
    workspaceHeaders(accountId).forEach((value, name) => headers.set(name, value))
    return globalThis.fetch(input, { ...options, headers })
  }
  const forex = accountId ? new FrankfurterMarketDataProvider(ownerFetch) : frankfurterMarketData
  const stocks = accountId ? new AlpacaMarketDataProvider(ownerFetch) : alpacaMarketData
  const provider: MarketDataProvider = {
    capabilities: { provider: 'MULTI', assetClasses: ['CRYPTO', 'STOCK', 'ETF', 'FOREX'], modes: ['HISTORICAL', 'REALTIME', 'DELAYED'], configured: true, status: 'ACCEPTED' },
    getHistoricalCandles: request => (isForex(request.symbol) ? forex : isCrypto(request.symbol) ? coinbase : stocks).getHistoricalCandles(request),
    listInstruments: async signal => { const crypto = await coinbase.listInstruments?.(signal).catch(() => []) ?? coinbaseSymbols; const equities = await stocks.listInstruments(signal).catch(() => []); return [...crypto, ...forexSymbols, ...equities] },
    searchInstruments: async (query, signal) => { const normalized = query.trim().toLowerCase(); const local = (await coinbase.listInstruments?.(signal).catch(() => []) ?? coinbaseSymbols).filter(item => `${item.symbol} ${item.name} ${item.base ?? ''} ${item.quote ?? ''}`.toLowerCase().includes(normalized)); const references = forexSymbols.filter(item => `${item.symbol} ${item.name} ${item.base ?? ''} ${item.quote ?? ''} ${item.exchange ?? ''}`.toLowerCase().includes(normalized)); const equities = await stocks.searchInstruments(query, signal).catch(() => []); return [...local, ...references, ...equities] },
    listProducts: async signal => (await (provider.listInstruments?.(signal) ?? Promise.resolve(coinbaseSymbols))).map(item => item.symbol),
    subscribeCandles: (request, subscription) => (isForex(request.symbol) ? forex : isCrypto(request.symbol) ? coinbase : stocks).subscribeCandles(request, subscription),
  }
  return provider
}
export const marketDataProvider = createMarketDataProvider()
const coinbaseSymbols: Instrument[] = DEFAULT_INSTRUMENTS.filter(item => item.assetClass === 'CRYPTO')
const forexSymbols: Instrument[] = DEFAULT_INSTRUMENTS.filter(item => item.assetClass === 'FOREX')
