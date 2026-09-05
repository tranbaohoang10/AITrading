import type { Timeframe } from './chartMath'
import { DEFAULT_INSTRUMENTS, FRANKFURTER_DEFAULT_SYMBOLS, validMarketCandle, type CandleSubscription, type Instrument, type LiveSymbol, type MarketCandle, type MarketDataProvider, type ProviderCapabilities } from './liveMarket'

const ROOT = '/api/market/frankfurter'
const POLL_INTERVAL_MS = 15 * 60_000
const allowedSymbols = new Set<string>(FRANKFURTER_DEFAULT_SYMBOLS)

export class FrankfurterMarketDataProvider implements MarketDataProvider {
  readonly capabilities: ProviderCapabilities = { provider: 'FRANKFURTER', assetClasses: ['FOREX'], modes: ['HISTORICAL', 'DELAYED'], feed: 'ECB · EOD', configured: true, status: 'ACCEPTED' }
  constructor(private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  async getHistoricalCandles(request: { symbol: LiveSymbol; interval: Timeframe; limit: number; before?: number; signal?: AbortSignal }): Promise<MarketCandle[]> {
    if (!allowedSymbols.has(request.symbol) || request.interval !== '1d') throw new Error('Forex reference data is available in 1D only.')
    const query = new URLSearchParams({ symbol: request.symbol, limit: String(Math.min(600, Math.max(1, Math.floor(request.limit))) ) })
    if (request.before !== undefined) query.set('before', String(Math.floor(request.before)))
    const response = await this.fetcher(`${ROOT}/candles?${query}`, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal: request.signal })
    const body: unknown = await response.json()
    if (!response.ok) {
      const code = typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string' ? body.code : 'FRANKFURTER_PROVIDER_UNAVAILABLE'
      throw new Error(code)
    }
    if (!Array.isArray(body)) throw new Error('FRANKFURTER_INVALID_RESPONSE')
    return body.map(value => this.mapCandle(value, request.symbol, request.interval)).filter((value): value is MarketCandle => value !== null)
  }

  async listInstruments(): Promise<Instrument[]> { return DEFAULT_INSTRUMENTS.filter(item => item.provider === 'FRANKFURTER') }
  async listProducts(): Promise<LiveSymbol[]> { return [...FRANKFURTER_DEFAULT_SYMBOLS] }

  subscribeCandles(request: { symbol: LiveSymbol; interval: Timeframe }, subscription: CandleSubscription): () => void {
    let active = true
    const poll = async () => {
      try {
        const values = await this.getHistoricalCandles({ ...request, limit: 1 })
        if (active && values[0]) subscription.onCandle(values[0])
      } catch { if (active) subscription.onStatus('DISCONNECTED') }
    }
    subscription.onStatus('DELAYED')
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS)
    return () => { active = false; window.clearInterval(timer) }
  }

  private mapCandle(value: unknown, symbol: LiveSymbol, interval: Timeframe): MarketCandle | null {
    if (typeof value !== 'object' || value === null) return null
    const item = value as Record<string, unknown>
    if (typeof item.openTime !== 'number' || typeof item.closeTime !== 'number' || !Number.isSafeInteger(item.openTime) || !Number.isSafeInteger(item.closeTime)) return null
    return validMarketCandle({ openTime: item.openTime, closeTime: item.closeTime, open: String(item.open), high: String(item.high), low: String(item.low), close: String(item.close), volume: String(item.volume), closed: item.closed === true }, symbol, interval)
  }
}

export const frankfurterMarketData = new FrankfurterMarketDataProvider()
