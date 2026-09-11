import { afterEach, expect, it, vi } from 'vitest'
import { backendCoinbaseStream, backendProviderStream, streamCandle } from './backendCoinbaseStream'

const account = '00000000-0000-4000-8000-000000000001'
const data = { provider: 'COINBASE', symbol: 'BTC-USD', timeframe: '1m', partial: false, candle: { time: '2025-01-01T00:00:00Z', open: 100, high: 110, low: 90, close: 105, volume: 2 } }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
it('validates provider, timeframe, UTC boundary, OHLC and partial provenance', () => {
  expect(streamCandle(data, 'BTC-USD', '1m')).toMatchObject({ open: '100', volume: '2', partial: false })
  for (const invalid of [{ ...data, provider: 'BINANCE' }, { ...data, partial: 'false' }, { ...data, timeframe: '5m' }, { ...data, candle: { ...data.candle, time: '2025-01-01T00:00:01Z' } }, { ...data, candle: { ...data.candle, high: 99 } }]) expect(streamCandle(invalid, 'BTC-USD', '1m')).toBeNull()
})
it('validates an Alpaca candle only for its exact internal route', () => {
  const equity = { ...data, provider: 'ALPACA', symbol: 'AAPL' }
  expect(streamCandle(equity, 'AAPL', '1m', 'ALPACA')).not.toBeNull()
  expect(streamCandle(equity, 'AAPL', '1m', 'COINBASE')).toBeNull()
})
it('accepts Capital candles only for the exact provider route', () => {
  const capital = { ...data, provider: 'CAPITAL', symbol: 'EURUSD', timeframe: '5m' }
  expect(streamCandle(capital, 'EURUSD', '5m', 'CAPITAL')).not.toBeNull()
  expect(streamCandle(capital, 'EURUSD', '5m', 'OANDA')).toBeNull()
})
it('maps authenticated subscriptions and the official market clock to clear UX states', async () => {
  vi.useFakeTimers()
  let output!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(controller) { output = controller } })
  const fetcher = vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }))
  const onStatus = vi.fn(), dispose = backendProviderStream(account, 'ALPACA', 'AAPL', '1m', { onCandle: vi.fn(), onStatus, onReconnect: vi.fn() }, fetcher)
  await vi.advanceTimersByTimeAsync(0)
  output.enqueue(new TextEncoder().encode('event:status\ndata:{"status":"SUBSCRIBED"}\n\nevent:status\ndata:{"status":"MARKET_CLOSED"}\n\n'))
  await vi.advanceTimersByTimeAsync(0)
  expect(onStatus).toHaveBeenCalledWith('CONNECTED')
  expect(onStatus).toHaveBeenLastCalledWith('MARKET_CLOSED')
  dispose();output.close()
})
it('uses an owner-bound same-origin stream, parses split frames and coalesces tick updates', async () => {
  vi.useFakeTimers()
  let output!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(controller) { output = controller } })
  const fetcher = vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }))
  vi.stubGlobal('fetch', fetcher)
  const onCandle = vi.fn(), onStatus = vi.fn(), onReconnect = vi.fn()
  const dispose = backendCoinbaseStream(account, 'BTC-USD', '1m', { onCandle, onStatus, onReconnect })
  await vi.advanceTimersByTimeAsync(0)
  expect(fetcher.mock.calls[0][0]).toBe('/api/market/stream?symbol=BTC-USD&timeframe=1m')
  expect(fetcher.mock.calls[0][1].headers.get('X-Workspace-User')).toBe(account)
  output.enqueue(new TextEncoder().encode('event:status\ndata:{"status":"LIVE"}\n\n'))
  await vi.advanceTimersByTimeAsync(0)
  expect(onStatus).not.toHaveBeenCalledWith('LIVE')
  const frame = `event:candle\ndata:${JSON.stringify(data)}\n\n`, encoder = new TextEncoder()
  output.enqueue(encoder.encode(frame.slice(0, 20)))
  output.enqueue(encoder.encode(frame.slice(20) + frame + frame))
  await vi.advanceTimersByTimeAsync(249); expect(onCandle).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1); expect(onCandle).toHaveBeenCalledTimes(1); expect(onStatus).toHaveBeenLastCalledWith('LIVE')
  dispose();output.close();await vi.advanceTimersByTimeAsync(60_000)
  expect(fetcher).toHaveBeenCalledTimes(1);expect(onReconnect).not.toHaveBeenCalled()
})
it('stops retrying when the rendered account no longer owns the session', async () => {
  vi.useFakeTimers();const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));vi.stubGlobal('fetch', fetcher)
  const dispose = backendCoinbaseStream(account, 'BTC-USD', '1m', { onCandle: vi.fn(), onStatus: vi.fn(), onReconnect: vi.fn() })
  await vi.advanceTimersByTimeAsync(60_000);expect(fetcher).toHaveBeenCalledTimes(1);dispose()
})
it('ignores a read that completes after workspace disposal', async () => {
  vi.useFakeTimers()
  let output!: ReadableStreamDefaultController<Uint8Array>
  const body = new ReadableStream<Uint8Array>({ start(controller) { output = controller } })
  const fetcher = vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }))
  const onCandle = vi.fn(), onReconnect = vi.fn()
  const dispose = backendCoinbaseStream(account, 'BTC-USD', '1m', { onCandle, onStatus: vi.fn(), onReconnect }, fetcher)
  await vi.advanceTimersByTimeAsync(0)
  dispose()
  const next = { ...data, candle: { ...data.candle, time: '2025-01-01T00:01:00Z' } }
  output.enqueue(new TextEncoder().encode(`event:candle\ndata:${JSON.stringify(data)}\n\nevent:candle\ndata:${JSON.stringify(next)}\n\n`))
  output.close()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(onCandle).not.toHaveBeenCalled(); expect(onReconnect).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(1)
})
