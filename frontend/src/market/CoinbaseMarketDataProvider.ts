import { timeframeMilliseconds, type Timeframe } from './chartMath'
import { COINBASE_DEFAULT_SYMBOLS, isLiveSymbol, validMarketCandle, type CandleSubscription, type LiveSymbol, type MarketCandle, type MarketDataProvider } from './liveMarket'

type Socket = Pick<WebSocket, 'close' | 'send' | 'onopen' | 'onmessage' | 'onerror' | 'onclose'>
type SocketFactory = (url: string) => Socket
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type CoinbaseRow = [number, number | string, number | string, number | string, number | string, number | string]
type Trade = { productId: LiveSymbol; time: number; price: string; size: string }

const REST_BASE = 'https://api.exchange.coinbase.com'
const STREAM_BASE = 'wss://ws-feed.exchange.coinbase.com'
const MAX_SOURCE_CANDLES = 300
const MAX_RECONNECT_DELAY = 30_000
const sourceGranularity: Record<Timeframe, number> = { '1m': 60, '5m': 300, '15m': 900, '30m': 900, '1h': 3600, '4h': 3600, '1d': 86400 }

const error = (message: string) => new Error(message)
const decimal = (value: unknown) => {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const normalized = String(value)
  return /^(?:0|[1-9][0-9]{0,12})(?:\.[0-9]{1,12})?$/.test(normalized) && Number.isFinite(Number(normalized)) ? normalized : null
}
const sourceFactor = (interval: Timeframe) => timeframeMilliseconds(interval) / (sourceGranularity[interval] * 1000)
const unique = (candles: MarketCandle[]) => {
  const ordered = [...candles].sort((left, right) => left.openTime - right.openTime)
  return ordered.reduce<MarketCandle[]>((result, candle) => {
    if (result.at(-1)?.openTime === candle.openTime) result[result.length - 1] = candle
    else result.push(candle)
    return result
  }, [])
}

export function aggregateMarketCandles(items: MarketCandle[], interval: Timeframe): MarketCandle[] {
  const bucketMs = timeframeMilliseconds(interval)
  const aggregated: MarketCandle[] = []
  for (const candle of unique(items)) {
    const openTime = Math.floor(candle.openTime / bucketMs) * bucketMs
    const current = aggregated.at(-1)
    if (!current || current.openTime !== openTime) {
      aggregated.push({ ...candle, interval, openTime, closeTime: openTime + bucketMs - 1, closed: candle.closeTime >= openTime + bucketMs - 1 })
      continue
    }
    current.high = String(Math.max(Number(current.high), Number(candle.high)))
    current.low = String(Math.min(Number(current.low), Number(candle.low)))
    current.close = candle.close
    current.volume = String(Number(current.volume) + Number(candle.volume))
    current.closeTime = openTime + bucketMs - 1
    current.closed = current.closed && candle.closed
  }
  return aggregated
}

const historical = (value: unknown, symbol: LiveSymbol, interval: Timeframe, sourceSeconds: number): MarketCandle | null => {
  if (!Array.isArray(value) || value.length < 6 || !Number.isSafeInteger(value[0])) return null
  const [time, low, high, open, close, volume] = value as CoinbaseRow
  const values = [low, high, open, close, volume].map(decimal)
  if (values.some(item => item === null)) return null
  const openTime = time * 1000, closeTime = openTime + sourceSeconds * 1000 - 1
  return validMarketCandle({ openTime, closeTime, low: values[0]!, high: values[1]!, open: values[2]!, close: values[3]!, volume: values[4]!, closed: closeTime <= Date.now() }, symbol, interval)
}

const match = (value: unknown): Trade | null => {
  if (!value || typeof value !== 'object') return null
  const event = value as Record<string, unknown>
  if (event.type !== 'match' || typeof event.product_id !== 'string' || !isLiveSymbol(event.product_id) || typeof event.time !== 'string') return null
  const time = Date.parse(event.time), price = decimal(event.price), size = decimal(event.size)
  return Number.isFinite(time) && price && size ? { productId: event.product_id, time, price, size } : null
}

export class CoinbaseMarketDataProvider implements MarketDataProvider {
  constructor(private readonly fetcher: FetchLike = globalThis.fetch.bind(globalThis), private readonly socketFactory: SocketFactory = url => new WebSocket(url), private readonly restBase = REST_BASE, private readonly streamBase = STREAM_BASE, private readonly now = () => Date.now()) {}

