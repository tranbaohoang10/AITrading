import { workspaceHeaders } from '../auth/api'
import { timeframeMilliseconds, type Timeframe } from './chartMath'
import { validMarketCandle, type CandleSubscription, type LiveConnectionStatus, type MarketCandle } from './liveMarket'

export function streamCandle(raw: unknown, symbol: string, interval: Timeframe, provider = 'COINBASE'): MarketCandle | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>, candle = data.candle as Record<string, unknown> | undefined
  if (data.provider !== provider || data.symbol !== symbol || data.timeframe !== interval || typeof data.partial !== 'boolean' || !candle || typeof candle.time !== 'string') return null
  const openTime = Date.parse(candle.time), width = timeframeMilliseconds(interval)
  if (!Number.isSafeInteger(openTime) || openTime % width !== 0 || openTime > Date.now() + 5000) return null
  return validMarketCandle({ openTime, closeTime: openTime + width - 1, open: String(candle.open), high: String(candle.high), low: String(candle.low), close: String(candle.close), volume: String(candle.volume), closed: false, partial: data.partial }, symbol, interval)
}

/** Authenticated same-origin SSE, coalesced to at most four chart updates/second. */
export function backendCoinbaseStream(account: string, symbol: string, interval: Timeframe, subscription: CandleSubscription, fetcher: typeof fetch = globalThis.fetch.bind(globalThis)): () => void {
  return backendProviderStream(account, 'COINBASE', symbol, interval, subscription, fetcher)
}

export function backendProviderStream(account: string, provider: string, symbol: string, interval: Timeframe, subscription: CandleSubscription, fetcher: typeof fetch = globalThis.fetch.bind(globalThis)): () => void {
  if (!['COINBASE', 'ALPACA', 'OANDA', 'CTRADER'].includes(provider)) throw new Error('Unsupported stream provider')
  let disposed = false, opened = false, delay = 1000, controller: AbortController | undefined
  let retry: ReturnType<typeof setTimeout> | undefined, flush: ReturnType<typeof setTimeout> | undefined
  let pending: MarketCandle | undefined, status: LiveConnectionStatus | undefined, lastFrame = Date.now()
  const setStatus = (next: LiveConnectionStatus) => { if (!disposed && status !== next) { status = next; subscription.onStatus(next) } }
  const emit = (candle: MarketCandle) => {
    if (disposed) return
    if (pending && pending.openTime !== candle.openTime) subscription.onCandle({ ...pending, closed: true })
    pending = candle
    if (!flush) flush = setTimeout(() => { flush = undefined; if (!disposed && pending) { subscription.onCandle(pending); pending = undefined; setStatus('LIVE') } }, 250)
  }
  const frame = (text: string) => {
    const lines = text.split(/\r?\n/), event = lines.find(line => line.startsWith('event:'))?.slice(6).trim()
    const body = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!body) return
    const data: unknown = JSON.parse(body)
    if (event === 'candle' || event === 'snapshot') {
      const candle = streamCandle(data, symbol, interval, provider)
      if (!candle) throw new Error('Invalid stream candle')
      emit(candle)
    } else if (event === 'status' && data && typeof data === 'object' && 'status' in data) {
      const next = data.status
      if (next === 'AUTHENTICATED' || next === 'SUBSCRIBED') setStatus('CONNECTED')
      else if (typeof next === 'string' && ['CONNECTING', 'MARKET_CLOSED', 'DELAYED', 'RECONNECTING', 'DISCONNECTED'].includes(next)) setStatus(next as LiveConnectionStatus)
    }
  }
  const connect = async () => {
    if (disposed) return
    controller = new AbortController(); lastFrame = Date.now(); setStatus(opened ? 'RECONNECTING' : 'CONNECTING')
    const idle = setInterval(() => { if (Date.now() - lastFrame > 45_000) controller?.abort() }, 5000)
    let denied = false
    try {
      const parameters: Record<string, string> = { symbol, timeframe: interval }
      if (provider !== 'COINBASE') parameters.provider = provider
      const response = await fetcher(`/api/market/stream?${new URLSearchParams(parameters)}`, { headers: workspaceHeaders(account), credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      if (disposed) return
      denied = response.status === 401 || response.status === 403
      if (!response.ok || !response.body || !response.headers.get('Content-Type')?.startsWith('text/event-stream')) throw new Error('Stream unavailable')
      if (opened) subscription.onReconnect()
      opened = true; delay = 1000; lastFrame = Date.now()
      const reader = response.body.getReader(), decoder = new TextDecoder()
      let buffer = ''
      while (!disposed) {
        const next = await reader.read()
        if (next.done || disposed) break
        lastFrame = Date.now(); buffer += decoder.decode(next.value, { stream: true })
        if (buffer.length > 131072) throw new Error('Stream frame too large')
        const frames = buffer.split(/\r?\n\r?\n/); buffer = frames.pop() ?? ''
        for (const value of frames) frame(value)
      }
    } catch { if (!disposed) setStatus('DISCONNECTED') }
    finally {
      clearInterval(idle); controller.abort()
      if (!disposed && !denied) { retry = setTimeout(() => { void connect() }, delay); delay = Math.min(delay * 2, 30_000) }
    }
  }
  void connect()
  return () => { disposed = true; controller?.abort(); if (retry) clearTimeout(retry); if (flush) clearTimeout(flush); pending = undefined }
}
