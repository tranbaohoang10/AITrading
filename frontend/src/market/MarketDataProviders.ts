import { alpacaMarketData } from './AlpacaMarketDataProvider'
import { coinbaseMarketData } from './CoinbaseMarketDataProvider'
import type { Instrument, LiveSymbol, MarketDataProvider } from './liveMarket'

const isCrypto = (symbol: LiveSymbol) => symbol.includes('-')
export const marketDataProvider: MarketDataProvider = {
  capabilities: { provider: 'MULTI', assetClasses: ['CRYPTO', 'STOCK', 'ETF'], modes: ['HISTORICAL', 'REALTIME', 'DELAYED'], configured: false, status: 'ACCEPTED' },
  getHistoricalCandles: request => (isCrypto(request.symbol) ? coinbaseMarketData : alpacaMarketData).getHistoricalCandles(request),
  listInstruments: async signal => { const stocks = await alpacaMarketData.listInstruments(signal).catch(() => []); return [...coinbaseSymbols, ...stocks] },
  searchInstruments: async (query, signal) => { const local = coinbaseSymbols.filter(item => `${item.symbol} ${item.name}`.toLowerCase().includes(query.trim().toLowerCase())); const stocks = await alpacaMarketData.searchInstruments(query, signal).catch(() => []); return [...local, ...stocks] },
  listProducts: async signal => (await (marketDataProvider.listInstruments?.(signal) ?? Promise.resolve(coinbaseSymbols))).map(item => item.symbol),
  subscribeCandles: (request, subscription) => (isCrypto(request.symbol) ? coinbaseMarketData : alpacaMarketData).subscribeCandles(request, subscription),
}
const coinbaseSymbols: Instrument[] = [
  { symbol: 'BTC-USD', name: 'Bitcoin / US Dollar', assetClass: 'CRYPTO', base: 'BTC', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: .01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'ETH-USD', name: 'Ethereum / US Dollar', assetClass: 'CRYPTO', base: 'ETH', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: .01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] },
]
