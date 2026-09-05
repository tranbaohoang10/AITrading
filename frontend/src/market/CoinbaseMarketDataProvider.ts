import { timeframeMilliseconds, type Timeframe } from './chartMath'
import { workspaceHeaders } from '../auth/api'
import { COINBASE_DEFAULT_SYMBOLS, DEFAULT_INSTRUMENTS, isLiveSymbol, validMarketCandle, type CandleSubscription, type Instrument, type LiveSymbol, type MarketCandle, type MarketDataProvider } from './liveMarket'

type Socket = Pick<WebSocket, 'close' | 'send' | 'onopen' | 'onmessage' | 'onerror' | 'onclose'>
type SocketFactory = (url: string) => Socket
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
type CoinbaseRow = [number, number | string, number | string, number | string, number | string, number | string]
type Trade = { productId: LiveSymbol; time: number; price: string; size: string }

const browserOrigin = typeof window === 'undefined' ? 'http://127.0.0.1' : window.location.origin
const REST_BASE = `${browserOrigin}/api/market/coinbase`
const STREAM_BASE = 'wss://ws-feed.exchange.coinbase.com'
const MAX_SOURCE_CANDLES = 300
const MAX_RECONNECT_DELAY = 30_000
const REST_TIMEOUT_MS = 8_000
const STREAM_CONNECT_TIMEOUT_MS = 5_000
const POLL_INTERVAL_MS = 10_000
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
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
  constructor(private readonly fetcher: FetchLike = globalThis.fetch.bind(globalThis), private readonly socketFactory: SocketFactory = url => new WebSocket(url), private readonly restBase = REST_BASE, private readonly streamBase = STREAM_BASE, private readonly now = () => Date.now(), private readonly restTimeoutMs = REST_TIMEOUT_MS, private readonly accountId?: string) {}

  private async request(input: RequestInfo | URL, signal?: AbortSignal): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController()
      const abort = () => controller.abort(signal?.reason)
      const timeout = setTimeout(() => controller.abort(), this.restTimeoutMs)
      if (signal?.aborted) abort()
      else signal?.addEventListener('abort', abort, { once: true })
      try {
        const headers = new Headers({ Accept: 'application/json' })
        if (this.accountId && this.restBase.endsWith('/api/market/coinbase')) headers.set('X-Workspace-User', workspaceHeaders(this.accountId).get('X-Workspace-User')!)
        const response = await this.fetcher(input, { signal: controller.signal, credentials: 'same-origin', cache: 'no-store', headers })
        if (response.ok || attempt === 1 || !RETRYABLE_STATUS.has(response.status)) return response
      } catch (cause) {
        if (signal?.aborted) throw cause
        if (attempt === 1) throw error('Coinbase market data timed out or could not be reached.')
      } finally {
        clearTimeout(timeout)
        signal?.removeEventListener('abort', abort)
      }
    }
    throw error('Coinbase market data could not be reached.')
  }

  async listInstruments(signal?: AbortSignal): Promise<Instrument[]> {
    const response = await this.request(this.restBase.endsWith('/api/market/coinbase') ? `${this.restBase}/catalog` : `${this.restBase}/products`, signal)
    if (!response.ok) throw error('Failed to load Coinbase products.')
    const body: unknown = await response.json()
    if (!Array.isArray(body)) throw error('Invalid Coinbase products response.')
    const listed = body.flatMap(value => {
      if (!value || typeof value !== 'object') return []
      const product = value as Record<string, unknown>
      const symbol = typeof product.id === 'string' ? product.id : ''
      if (!isLiveSymbol(symbol) || product.quote_currency !== 'USD' || product.trading_disabled === true) return []
      const fallback = DEFAULT_INSTRUMENTS.find(item => item.symbol === symbol)
      const base = typeof product.base_currency === 'string' ? product.base_currency : symbol.split('-')[0]
      const quote = typeof product.quote_currency === 'string' ? product.quote_currency : symbol.split('-')[1]
      const increment = typeof product.quote_increment === 'string' && Number(product.quote_increment) > 0 ? Number(product.quote_increment) : fallback?.priceIncrement ?? .01
      return [{ symbol, displaySymbol: `${base}/${quote}`, name: typeof product.display_name === 'string' ? product.display_name : `${base} / ${quote}`, assetClass: 'CRYPTO' as const, base, quote, exchange: 'Coinbase', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: increment, pricePrecision: fallback?.pricePrecision ?? Math.max(0, String(product.quote_increment ?? '').split('.')[1]?.length ?? 2), modes: ['HISTORICAL', 'REALTIME'] as Instrument['modes'] }]
    })
    const bySymbol = new Map(listed.map(item => [item.symbol, item] as const))
    const defaults = COINBASE_DEFAULT_SYMBOLS.map(symbol => bySymbol.get(symbol)).filter(Boolean) as Instrument[]
    return [...defaults, ...listed.filter(item => !COINBASE_DEFAULT_SYMBOLS.includes(item.symbol as typeof COINBASE_DEFAULT_SYMBOLS[number]))].slice(0, 40)
  }

  async listProducts(signal?: AbortSignal): Promise<LiveSymbol[]> {
    return (await this.listInstruments(signal)).map(item => item.symbol)
  }

  async getHistoricalCandles({ symbol, interval, limit, before, signal }: { symbol: LiveSymbol; interval: Timeframe; limit: number; before?: number; signal?: AbortSignal }): Promise<MarketCandle[]> {
    if (!isLiveSymbol(symbol)) throw error('Invalid Coinbase product.')
    const sourceSeconds = sourceGranularity[interval], wanted = Math.max(1, Math.min(1000, Math.floor(limit)))
    const sourceTotal = Math.ceil(wanted * sourceFactor(interval)), batches = Math.ceil(sourceTotal / MAX_SOURCE_CANDLES), end = before ?? this.now()
    const responses: MarketCandle[][] = []
    for (let index = 0; index < batches; index += 1) {
      const batchEnd = end - index * MAX_SOURCE_CANDLES * sourceSeconds * 1000
      const batchSize = Math.min(MAX_SOURCE_CANDLES, sourceTotal - index * MAX_SOURCE_CANDLES)
      const batchStart = batchEnd - batchSize * sourceSeconds * 1000
      const localProxy = this.restBase.endsWith('/api/market/coinbase'), ranged = localProxy || before !== undefined || batches > 1
      const url = new URL(localProxy
        ? `${this.restBase}/series/${encodeURIComponent(symbol)}/${sourceSeconds}${ranged ? `/${batchStart}/${batchEnd}` : ''}`
        : `/products/${encodeURIComponent(symbol)}/candles`, this.restBase)
      if (!localProxy) {
        url.searchParams.set('granularity', String(sourceSeconds))
        if (ranged) { url.searchParams.set('start', new Date(batchStart).toISOString()); url.searchParams.set('end', new Date(batchEnd).toISOString()) }
      }
      const response = await this.request(url, signal)
      if (!response.ok) throw error('Failed to load Coinbase market data.')
      const body: unknown = await response.json()
      if (!Array.isArray(body)) throw error('Invalid Coinbase market-data response.')
      responses.push(body.map(row => historical(row, symbol, interval, sourceSeconds)).filter((value): value is MarketCandle => value !== null))
    }
    const candles = aggregateMarketCandles(responses.flat(), interval).slice(-wanted)
    if (!candles.length) throw error('Coinbase returned no valid candles.')
    return candles
  }

  subscribeCandles({ symbol, interval, seed }: { symbol: LiveSymbol; interval: Timeframe; seed?: MarketCandle }, subscription: CandleSubscription): () => void {
    let disposed = false, opened = false, polling = false, delay = 1_000, socket: Socket | null = null, retry: ReturnType<typeof setTimeout> | null = null
    let connectTimeout: ReturnType<typeof setTimeout> | null = null, pollTimer: ReturnType<typeof setTimeout> | null = null
    let current = seed?.symbol === symbol && seed.interval === interval ? { ...seed } : null
    const schedule = () => {
      if (disposed || polling || retry) return
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
    const startPolling = () => {
      if (disposed || polling) return
      polling = true
      if (retry) clearTimeout(retry)
      retry = null
      socket?.close()
      socket = null
      const poll = async () => {
        let succeeded = false
        try {
          const latest = (await this.getHistoricalCandles({ symbol, interval, limit: 1 })).at(-1)
          if (latest) { current = latest; subscription.onCandle(latest); succeeded = true }
        } catch { /* Keep retrying the authenticated REST fallback. */ }
        if (disposed) return
        subscription.onStatus(succeeded ? 'DELAYED' : 'DISCONNECTED')
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
      }
      subscription.onStatus('DELAYED')
      void poll()
    }
    const connect = () => {
      if (disposed || polling) return
      subscription.onStatus(opened ? 'RECONNECTING' : 'CONNECTING')
      try { socket = this.socketFactory(this.streamBase) } catch { schedule(); return }
      connectTimeout = setTimeout(startPolling, STREAM_CONNECT_TIMEOUT_MS)
      socket.onopen = () => {
        if (connectTimeout) clearTimeout(connectTimeout)
        connectTimeout = null
        if (disposed || polling || !socket) return
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
      socket.onclose = () => {
        if (connectTimeout) clearTimeout(connectTimeout)
        connectTimeout = null
        if (!disposed) { if (opened) schedule(); else startPolling() }
      }
    }
    connect()
    return () => {
      disposed = true
      if (retry) clearTimeout(retry)
      if (connectTimeout) clearTimeout(connectTimeout)
      if (pollTimer) clearTimeout(pollTimer)
      retry = null; connectTimeout = null; pollTimer = null
      socket?.close(); socket = null
    }
  }
}

export const coinbaseMarketData = new CoinbaseMarketDataProvider()
export const coinbaseMarketDataFor = (accountId: string) => new CoinbaseMarketDataProvider(globalThis.fetch.bind(globalThis), url => new WebSocket(url), REST_BASE, STREAM_BASE, () => Date.now(), REST_TIMEOUT_MS, accountId)