  async listProducts(signal?: AbortSignal): Promise<LiveSymbol[]> {
    const response = await this.fetcher(`${this.restBase}/products`, { signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw error('Failed to load Coinbase products.')
    const body: unknown = await response.json()
    if (!Array.isArray(body)) throw error('Invalid Coinbase products response.')
    const listed = body.flatMap(value => {
      if (!value || typeof value !== 'object') return []
      const product = value as Record<string, unknown>
      return typeof product.id === 'string' && isLiveSymbol(product.id) && product.quote_currency === 'USD' && product.trading_disabled !== true ? [product.id] : []
    })
    return [...new Set([...COINBASE_DEFAULT_SYMBOLS, ...listed])].sort((left, right) => (COINBASE_DEFAULT_SYMBOLS.includes(left as typeof COINBASE_DEFAULT_SYMBOLS[number]) ? -1 : 0) - (COINBASE_DEFAULT_SYMBOLS.includes(right as typeof COINBASE_DEFAULT_SYMBOLS[number]) ? -1 : 0) || left.localeCompare(right)).slice(0, 40)
  }

  async getHistoricalCandles({ symbol, interval, limit, signal }: { symbol: LiveSymbol; interval: Timeframe; limit: number; signal?: AbortSignal }): Promise<MarketCandle[]> {
    if (!isLiveSymbol(symbol)) throw error('Invalid Coinbase product.')
    const sourceSeconds = sourceGranularity[interval], wanted = Math.max(1, Math.min(1000, Math.floor(limit)))
    const sourceTotal = Math.ceil(wanted * sourceFactor(interval)), batches = Math.ceil(sourceTotal / MAX_SOURCE_CANDLES), end = this.now()
    const responses = await Promise.all(Array.from({ length: batches }, async (_, index) => {
      const batchEnd = end - index * MAX_SOURCE_CANDLES * sourceSeconds * 1000
      const batchStart = batchEnd - MAX_SOURCE_CANDLES * sourceSeconds * 1000
      const url = new URL(`/products/${encodeURIComponent(symbol)}/candles`, this.restBase)
      url.searchParams.set('granularity', String(sourceSeconds)); url.searchParams.set('start', new Date(batchStart).toISOString()); url.searchParams.set('end', new Date(batchEnd).toISOString())
      const response = await this.fetcher(url, { signal, headers: { Accept: 'application/json' } })
      if (!response.ok) throw error('Failed to load Coinbase market data.')
      const body: unknown = await response.json()
      if (!Array.isArray(body)) throw error('Invalid Coinbase market-data response.')
      return body.map(row => historical(row, symbol, interval, sourceSeconds)).filter((value): value is MarketCandle => value !== null)
    }))
    const candles = aggregateMarketCandles(responses.flat(), interval).slice(-wanted)
    if (!candles.length) throw error('Coinbase returned no valid candles.')
    return candles
  }

  subscribeCandles({ symbol, interval, seed }: { symbol: LiveSymbol; interval: Timeframe; seed?: MarketCandle }, subscription: CandleSubscription): () => void {
    let disposed = false, opened = false, delay = 1_000, socket: Socket | null = null, retry: ReturnType<typeof setTimeout> | null = null
    let current = seed?.symbol === symbol && seed.interval === interval ? { ...seed } : null
    const schedule = () => {
      if (disposed || retry) return
      const wait = delay; delay = Math.min(delay * 2, MAX_RECONNECT_DELAY)
      subscription.onStatus('RECONNECTING')
      retry = setTimeout(() => { retry = null; connect() }, wait)
    }
    const emitTrade = (trade: Trade) => {
      if (trade.productId !== symbol) return
      const intervalMs = timeframeMilliseconds(interval), openTime = Math.floor(trade.time / intervalMs) * intervalMs
      if (!current || openTime > current.openTime) {
        if (current) subscription.onCandle({ ...current, closed: true })
        current = validMarketCandle({ openTime, closeTime: openTime + intervalMs - 1, open: trade.price, high: trade.price, low: trade.price, close: trade.price, volume: trade.size, closed: false }, symbol, interval)
      } else if (openTime === current.openTime) {
        current = validMarketCandle({ ...current, high: String(Math.max(Number(current.high), Number(trade.price))), low: String(Math.min(Number(current.low), Number(trade.price))), close: trade.price, volume: String(Number(current.volume) + Number(trade.size)), closed: false }, symbol, interval)
      } else return
      if (current) subscription.onCandle(current)
    }
    const connect = () => {
      if (disposed) return
      subscription.onStatus(opened ? 'RECONNECTING' : 'CONNECTING')
      try { socket = this.socketFactory(this.streamBase) } catch { schedule(); return }
      socket.onopen = () => {
        if (disposed || !socket) return
        try { socket.send(JSON.stringify({ type: 'subscribe', product_ids: [symbol], channels: ['matches'] })) }
        catch { socket.close(); return }
        if (opened) subscription.onReconnect()
        opened = true; delay = 1_000; subscription.onStatus('LIVE')
      }
      socket.onmessage = event => {
        if (disposed || typeof event.data !== 'string') return
        try { const next = match(JSON.parse(event.data)); if (next) emitTrade(next) } catch { /* Ignore malformed public events. */ }
      }
      socket.onerror = () => { if (!disposed) subscription.onStatus('DISCONNECTED') }
      socket.onclose = () => { if (!disposed) schedule() }
    }
    connect()
    return () => { disposed = true; if (retry) clearTimeout(retry); retry = null; socket?.close(); socket = null }
  }
}

export const coinbaseMarketData = new CoinbaseMarketDataProvider()
