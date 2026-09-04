import { TIMEFRAMES, type Timeframe } from './chartMath'
import { validMarketCandle, type Instrument, type LiveConnectionStatus, type LiveSymbol, type MarketCandle, type MarketDataProvider, type ProviderCapabilities } from './liveMarket'

const ROOT = '/api/market/alpaca'
const allowedSymbols = /^[A-Z][A-Z0-9.]{0,9}$/

export class AlpacaMarketDataProvider implements MarketDataProvider {
  readonly capabilities: ProviderCapabilities = { provider: 'ALPACA', assetClasses: ['STOCK', 'ETF'], modes: ['HISTORICAL', 'DELAYED'], feed: 'IEX', configured: false, status: 'ACCEPTED' }
  constructor(private readonly fetcher: typeof fetch = fetch) {}
  async getHistoricalCandles(request: { symbol: LiveSymbol; interval: Timeframe; limit: number; before?: number; signal?: AbortSignal }): Promise<MarketCandle[]> {
    if (!allowedSymbols.test(request.symbol) || !(TIMEFRAMES as readonly string[]).includes(request.interval)) throw new Error('Invalid Alpaca symbol or timeframe.')
    const query = new URLSearchParams({ symbol: request.symbol, timeframe: request.interval, limit: String(Math.min(300, Math.max(1, request.limit))) })
    if (request.before !== undefined) query.set('before', String(Math.floor(request.before)))
    const values = await this.json<unknown[]>(`${ROOT}/candles?${query}`, request.signal)
    return values.map(value => this.mapCandle(value, request.symbol, request.interval)).filter((value): value is MarketCandle => value !== null)
  }
  async listInstruments(signal?: AbortSignal): Promise<Instrument[]> { return this.json<unknown[]>(`${ROOT}/instruments?query=`, signal).then(values => values.map(value => this.mapInstrument(value)).filter((value): value is Instrument => value !== null)) }
  async searchInstruments(query: string, signal?: AbortSignal): Promise<Instrument[]> { return this.json<unknown[]>(`${ROOT}/instruments?query=${encodeURIComponent(query.trim().slice(0, 64))}`, signal).then(values => values.map(value => this.mapInstrument(value)).filter((value): value is Instrument => value !== null)) }
  async listProducts(signal?: AbortSignal): Promise<LiveSymbol[]> { return (await this.listInstruments(signal)).map(item => item.symbol) }
  subscribeCandles(request: { symbol: LiveSymbol; interval: Timeframe; seed?: MarketCandle }, subscription: { onCandle: (candle: MarketCandle) => void; onStatus: (status: LiveConnectionStatus) => void; onReconnect: () => void }): () => void {
    let active = true
    const poll = async () => { try { const values = await this.getHistoricalCandles({ symbol: request.symbol, interval: request.interval, limit: 1 }); if (active && values[0]) subscription.onCandle(values[0]) } catch { if (active) subscription.onStatus('DISCONNECTED') } }
    subscription.onStatus('DELAYED'); const timer = window.setInterval(() => void poll(), 30_000)
    return () => { active = false; window.clearInterval(timer) }
  }
  private async json<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await this.fetcher(url, { credentials: 'same-origin', headers: { Accept: 'application/json' }, signal })
    const body = await response.json() as unknown
    if (!response.ok) { const code = typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string' ? body.code : 'ALPACA_PROVIDER_UNAVAILABLE'; throw new Error(code) }
    if (!Array.isArray(body)) throw new Error('ALPACA_INVALID_RESPONSE')
    return body as T
  }
  private mapCandle(value: unknown, symbol: LiveSymbol, interval: Timeframe): MarketCandle | null {
    if (typeof value !== 'object' || value === null) return null
    const item = value as Record<string, unknown>, numbers = ['openTime', 'closeTime']
    if (numbers.some(key => typeof item[key] !== 'number' || !Number.isSafeInteger(item[key]))) return null
    return validMarketCandle({ openTime: item.openTime as number, closeTime: item.closeTime as number, open: String(item.open), high: String(item.high), low: String(item.low), close: String(item.close), volume: String(item.volume), closed: item.closed === true }, symbol, interval)
  }
  private mapInstrument(value: unknown): Instrument | null {
    if (typeof value !== 'object' || value === null) return null
    const item = value as Record<string, unknown>, symbol = typeof item.symbol === 'string' ? item.symbol : '', name = typeof item.name === 'string' ? item.name : '', exchange = typeof item.exchange === 'string' ? item.exchange : ''
    if (!allowedSymbols.test(symbol) || !name || name.length > 160 || exchange.length > 32) return null
    return { symbol, name, assetClass: item.assetClass === 'ETF' ? 'ETF' : 'STOCK', exchange, provider: 'ALPACA', feed: 'IEX', priceIncrement: .01, pricePrecision: 2, modes: ['HISTORICAL', 'DELAYED'] }
  }
}

export const alpacaMarketData = new AlpacaMarketDataProvider()
