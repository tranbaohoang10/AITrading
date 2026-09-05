import { alpacaMarketData } from './AlpacaMarketDataProvider'
import { coinbaseMarketData } from './CoinbaseMarketDataProvider'
import { DEFAULT_INSTRUMENTS, type Instrument, type LiveSymbol, type MarketDataProvider } from './liveMarket'

const isCrypto = (symbol: LiveSymbol) => symbol.includes('-')
export const marketDataProvider: MarketDataProvider = {
  capabilities: { provider: 'MULTI', assetClasses: ['CRYPTO', 'STOCK', 'ETF'], modes: ['HISTORICAL', 'REALTIME', 'DELAYED'], configured: false, status: 'ACCEPTED' },
  getHistoricalCandles: request => (isCrypto(request.symbol) ? coinbaseMarketData : alpacaMarketData).getHistoricalCandles(request),
  listInstruments: async signal => { const crypto = await coinbaseMarketData.listInstruments?.(signal).catch(() => []) ?? coinbaseSymbols; const stocks = await alpacaMarketData.listInstruments(signal).catch(() => []); return [...crypto, ...stocks] },
  searchInstruments: async (query, signal) => { const local = (await coinbaseMarketData.listInstruments?.(signal).catch(() => []) ?? coinbaseSymbols).filter(item => `${item.symbol} ${item.name} ${item.base ?? ''} ${item.quote ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())); const stocks = await alpacaMarketData.searchInstruments(query, signal).catch(() => []); return [...local, ...stocks] },
  listProducts: async signal => (await (marketDataProvider.listInstruments?.(signal) ?? Promise.resolve(coinbaseSymbols))).map(item => item.symbol),
  subscribeCandles: (request, subscription) => (isCrypto(request.symbol) ? coinbaseMarketData : alpacaMarketData).subscribeCandles(request, subscription),
}
const coinbaseSymbols: Instrument[] = DEFAULT_INSTRUMENTS.filter(item => item.assetClass === 'CRYPTO')
