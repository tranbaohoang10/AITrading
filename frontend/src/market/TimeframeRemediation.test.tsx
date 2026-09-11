import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LiveChart } from './LiveChart'
import { TimeframePopover } from './TimeframePopover'
import type { CandleSubscription, MarketCandle, MarketDataProvider } from './liveMarket'
import type { Timeframe } from './chartMath'

it('portals the menu outside overflow and supports keyboard return and EOD explanation', () => {
  const change = vi.fn()
  const view = render(<div style={{ overflow: 'hidden', height: 20 }}><TimeframePopover value="1m" eod={false} onChange={change} /></div>)
  const trigger = screen.getByRole('button', { name: 'Timeframe' })
  fireEvent.click(trigger)
  const menu = screen.getByRole('menu', { name: 'Timeframe choices' })
  expect(menu.parentElement).toBe(document.body)
  fireEvent.keyDown(menu, { key: 'ArrowDown' }); expect(screen.getByRole('menuitemradio', { name: '5m' })).toHaveFocus()
  fireEvent.click(screen.getByRole('menuitemradio', { name: '5m' })); expect(change).toHaveBeenCalledWith('5m'); expect(trigger).toHaveFocus()
  fireEvent.click(trigger); fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' }); expect(trigger).toHaveFocus(); expect(screen.queryByRole('menu')).toBeNull()
  view.rerender(<TimeframePopover value="1d" eod onChange={change} />)
  fireEvent.click(screen.getByRole('button', { name: 'Timeframe' }))
  expect(screen.getByRole('menuitemradio', { name: '1m' })).toBeDisabled()
  expect(screen.getByRole('menuitemradio', { name: '1D' })).toBeEnabled()
  expect(screen.getByText(/ECB reference data is available in 1D only/)).toBeVisible()
})
it('seeds live OHLC and ignores cancelled interval history and callbacks during rapid switching', async () => {
  const candle = (interval: Timeframe): MarketCandle => ({ symbol: 'BTC-USD', interval, openTime: Date.now() - 30_000, closeTime: Date.now() + 30_000, open: '100', high: '110', low: '90', close: '101', volume: '5', closed: false })
  const pending: { interval: Timeframe; resolve: (rows: MarketCandle[]) => void; signal?: AbortSignal }[] = []
  const subscriptions: { callback: CandleSubscription; stop: ReturnType<typeof vi.fn>; interval: Timeframe }[] = []
  const provider: MarketDataProvider = {
    getHistoricalCandles: vi.fn((request): Promise<MarketCandle[]> => new Promise<MarketCandle[]>(resolve => pending.push({ ...request, resolve }))),
    subscribeCandles: vi.fn((request, callback) => { const stop = vi.fn(); subscriptions.push({ callback, stop, interval: request.interval }); callback.onStatus('LIVE'); return stop }),
  }
  const view = render(<LiveChart provider={provider} />)
  await waitFor(() => expect(pending).toHaveLength(1))
  await act(async () => pending[0].resolve([candle('1m')]))
  expect(vi.mocked(provider.subscribeCandles).mock.calls[0][0].seed).toBeUndefined()
  expect(screen.getByTestId('realtime-status')).toHaveTextContent('Waiting')
  expect(screen.getByTestId('realtime-status')).toHaveAttribute('title', expect.stringContaining('First tick —. Last tick —. Candle —.'))
  await act(async () => subscriptions[0].callback.onStatus('CONNECTED'))
  expect(screen.getByTestId('realtime-status')).toHaveTextContent('Connected')
  expect(screen.getByTestId('realtime-status')).toHaveAttribute('title', expect.stringContaining('Cached history is not treated as a live tick.'))
  await act(async () => subscriptions[0].callback.onStatus('MARKET_CLOSED'))
  expect(screen.getByTestId('realtime-status')).toHaveTextContent('Market closed')
  expect(screen.getByTestId('realtime-status')).toHaveAttribute('title', expect.stringContaining('latest historical or cached candle'))
  await act(async () => subscriptions[0].callback.onCandle(candle('1m')))
  expect(screen.getByTestId('realtime-status')).toHaveTextContent('Live')
  expect(screen.getByTestId('realtime-status')).toHaveAttribute('aria-label', expect.stringContaining('Last tick'))
  for (const interval of ['5m', '1h', '1m']) { fireEvent.click(screen.getByRole('button', { name: 'Timeframe' })); fireEvent.click(screen.getByRole('menuitemradio', { name: interval })); await waitFor(() => expect(screen.getByRole('button', { name: 'Timeframe' })).toHaveTextContent(interval)) }
  expect(subscriptions[0].stop).toHaveBeenCalledTimes(1)
  expect(pending[1].signal?.aborted).toBe(true); expect(pending[2].signal?.aborted).toBe(true)
  await act(async () => { pending[1].resolve([candle('5m')]); pending[2].resolve([candle('1h')]) })
  expect(subscriptions).toHaveLength(4); expect(subscriptions.at(-1)?.interval).toBe('1m')
  expect(subscriptions.slice(0, 3).every(subscription => subscription.stop.mock.calls.length === 1)).toBe(true)
  await act(async () => subscriptions.at(-1)!.callback.onCandle({ ...candle('1m'), partial: true }))
  expect(screen.getByTestId('realtime-status')).toHaveAttribute('title', expect.stringContaining('(partial)'))
  await act(async () => subscriptions[0].callback.onStatus('DISCONNECTED'))
  expect(screen.queryByText('Disconnected')).toBeNull()
  view.unmount(); expect(subscriptions.at(-1)?.stop).toHaveBeenCalledTimes(1)
})

it('still fetches closed history when a live candle arrives before the historical request starts', async () => {
  const now = Date.now(), live: MarketCandle = { symbol: 'BTC-USD', interval: '1m', openTime: now - 30_000, closeTime: now + 30_000, open: '101', high: '102', low: '100', close: '101.5', volume: '0', closed: false, partial: true }
  const closed: MarketCandle = { ...live, openTime: now - 90_000, closeTime: now - 30_001, close: '101', closed: true, partial: false }
  const provider: MarketDataProvider = {
    getHistoricalCandles: vi.fn(async () => [closed]),
    subscribeCandles: vi.fn((_request, callback) => { callback.onCandle(live); callback.onStatus('LIVE'); return vi.fn() }),
  }
  const view = render(<LiveChart provider={provider} />)
  await waitFor(() => expect(provider.getHistoricalCandles).toHaveBeenCalledTimes(1))
  expect(vi.mocked(provider.subscribeCandles).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(provider.getHistoricalCandles).mock.invocationCallOrder[0])
  view.unmount()
})
