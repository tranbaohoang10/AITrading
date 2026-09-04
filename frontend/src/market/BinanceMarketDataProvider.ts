import { isLiveSymbol, isTimeframe, validMarketCandle, type CandleSubscription, type LiveSymbol, type MarketCandle, type MarketDataProvider } from './liveMarket'
import type { Timeframe } from './chartMath'

type Socket = Pick<WebSocket, 'close' | 'onopen' | 'onmessage' | 'onerror' | 'onclose'>
type SocketFactory = (url: string) => Socket
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const REST_BASE = 'https://api.binance.com/api/v3'
const STREAM_BASE = 'wss://stream.binance.com:9443/ws'
const MAX_RECONNECT_DELAY = 30_000

const error = (message: string) => new Error(message)
const kline = (value: unknown, symbol: LiveSymbol, interval: Timeframe, closed: boolean): MarketCandle | null => {
  if (!Array.isArray(value) || value.length < 7 || !Number.isSafeInteger(value[0]) || !Number.isSafeInteger(value[6]) || ![1, 2, 3, 4, 5].every(index => typeof value[index] === 'string')) return null
  return validMarketCandle({ openTime: value[0] as number, closeTime: value[6] as number, open: value[1] as string, high: value[2] as string, low: value[3] as string, close: value[4] as string, volume: value[5] as string, closed }, symbol, interval)
}

const streamKline = (value: unknown): { symbol: LiveSymbol; interval: Timeframe; candle: MarketCandle } | null => {
  if (!value || typeof value !== 'object') return null
  const event = value as Record<string, unknown>, payload = event.k
  if (!payload || typeof payload !== 'object') return null
  const k = payload as Record<string, unknown>
  if (typeof k.s !== 'string' || typeof k.i !== 'string' || !isLiveSymbol(k.s) || !isTimeframe(k.i) || !Number.isSafeInteger(k.t) || !Number.isSafeInteger(k.T) || ![k.o, k.h, k.l, k.c, k.v].every(value => typeof value === 'string')) return null
  const candle = validMarketCandle({ openTime: k.t as number, closeTime: k.T as number, open: k.o as string, high: k.h as string, low: k.l as string, close: k.c as string, volume: k.v as string, closed: k.x === true }, k.s, k.i)
  return candle ? { symbol: k.s, interval: k.i, candle } : null
}

export class BinanceMarketDataProvider implements MarketDataProvider {
  constructor(private readonly fetcher: FetchLike = globalThis.fetch.bind(globalThis), private readonly socketFactory: SocketFactory = url => new WebSocket(url), private readonly restBase = REST_BASE, private readonly streamBase = STREAM_BASE) {}

  async getHistoricalCandles({ symbol, interval, limit, signal }: { symbol: LiveSymbol; interval: Timeframe; limit: number; signal?: AbortSignal }): Promise<MarketCandle[]> {
    const capped = Math.max(1, Math.min(1000, Math.floor(limit)))
    const url = `${this.restBase}/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${capped}`
    const response = await this.fetcher(url, { signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw error('Failed to load Binance market data.')
    const body: unknown = await response.json()
    if (!Array.isArray(body)) throw error('Invalid Binance market-data response.')
    const candles = body.map(row => kline(row, symbol, interval, true)).filter((value): value is MarketCandle => value !== null).sort((left, right) => left.openTime - right.openTime)
    if (!candles.length) throw error('Binance returned no valid candles.')
    const unique: MarketCandle[] = []
    for (const candle of candles) {
      const previous = unique.at(-1)
      if (previous?.openTime === candle.openTime) unique[unique.length - 1] = candle
      else unique.push(candle)
    }
    return unique
  }

  subscribeCandles({ symbol, interval }: { symbol: LiveSymbol; interval: Timeframe }, subscription: CandleSubscription): () => void {
    let disposed = false, opened = false, delay = 1_000, socket: Socket | null = null, retry: ReturnType<typeof setTimeout> | null = null
    const connect = () => {
      if (disposed) return
      subscription.onStatus('CONNECTING')
      try { socket = this.socketFactory(`${this.streamBase}/${symbol.toLowerCase()}@kline_${interval}`) }
      catch { schedule() ; return }
      socket.onopen = () => {
        if (disposed) return
        if (opened) subscription.onReconnect()
        opened = true; delay = 1_000; subscription.onStatus('LIVE')
      }
      socket.onmessage = event => {
        if (disposed || typeof event.data !== 'string') return
        try {
          const next = streamKline(JSON.parse(event.data))
          if (next?.symbol === symbol && next.interval === interval) subscription.onCandle(next.candle)
        } catch { /* Ignore malformed public-stream events. */ }
      }
      socket.onerror = () => { if (!disposed) subscription.onStatus('DISCONNECTED') }
      socket.onclose = () => { if (!disposed) { subscription.onStatus('DISCONNECTED'); schedule() } }
    }
    const schedule = () => {
      if (disposed || retry) return
      const wait = delay; delay = Math.min(delay * 2, MAX_RECONNECT_DELAY)
      retry = setTimeout(() => { retry = null; connect() }, wait)
    }
    connect()
    return () => { disposed = true; if (retry) clearTimeout(retry); retry = null; socket?.close(); socket = null }
  }
}

export const binanceMarketData = new BinanceMarketDataProvider()
