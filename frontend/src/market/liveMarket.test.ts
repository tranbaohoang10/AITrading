import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, type FunctionComponent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { BinanceMarketDataProvider } from './BinanceMarketDataProvider'
import { LiveChart } from './LiveChart'
import { mergeCandles, type CandleSubscription, type LiveSymbol, type MarketCandle, type MarketDataProvider } from './liveMarket'

const candle = (openTime = 1_700_000_000_000, symbol: LiveSymbol = 'BTCUSDT', close = '101'): MarketCandle => ({ symbol, interval: '1m', openTime, closeTime: openTime + 59_999, open: '100', high: '102', low: '99', close, volume: '5', closed: false })
const LiveChartFixture = LiveChart as FunctionComponent<{ provider: MarketDataProvider }>

describe('PB-033 live market-data contract', () => {
  it('maps Binance historical payload to neutral sorted and deduplicated candles', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      [2_000, '101', '103', '100', '102', '7', 2_999], [1_000, '100', '102', '99', '101', '5', 1_999], [2_000, '101', '104', '100', '103', '8', 2_999],
    ]), { status: 200 }))
    const provider = new BinanceMarketDataProvider(fetcher, () => { throw new Error('not used') })
    await expect(provider.getHistoricalCandles({ symbol: 'BTCUSDT', interval: '1m', limit: 500 })).resolves.toEqual([
      expect.objectContaining({ symbol: 'BTCUSDT', interval: '1m', openTime: 1_000, close: '101', closed: true }),
      expect.objectContaining({ openTime: 2_000, high: '104', close: '103', closed: true }),
    ])
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('symbol=BTCUSDT&interval=1m&limit=500'), expect.any(Object))
  })

  it('updates the last candle for a matching openTime and appends only a new bucket', () => {
    const first = candle(), updated = candle(first.openTime, 'BTCUSDT', '102'), next = candle(first.openTime + 60_000, 'BTCUSDT', '103')
    expect(mergeCandles([first], updated)).toEqual([updated])
    expect(mergeCandles([first], next)).toEqual([first, next])
  })

  it('reconnects with backoff and closes the active socket on cleanup', async () => {
    vi.useFakeTimers()
    const sockets: Array<{ close: ReturnType<typeof vi.fn>; onopen: ((event: Event) => void) | null; onmessage: ((event: MessageEvent) => void) | null; onerror: ((event: Event) => void) | null; onclose: ((event: CloseEvent) => void) | null }> = []
    const provider = new BinanceMarketDataProvider(vi.fn(), () => {
      const socket = { close: vi.fn(), onopen: null, onmessage: null, onerror: null, onclose: null }
      sockets.push(socket); return socket as never
    })
    const onStatus = vi.fn(), onReconnect = vi.fn(), stop = provider.subscribeCandles({ symbol: 'BTCUSDT', interval: '1m' }, { onCandle: vi.fn(), onStatus, onReconnect })
    sockets[0].onopen?.(new Event('open'))
    sockets[0].onclose?.(new CloseEvent('close'))
    await vi.advanceTimersByTimeAsync(1_000)
    expect(sockets).toHaveLength(2)
    sockets[1].onopen?.(new Event('open'))
    expect(onStatus).toHaveBeenLastCalledWith('LIVE')
    expect(onReconnect).toHaveBeenCalledTimes(1)
    stop()
    expect(sockets[1].close).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('cleans up the old subscription when the live symbol changes', async () => {
    const unsubscribe = vi.fn()
    const provider: MarketDataProvider = {
      getHistoricalCandles: vi.fn(async ({ symbol }) => [candle(1_700_000_000_000, symbol)]),
      subscribeCandles: vi.fn((_request, subscription: CandleSubscription) => { subscription.onStatus('LIVE'); return unsubscribe }),
    }
    render(createElement(LiveChartFixture, { provider }))
    await screen.findByText('BINANCE · LIVE')
    fireEvent.change(screen.getByLabelText('Symbol'), { target: { value: 'ETHUSDT' } })
    await waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(provider.subscribeCandles).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: 'ETHUSDT', interval: '1m' }), expect.any(Object)))
    fireEvent.change(screen.getByLabelText('Timeframe'), { target: { value: '5m' } })
    await waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(provider.subscribeCandles).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: 'ETHUSDT', interval: '5m' }), expect.any(Object)))
    expect(screen.getByRole('img', { name: /ETHUSDT live Binance candlesticks/i })).toBeInTheDocument()
  })

  it('renders semantic toolbar controls and keeps deferred tool groups disabled', async () => {
    const provider: MarketDataProvider = { getHistoricalCandles: vi.fn(async ({ symbol }) => [candle(1_700_000_000_000, symbol)]), subscribeCandles: vi.fn((_request, subscription) => { subscription.onStatus('LIVE'); return vi.fn() }) }
    render(createElement(LiveChartFixture, { provider }))
    await screen.findByText('BINANCE · LIVE')
    expect(screen.getByRole('button', { name: 'Cursor' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Crosshair' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lock All Drawings' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hide All Drawings' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove All Drawings' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Patterns tools' })).toBeDisabled()
  })
})
