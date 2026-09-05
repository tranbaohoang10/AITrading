import { TIMEFRAMES, type Timeframe } from './chartMath'

export const COINBASE_DEFAULT_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'ADA-USD', 'DOGE-USD', 'LTC-USD', 'BCH-USD', 'LINK-USD', 'AVAX-USD', 'POL-USD'] as const
export const FRANKFURTER_DEFAULT_SYMBOLS = ['EUR-USD', 'GBP-USD', 'USD-JPY', 'USD-CHF', 'AUD-USD', 'USD-CAD', 'NZD-USD'] as const
export type LiveSymbol = string
export type LiveConnectionStatus = 'CONNECTING' | 'LIVE' | 'DELAYED' | 'RECONNECTING' | 'DISCONNECTED'
export type AssetClass = 'CRYPTO' | 'STOCK' | 'ETF' | 'FOREX' | 'FUTURES'
export type MarketDataMode = 'HISTORICAL' | 'REALTIME' | 'DELAYED' | 'SNAPSHOT'

export type Instrument = {
  symbol: LiveSymbol
  displaySymbol?: string
  name: string
  assetClass: AssetClass
  base?: string
  quote?: string
  exchange?: string
  provider: string
  feed?: string
  priceIncrement: number
  pricePrecision: number
  modes: MarketDataMode[]
}

export type MarketCandle = {
  symbol: LiveSymbol
  interval: Timeframe
  openTime: number
  closeTime: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  closed: boolean
}

export const DEFAULT_INSTRUMENTS: Instrument[] = [
  { symbol: 'BTC-USD', displaySymbol: 'BTC/USD', name: 'Bitcoin / US Dollar', assetClass: 'CRYPTO', base: 'BTC', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'ETH-USD', displaySymbol: 'ETH/USD', name: 'Ethereum / US Dollar', assetClass: 'CRYPTO', base: 'ETH', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'SOL-USD', displaySymbol: 'SOL/USD', name: 'Solana / US Dollar', assetClass: 'CRYPTO', base: 'SOL', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'XRP-USD', displaySymbol: 'XRP/USD', name: 'XRP / US Dollar', assetClass: 'CRYPTO', base: 'XRP', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.0001, pricePrecision: 4, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'ADA-USD', displaySymbol: 'ADA/USD', name: 'Cardano / US Dollar', assetClass: 'CRYPTO', base: 'ADA', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.0001, pricePrecision: 4, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'DOGE-USD', displaySymbol: 'DOGE/USD', name: 'Dogecoin / US Dollar', assetClass: 'CRYPTO', base: 'DOGE', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.0001, pricePrecision: 4, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'LTC-USD', displaySymbol: 'LTC/USD', name: 'Litecoin / US Dollar', assetClass: 'CRYPTO', base: 'LTC', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'BCH-USD', displaySymbol: 'BCH/USD', name: 'Bitcoin Cash / US Dollar', assetClass: 'CRYPTO', base: 'BCH', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'LINK-USD', displaySymbol: 'LINK/USD', name: 'Chainlink / US Dollar', assetClass: 'CRYPTO', base: 'LINK', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'AVAX-USD', displaySymbol: 'AVAX/USD', name: 'Avalanche / US Dollar', assetClass: 'CRYPTO', base: 'AVAX', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'POL-USD', displaySymbol: 'POL/USD', name: 'Polygon Ecosystem Token / US Dollar', assetClass: 'CRYPTO', base: 'POL', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.0001, pricePrecision: 4, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'EUR-USD', displaySymbol: 'EUR/USD', name: 'Euro / U.S. Dollar', assetClass: 'FOREX', base: 'EUR', quote: 'USD', exchange: 'ECB', provider: 'FRANKFURTER', feed: 'ECB · EOD', priceIncrement: 0.0001, pricePrecision: 4, modes: ['HISTORICAL', 'DELAYED'] },
  { symbol: 'GBP-USD', displaySymbol: 'GBP/USD', name: 'British Pound / U.S. Dollar', assetClass: 'FOREX', base: 'GBP', quote: 'USD', exchange: 'ECB', provider: 'FRANKFURTER', feed: 'ECB · EOD', priceIncrement: 0.0001, pricePrecision: 4, modes: ['HISTORICAL', 'DELAYED'] },
  { symbol: 'USD-JPY', displaySymbol: 'USD/JPY', name: 'U.S. Dollar / Japanese Yen', assetClass: 'FOREX', base: 'USD', quote: 'JPY', exchange: 'ECB', provider: 'FRANKFURTER', feed: 'ECB · EOD', priceIncrement: 0.001, pricePrecision: 3, modes: ['HISTORICAL', 'DELAYED'] },
  { symbol: 'USD-CHF', displaySymbol: 'USD/CHF', name: 'U.S. Dollar / Swiss Franc', assetClass: 'FOREX', base: 'USD', quote: 'CHF', exchange: 'ECB', provider: 'FRANKFURTER', feed: 'ECB · EOD', priceIncrement: 0.0001, pricePrecision: 4, modes: ['HISTORICAL', 'DELAYED'] },
  { symbol: 'AUD-USD', displaySymbol: 'AUD/USD', name: 'Australian Dollar / U.S. Dollar', assetClass: 'FOREX', base: 'AUD', quote: 'USD', exchange: 'ECB', provider: 'FRANKFURTER', feed: 'ECB · EOD', priceIncrement: 0.0001, pricePrecision: 4, modes: ['HISTORICAL', 'DELAYED'] },
  { symbol: 'USD-CAD', displaySymbol: 'USD/CAD', name: 'U.S. Dollar / Canadian Dollar', assetClass: 'FOREX', base: 'USD', quote: 'CAD', exchange: 'ECB', provider: 'FRANKFURTER', feed: 'ECB · EOD', priceIncrement: 0.0001, pricePrecision: 4, modes: ['HISTORICAL', 'DELAYED'] },
  { symbol: 'NZD-USD', displaySymbol: 'NZD/USD', name: 'New Zealand Dollar / U.S. Dollar', assetClass: 'FOREX', base: 'NZD', quote: 'USD', exchange: 'ECB', provider: 'FRANKFURTER', feed: 'ECB · EOD', priceIncrement: 0.0001, pricePrecision: 4, modes: ['HISTORICAL', 'DELAYED'] },
]

