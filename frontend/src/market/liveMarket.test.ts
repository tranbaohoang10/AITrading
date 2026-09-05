import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, type FunctionComponent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CoinbaseMarketDataProvider } from './CoinbaseMarketDataProvider'
import { CandleChart, zoomViewport } from './CandleChart'
import { LiveChart } from './LiveChart'
import { displayMarketSymbol, mergeCandles, type CandleSubscription, type LiveSymbol, type MarketCandle, type MarketDataProvider } from './liveMarket'

const baseTime = 1_700_000_040_000
const accountId = '11111111-1111-4111-8111-111111111111'
const candle = (openTime = baseTime, symbol: LiveSymbol = 'BTC-USD', close = '101', open = '100'): MarketCandle => ({ symbol, interval: '1m', openTime, closeTime: openTime + 59_999, open, high: '102', low: '99', close, volume: '5', closed: false })
const LiveChartFixture = LiveChart as FunctionComponent<{ provider: MarketDataProvider }>

describe('PB-034 Coinbase market-data contract', () => {
  it('maps only entitled public Coinbase USD products into an expanded instrument catalog', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { id: 'BTC-USD', base_currency: 'BTC', quote_currency: 'USD', display_name: 'Bitcoin / US Dollar', quote_increment: '0.01', trading_disabled: false },
      { id: 'ETH-USD', base_currency: 'ETH', quote_currency: 'USD', display_name: 'Ethereum / US Dollar', quote_increment: '0.01', trading_disabled: false },
      { id: 'SOL-USD', base_currency: 'SOL', quote_currency: 'USD', display_name: 'Solana / US Dollar', quote_increment: '0.01', trading_disabled: false },
      { id: 'ETH-EUR', base_currency: 'ETH', quote_currency: 'EUR', display_name: 'Ethereum / Euro', quote_increment: '0.01', trading_disabled: false },
      { id: 'DOGE-USD', base_currency: 'DOGE', quote_currency: 'USD', display_name: 'Dogecoin / US Dollar', quote_increment: '0.0001', trading_disabled: false },
    ]), { status: 200 }))
    const provider = new CoinbaseMarketDataProvider(fetcher, () => { throw new Error('not used') })
    const instruments = await provider.listInstruments()
    expect(instruments.map(item => item.symbol)).toEqual(['BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD'])
    expect(instruments.find(item => item.symbol === 'SOL-USD')).toEqual(expect.objectContaining({ displaySymbol: 'SOL/USD', provider: 'COINBASE', assetClass: 'CRYPTO' }))
    expect(displayMarketSymbol('BTC-USD')).toBe('BTC/USD')
    expect(instruments.some(item => item.symbol === 'ETH-EUR')).toBe(false)
  })

  it('retries a timed-out Coinbase REST request once and returns a bounded error', async () => {
    const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    }))
    const provider = new CoinbaseMarketDataProvider(fetcher, () => { throw new Error('not used') }, undefined, undefined, () => Date.now(), 5)
    await expect(provider.listInstruments()).rejects.toThrow('Coinbase market data timed out or could not be reached.')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('maps public Coinbase rows into ordered, deduplicated neutral candles and aggregates derived intervals', async () => {
    const now = baseTime + 10_000_000
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      [Math.floor((baseTime + 900_000) / 1000), '99', '105', '101', '104', '7'], [Math.floor(baseTime / 1000), '98', '102', '100', '101', '5'], [Math.floor((baseTime + 900_000) / 1000), '99', '106', '101', '105', '8'],
    ]), { status: 200 }))
    const provider = new CoinbaseMarketDataProvider(fetcher, () => { throw new Error('not used') }, 'https://api.exchange.coinbase.com', undefined, () => now)
    await expect(provider.getHistoricalCandles({ symbol: 'BTC-USD', interval: '30m', limit: 1 })).resolves.toEqual([
      expect.objectContaining({ symbol: 'BTC-USD', interval: '30m', openTime: Math.floor(baseTime / 1_800_000) * 1_800_000, open: '100', high: '106', low: '98', close: '105', volume: '13' }),
    ])
    expect(String(fetcher.mock.calls[0][0])).toContain('granularity=900')
  })

  it('requests an older bounded page with an exclusive end before the current first candle', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      [Math.floor((baseTime - 60_000) / 1000), '98', '102', '100', '101', '5'],
    ]), { status: 200 }))
    const provider = new CoinbaseMarketDataProvider(fetcher, () => { throw new Error('not used') }, 'https://api.exchange.coinbase.com', undefined, () => baseTime + 10_000)
    await provider.getHistoricalCandles({ symbol: 'BTC-USD', interval: '1m', limit: 300, before: baseTime - 1 })
    const request = new URL(String(fetcher.mock.calls[0][0]))
    expect(request.searchParams.get('end')).toBe(new Date(baseTime - 1).toISOString())
    expect(request.searchParams.get('granularity')).toBe('60')
  })

  it('updates a matching current bucket and appends one later bucket from Coinbase matches', () => {
    const sockets: Array<{ send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>; onopen: ((event: Event) => void) | null; onmessage: ((event: MessageEvent) => void) | null; onerror: ((event: Event) => void) | null; onclose: ((event: CloseEvent) => void) | null }> = []
    const provider = new CoinbaseMarketDataProvider(vi.fn(), () => { const socket = { send: vi.fn(), close: vi.fn(), onopen: null, onmessage: null, onerror: null, onclose: null }; sockets.push(socket); return socket as never })
    const onCandle = vi.fn(), stop = provider.subscribeCandles({ symbol: 'BTC-USD', interval: '1m', seed: candle() }, { onCandle, onStatus: vi.fn(), onReconnect: vi.fn() })
    sockets[0].onopen?.(new Event('open'))
    sockets[0].onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'match', product_id: 'BTC-USD', time: new Date(baseTime + 10_000).toISOString(), price: '103', size: '2' }) }))
    sockets[0].onmessage?.(new MessageEvent('message', { data: JSON.stringify({ type: 'match', product_id: 'BTC-USD', time: new Date(baseTime + 60_000).toISOString(), price: '104', size: '3' }) }))
    expect(onCandle).toHaveBeenNthCalledWith(1, expect.objectContaining({ openTime: baseTime, high: '103', close: '103', volume: '7' }))
    expect(onCandle).toHaveBeenNthCalledWith(2, expect.objectContaining({ openTime: baseTime, closed: true }))
    expect(onCandle).toHaveBeenNthCalledWith(3, expect.objectContaining({ openTime: baseTime + 60_000, open: '104', volume: '3' }))
    expect(sockets[0].send).toHaveBeenCalledWith(expect.stringContaining('"matches"'))
    stop(); expect(sockets[0].close).toHaveBeenCalledTimes(1)
  })

  it('uses bounded reconnect status and closes active socket on cleanup', async () => {
    vi.useFakeTimers()
    const sockets: Array<{ send: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>; onopen: ((event: Event) => void) | null; onmessage: ((event: MessageEvent) => void) | null; onerror: ((event: Event) => void) | null; onclose: ((event: CloseEvent) => void) | null }> = []
    const provider = new CoinbaseMarketDataProvider(vi.fn(), () => { const socket = { send: vi.fn(), close: vi.fn(), onopen: null, onmessage: null, onerror: null, onclose: null }; sockets.push(socket); return socket as never })
    const onStatus = vi.fn(), onReconnect = vi.fn(), stop = provider.subscribeCandles({ symbol: 'BTC-USD', interval: '1m' }, { onCandle: vi.fn(), onStatus, onReconnect })
    sockets[0].onopen?.(new Event('open')); sockets[0].onclose?.(new CloseEvent('close'))
    expect(onStatus).toHaveBeenLastCalledWith('RECONNECTING')
    await vi.advanceTimersByTimeAsync(1_000); sockets[1].onopen?.(new Event('open'))
    expect(onReconnect).toHaveBeenCalledTimes(1); stop(); expect(sockets[1].close).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('falls back to delayed same-origin polling when Coinbase WebSocket cannot connect', async () => {
    vi.useFakeTimers()
    try {
      const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([
        [Math.floor(baseTime / 1000), '99', '102', '100', '101', '5'],
      ]), { status: 200 }))
      const socket = { send: vi.fn(), close: vi.fn(), onopen: null, onmessage: null, onerror: null, onclose: null }
      const provider = new CoinbaseMarketDataProvider(fetcher, () => socket as never, 'http://127.0.0.1/api/market/coinbase', undefined, () => baseTime + 60_000, undefined, accountId)
      const onCandle = vi.fn(), onStatus = vi.fn()
      const stop = provider.subscribeCandles({ symbol: 'BTC-USD', interval: '1m' }, { onCandle, onStatus, onReconnect: vi.fn() })

      await vi.advanceTimersByTimeAsync(5_000)
      expect(String(fetcher.mock.calls[0][0])).toContain('/api/market/coinbase/series/BTC-USD/60/')
      expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('X-Workspace-User')).toBe(accountId)
      expect(onCandle).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'BTC-USD', openTime: baseTime }))
      expect(onStatus).toHaveBeenLastCalledWith('DELAYED')
      stop()
      expect(socket.close).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cleans up old selection subscriptions and keeps Coinbase actions left of utilities', async () => {
    const unsubscribe = vi.fn()
    const provider: MarketDataProvider = { getHistoricalCandles: vi.fn(async ({ symbol, interval }) => [{ ...candle(baseTime, symbol), interval }]), subscribeCandles: vi.fn((_request, subscription: CandleSubscription) => { subscription.onStatus('LIVE'); return unsubscribe }) }
    render(createElement(LiveChartFixture, { provider }))
    await screen.findByLabelText('Coinbase · LIVE')
    expect(provider.getHistoricalCandles).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'BTC-USD', interval: '1m', limit: 300 }))
    fireEvent.click(screen.getByLabelText('Symbol'))
    fireEvent.click(screen.getByRole('button', { name: /ETH\/USD/ }))
    await waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(provider.subscribeCandles).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: 'ETH-USD', interval: '1m' }), expect.any(Object)))
    fireEvent.click(screen.getByLabelText('Timeframe'))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '5m' }))
    await waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('img', { name: /ETH\/USD live Coinbase candlesticks/i })).toBeInTheDocument()
    const toolbar = screen.getByTestId('chart-toolbar')
    expect(toolbar.querySelector('.ml-auto')?.textContent).toContain('')
  })

  it('renders a real realtime candle while the initial history request is still pending', async () => {
    let resolveHistory!: (items: MarketCandle[]) => void
    const pendingHistory = new Promise<MarketCandle[]>(resolve => { resolveHistory = resolve })
    const provider: MarketDataProvider = {
      getHistoricalCandles: vi.fn(({ symbol }) => symbol === 'POL-USD' ? pendingHistory : Promise.resolve([candle(baseTime - 60_000, symbol)])),
      subscribeCandles: vi.fn((request, subscription) => {
        subscription.onStatus('LIVE')
        subscription.onCandle(candle(baseTime, request.symbol))
        return vi.fn()
      }),
    }
    render(createElement(LiveChartFixture, { provider }))
    await screen.findByLabelText('Coinbase · LIVE')
    fireEvent.click(screen.getByLabelText('Symbol'))
    fireEvent.click(screen.getByRole('button', { name: /POL\/USD/ }))
    expect(await screen.findByRole('img', { name: /POL\/USD live Coinbase candlesticks, 1 candles/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Coinbase · LIVE')).toBeInTheDocument()
    await act(async () => resolveHistory([candle(baseTime - 60_000, 'POL-USD')]))
    await waitFor(() => expect(screen.getByRole('img', { name: /POL\/USD live Coinbase candlesticks, 2 candles/ })).toBeInTheDocument())
  })

  it('offers real Coinbase studies and selectable multi-chart layouts', async () => {
    const provider: MarketDataProvider = { getHistoricalCandles: vi.fn(async ({ symbol }) => Array.from({ length: 40 }, (_, index) => candle(baseTime + index * 60_000, symbol, String(101 + index % 5)))), subscribeCandles: vi.fn((_request, subscription) => { subscription.onStatus('LIVE'); return vi.fn() }) }
    render(createElement(LiveChartFixture, { provider }))
    await screen.findByLabelText('Coinbase · LIVE')
    fireEvent.click(screen.getByLabelText('Timeframe'))
    fireEvent.click(screen.getByRole('menuitemradio', { name: '15m' }))
    await waitFor(() => expect(screen.getByRole('img', { name: /40 candles/ })).toBeInTheDocument())
    const indicatorButton = screen.getByRole('button', { name: 'Indicators' })
    expect(indicatorButton).toHaveClass('inline-flex', 'items-center', 'justify-center', 'border-transparent', 'bg-transparent')
    expect(indicatorButton).toHaveAttribute('aria-haspopup', 'dialog')
    expect(indicatorButton).toHaveTextContent('Indicators')
    expect(indicatorButton).not.toHaveTextContent('^')
    expect(indicatorButton.querySelector('[data-testid="indicator-chevron"]')).toBeInTheDocument()
    fireEvent.click(indicatorButton)
    expect(screen.getByRole('tab', { name: 'Community' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'AITrading Community' })).not.toBeInTheDocument()
    for (const name of ['Simple Moving Average (SMA)', 'Exponential Moving Average (EMA)', 'Bollinger Bands (BB)', 'Volume Weighted Average Price (VWAP)', 'Relative Strength Index (RSI)', 'Moving Average Convergence Divergence (MACD)', 'Average True Range (ATR)']) {
      expect(screen.getByText(name)).toBeInTheDocument()
    }
    fireEvent.click(screen.getByText('Simple Moving Average (SMA)').closest('button')!)
    expect(screen.getByLabelText('Active indicators')).toHaveTextContent('sma 50')
    fireEvent.click(screen.getByLabelText('Indicators'))
    fireEvent.click(screen.getByText('Bollinger Bands (BB)').closest('button')!)
    expect(screen.getByLabelText('Active indicators')).toHaveTextContent('bollinger 20')
    for (const name of ['Relative Strength Index (RSI)', 'Moving Average Convergence Divergence (MACD)', 'Average True Range (ATR)']) {
      fireEvent.click(screen.getByLabelText('Indicators'))
      fireEvent.click(screen.getByText(name).closest('button')!)
    }
    const chart = screen.getByRole('img', { name: /40 candles/ })
    expect(chart.querySelector('[data-pane="volume"]')).toBeInTheDocument()
    expect(chart.querySelectorAll('[data-pane="oscillator"]')).toHaveLength(3)
    fireEvent.click(screen.getByLabelText('Chart layout'))
    fireEvent.click(screen.getByRole('button', { name: 'Layout 4' }))
    expect(screen.getAllByRole('button', { name: /Chart cell/ })).toHaveLength(4)
    await waitFor(() => expect(screen.getAllByRole('img', { name: /live Coinbase candlesticks/ })).toHaveLength(4))
    fireEvent.click(screen.getByRole('button', { name: 'Chart cell 3' }))
    expect(screen.getByRole('button', { name: 'Chart cell 3' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows Coinbase header OHLC and volume for the crosshair candle then returns latest on leave', () => {
    const page = { dataset: { symbol: 'BTC-USD' }, items: [
      { ordinal: 0, time: new Date(baseTime).toISOString(), open: '100', high: '101', low: '98', close: '99', volume: '2' },
      { ordinal: 1, time: new Date(baseTime + 60_000).toISOString(), open: '100', high: '104', low: '99', close: '103', volume: '5' },
    ] }
    render(createElement(CandleChart, { page, sourceLabel: 'COINBASE', timeframe: '1m' }))
    const chart = screen.getByRole('img', { name: /candlesticks/ })
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, bottom: 400, right: 900, width: 900, height: 400, toJSON: () => ({}) })
    fireEvent.pointerMove(chart, { clientX: 210, clientY: 120 })
    expect(screen.getByTestId('market-header')).toHaveTextContent('C 99.00')
    expect(screen.getByTestId('market-header')).toHaveTextContent('Volume 2')
    expect(screen.getByTestId('market-header').querySelector('.text-rose-300')).toBeInTheDocument()
    fireEvent.pointerLeave(chart)
    expect(screen.getByTestId('market-header')).toHaveTextContent('C 103.00')
  })

  it('keeps wheel zoom centered on the pointer instead of forcing a following view to the latest candle', () => {
    const next = zoomViewport({ start: 0, count: 100 }, 100, .35, -120)
    expect(next.viewport.count).toBeLessThan(100)
    expect(next.viewport.start).toBeGreaterThan(0)
    expect(next.viewport.start + next.viewport.count).toBeLessThan(100)
    expect(next.followingLatest).toBe(false)
  })

  it('keeps a manual price scale after a realtime append and resets it on double-clicking the axis', async () => {
    const firstPage = { dataset: { symbol: 'BTC-USD' }, items: Array.from({ length: 10 }, (_, ordinal) => ({ ordinal, time: new Date(baseTime + ordinal * 60_000).toISOString(), open: '100', high: '102', low: '99', close: '101', volume: '2' })) }
    const view = render(createElement(CandleChart, { page: firstPage }))
    const chart = screen.getByRole('img', { name: /candlesticks/ })
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, bottom: 420, right: 900, width: 900, height: 420, toJSON: () => ({}) })
    fireEvent.pointerDown(chart, { pointerId: 6, clientX: 860, clientY: 160 })
    fireEvent.pointerMove(chart, { pointerId: 6, clientX: 860, clientY: 220 })
    fireEvent.pointerUp(chart, { pointerId: 6, clientX: 860, clientY: 220 })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Auto-fit price scale' })).toBeInTheDocument())
    view.rerender(createElement(CandleChart, { page: { ...firstPage, items: [...firstPage.items, { ordinal: 10, time: new Date(baseTime + 600_000).toISOString(), open: '101', high: '103', low: '100', close: '102', volume: '3' }] } }))
    expect(screen.getByRole('button', { name: 'Auto-fit price scale' })).toBeInTheDocument()
    fireEvent.doubleClick(chart, { clientX: 860, clientY: 220 })
    expect(screen.queryByRole('button', { name: 'Auto-fit price scale' })).not.toBeInTheDocument()
  })

  it('keeps only compact primary drawing groups and confirms destructive remove-all', async () => {
    const provider: MarketDataProvider = { getHistoricalCandles: vi.fn(async ({ symbol }) => [candle(baseTime, symbol)]), subscribeCandles: vi.fn((_request, subscription) => { subscription.onStatus('LIVE'); return vi.fn() }) }
    render(createElement(LiveChartFixture, { provider }))
    await screen.findByLabelText('Coinbase · LIVE')
    expect(screen.getByRole('button', { name: 'Cursor tools' })).toBeInTheDocument()
    for (const name of ['Lines & Channels tools', 'Fibonacci tools', 'Patterns tools', 'Shapes tools', 'Text / Annotation tools', 'Position / Risk tools', 'Measure tools', 'More drawing controls']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Zoom In/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'More drawing controls' }))
    expect(screen.getByRole('button', { name: /Remove All Drawings/ })).toBeDisabled()
  })

  it('supports Alt shortcuts for the primary line tools', async () => {
    const provider: MarketDataProvider = { getHistoricalCandles: vi.fn(async ({ symbol }) => [candle(baseTime, symbol)]), subscribeCandles: vi.fn((_request, subscription) => { subscription.onStatus('LIVE'); return vi.fn() }) }
    render(createElement(LiveChartFixture, { provider }))
    await screen.findByLabelText('Coinbase · LIVE')
    fireEvent.keyDown(window, { key: 't', altKey: true })
    expect(screen.getByRole('button', { name: 'Lines & Channels tools' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(window, { key: 'h', altKey: true })
    expect(screen.getByRole('button', { name: 'Lines & Channels tools' })).toHaveAttribute('title', 'Horizontal Line')
  })

  it('merge identity remains symbol, interval and UTC openTime', () => {
    const first = candle(), updated = candle(first.openTime, 'BTC-USD', '102'), next = candle(first.openTime + 60_000, 'BTC-USD', '103')
    expect(mergeCandles([first], updated)).toEqual([updated])
    expect(mergeCandles([first], next)).toEqual([first, next])
  })
})
