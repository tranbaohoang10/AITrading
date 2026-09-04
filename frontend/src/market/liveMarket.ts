import { TIMEFRAMES, type Timeframe } from './chartMath'

export const COINBASE_DEFAULT_SYMBOLS = ['BTC-USD', 'ETH-USD'] as const
export type LiveSymbol = string
export type LiveConnectionStatus = 'CONNECTING' | 'LIVE' | 'DELAYED' | 'RECONNECTING' | 'DISCONNECTED'
export type AssetClass = 'CRYPTO' | 'STOCK' | 'ETF' | 'FOREX' | 'FUTURES'
export type MarketDataMode = 'HISTORICAL' | 'REALTIME' | 'DELAYED' | 'SNAPSHOT'

export type Instrument = {
  symbol: LiveSymbol
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
  { symbol: 'BTC-USD', name: 'Bitcoin / US Dollar', assetClass: 'CRYPTO', base: 'BTC', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] },
  { symbol: 'ETH-USD', name: 'Ethereum / US Dollar', assetClass: 'CRYPTO', base: 'ETH', quote: 'USD', exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: 0.01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] },
]

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
