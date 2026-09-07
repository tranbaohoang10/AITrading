import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { LiveChart } from './LiveChart'
import { DEFAULT_INSTRUMENTS, type CandleSubscription, type MarketCandle, type MarketDataProvider } from './liveMarket'

const chartRender = vi.hoisted(() => vi.fn())
vi.mock('./CandleChart', () => ({ CandleChart: (props: { page: { items: unknown[] } }) => {
  chartRender(props.page.items.length)
  return <div data-testid="persistent-chart">{props.page.items.length}</div>
} }))
afterEach(() => { vi.useRealTimers(); chartRender.mockClear() })

it('isolates the one-second clock from a 20k-bar chart and keeps its node on live updates', async () => {
  vi.useFakeTimers()
  const start = Date.UTC(2025, 0, 1)
  const candles: MarketCandle[] = Array.from({ length: 20_000 }, (_, i) => ({ symbol: 'BTC-USD', interval: '1m',
    openTime: start + i * 60_000, closeTime: start + (i + 1) * 60_000 - 1,
    open: '100', high: '102', low: '99', close: '101', volume: '1', closed: true }))
  let subscription!: CandleSubscription
  const history = vi.fn(async () => candles)
  const provider: MarketDataProvider = { listInstruments: async () => DEFAULT_INSTRUMENTS,
    getHistoricalCandles: history, subscribeCandles: (_, next) => { subscription = next; return () => {} } }
  render(<LiveChart provider={provider}/>)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  const node = screen.getByTestId('persistent-chart')
  expect(node).toHaveTextContent('20000')
  const before = chartRender.mock.calls.length
  await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
  expect(chartRender).toHaveBeenCalledTimes(before)
  expect(history).toHaveBeenCalledTimes(1)
  await act(async () => { subscription.onCandle({ ...candles.at(-1)!, close: '102', closed: false }) })
  expect(chartRender.mock.calls.length).toBeGreaterThan(before)
  expect(screen.getByTestId('persistent-chart')).toBe(node)
  expect(history).toHaveBeenCalledTimes(1)
})