export function displayMarketSymbol(symbol: LiveSymbol): string {
  return symbol.replace(/-/g, '/')
}

export function precisionFromIncrement(increment: number): number {
  if (!Number.isFinite(increment) || increment <= 0) return 2
  const text = increment.toString().toLowerCase()
  if (text.includes('e-')) return Math.max(0, Number(text.split('e-')[1]))
  return Math.max(0, (text.split('.')[1] ?? '').replace(/0+$/, '').length)
}

export function formatMarketPrice(value: number, increment = 0.01, precision = precisionFromIncrement(increment)): string {
  if (!Number.isFinite(value)) return '—'
  const digits = Math.max(0, Math.min(12, precision))
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
}

export type CandleSubscription = {
  onCandle: (candle: MarketCandle) => void
  onStatus: (status: LiveConnectionStatus) => void
  onReconnect: () => void
}

export interface MarketDataProvider {
  getHistoricalCandles(request: { symbol: LiveSymbol; interval: Timeframe; limit: number; before?: number; signal?: AbortSignal }): Promise<MarketCandle[]>
  listProducts?: (signal?: AbortSignal) => Promise<LiveSymbol[]>
  listInstruments?: (signal?: AbortSignal) => Promise<Instrument[]>
  searchInstruments?: (query: string, signal?: AbortSignal) => Promise<Instrument[]>
  capabilities?: ProviderCapabilities
  subscribeCandles(request: { symbol: LiveSymbol; interval: Timeframe; seed?: MarketCandle }, subscription: CandleSubscription): () => void
}

export type ProviderCapabilities = {
  provider: string
  assetClasses: AssetClass[]
  modes: MarketDataMode[]
  feed?: string
  configured: boolean
  status: 'ACCEPTED' | 'REJECTED' | 'RESEARCH_ONLY'
}

const finiteDecimal = (value: unknown, allowZero = false): string | null => {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,12})(?:\.[0-9]{1,12})?$/.test(value)) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) && (allowZero ? numeric >= 0 : numeric > 0) ? value : null
}

export function validMarketCandle(value: Omit<MarketCandle, 'symbol' | 'interval'>, symbol: LiveSymbol, interval: Timeframe): MarketCandle | null {
  const open = finiteDecimal(value.open), high = finiteDecimal(value.high), low = finiteDecimal(value.low), close = finiteDecimal(value.close), volume = finiteDecimal(value.volume, true)
  if (!open || !high || !low || !close || volume === null || !Number.isSafeInteger(value.openTime) || !Number.isSafeInteger(value.closeTime) || value.openTime < 0 || value.closeTime < value.openTime) return null
  if (Number(high) < Math.max(Number(open), Number(close), Number(low)) || Number(low) > Math.min(Number(open), Number(close), Number(high))) return null
  return { symbol, interval, openTime: value.openTime, closeTime: value.closeTime, open, high, low, close, volume, closed: value.closed }
}

export function mergeCandles(current: MarketCandle[], incoming: MarketCandle): MarketCandle[] {
  const normalized = [...current.filter(candle => candle.symbol === incoming.symbol && candle.interval === incoming.interval), incoming]
    .sort((left, right) => left.openTime - right.openTime)
  const merged: MarketCandle[] = []
  for (const candle of normalized) {
    const previous = merged.at(-1)
    if (previous?.openTime === candle.openTime) merged[merged.length - 1] = candle
    else merged.push(candle)
  }
  return merged
}

export function isLiveSymbol(value: string): value is LiveSymbol { return /^[A-Z0-9]{2,20}-[A-Z0-9]{2,20}$/.test(value) }
export function isTimeframe(value: string): value is Timeframe { return (TIMEFRAMES as readonly string[]).includes(value) }
