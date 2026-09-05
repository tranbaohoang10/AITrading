import { alpacaMarketData } from './AlpacaMarketDataProvider'
import { coinbaseMarketData, coinbaseMarketDataFor } from './CoinbaseMarketDataProvider'
import { frankfurterMarketData } from './FrankfurterMarketDataProvider'
import { DEFAULT_INSTRUMENTS, FRANKFURTER_DEFAULT_SYMBOLS, type Instrument, type LiveSymbol, type MarketDataProvider } from './liveMarket'

const isForex = (symbol: LiveSymbol) => (FRANKFURTER_DEFAULT_SYMBOLS as readonly string[]).includes(symbol)
const isCrypto = (symbol: LiveSymbol) => !isForex(symbol) && symbol.includes('-')
export function createMarketDataProvider(accountId?: string): MarketDataProvider {
  const coinbase = accountId ? coinbaseMarketDataFor(accountId) : coinbaseMarketData
  const provider: MarketDataProvider = {
    capabilities: { provider: 'MULTI', assetClasses: ['CRYPTO', 'STOCK', 'ETF', 'FOREX'], modes: ['HISTORICAL', 'REALTIME', 'DELAYED'], configured: true, status: 'ACCEPTED' },
    getHistoricalCandles: request => (isForex(request.symbol) ? frankfurterMarketData : isCrypto(request.symbol) ? coinbase : alpacaMarketData).getHistoricalCandles(request),
    listInstruments: async signal => { const crypto = await coinbase.listInstruments?.(signal).catch(() => []) ?? coinbaseSymbols; const stocks = await alpacaMarketData.listInstruments(signal).catch(() => []); return [...crypto, ...forexSymbols, ...stocks] },
    searchInstruments: async (query, signal) => { const normalized = query.trim().toLowerCase(); const local = (await coinbase.listInstruments?.(signal).catch(() => []) ?? coinbaseSymbols).filter(item => `${item.symbol} ${item.name} ${item.base ?? ''} ${item.quote ?? ''}`.toLowerCase().includes(normalized)); const forex = forexSymbols.filter(item => `${item.symbol} ${item.name} ${item.base ?? ''} ${item.quote ?? ''} ${item.exchange ?? ''}`.toLowerCase().includes(normalized)); const stocks = await alpacaMarketData.searchInstruments(query, signal).catch(() => []); return [...local, ...forex, ...stocks] },
    listProducts: async signal => (await (provider.listInstruments?.(signal) ?? Promise.resolve(coinbaseSymbols))).map(item => item.symbol),
    subscribeCandles: (request, subscription) => (isForex(request.symbol) ? frankfurterMarketData : isCrypto(request.symbol) ? coinbase : alpacaMarketData).subscribeCandles(request, subscription),
  }
  return provider
}
export const marketDataProvider = createMarketDataProvider()
const coinbaseSymbols: Instrument[] = DEFAULT_INSTRUMENTS.filter(item => item.assetClass === 'CRYPTO')
const forexSymbols: Instrument[] = DEFAULT_INSTRUMENTS.filter(item => item.assetClass === 'FOREX')
