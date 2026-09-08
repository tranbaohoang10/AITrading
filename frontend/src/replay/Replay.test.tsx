import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReplayWorkspace } from './ReplayWorkspace'
import * as api from './api'
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), read: vi.fn(), write: vi.fn() }))
const account = '00000000-0000-4000-8000-000000000001'
const saved = { id: '00000000-0000-4000-8000-000000000002', provider: 'COINBASE', instrument: 'BTC-USD', timeframe: '1h', currency: 'USD', cursor: 0, version: 1, status: 'ACTIVE', initialBalance: 10000, balance: 10000, equity: 10000, realizedPnl: 0, openPnl: 0, simulation: true, metadata: { displaySymbol: 'BTC/USD', quantityIncrement: .01 }, candles: [{ time: '2025-01-01T00:00:00Z', open: 100, high: 105, low: 95, close: 100, volume: 1 }], trades: [] }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.read).mockImplementation(async (_, path) => path.endsWith('/capabilities') ? { items: [{ providerId: 'COINBASE', displayName: 'Coinbase', historicalReplaySupported: true, supportedTimeframes: ['1h'], configured: true }] } : path === '/replay' ? [{ id: saved.id, instrument: 'BTC-USD', provider: 'COINBASE' }] : saved)
  vi.mocked(api.write).mockResolvedValue(saved)
})
it('resumes a prefix, previews Long and Short locally, and confirms one backend command', async () => {
  render(<ReplayWorkspace account={account} onClose={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: /Resume COINBASE/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Long' }))
  fireEvent.change(screen.getByLabelText('Stop Loss'), { target: { value: '90' } })
  fireEvent.change(screen.getByLabelText('Take Profit'), { target: { value: '120' } })
  expect(api.write).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm simulation' }))
  await waitFor(() => expect(api.write).toHaveBeenCalledTimes(1))
  expect(vi.mocked(api.write).mock.calls[0][2]).toMatchObject({ expectedVersion: 1, action: 'CONFIRM', order: { side: 'LONG', sizingMode: 'RISK_PERCENT', size: '1', stop: '90', target: '120' } })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Short' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Short' }))
  expect(Number((screen.getByLabelText('Stop Loss') as HTMLInputElement).value)).toBeGreaterThan(100)
})
it('rejects a payload containing more candles than its revealed cursor', () => {
  expect(() => api.view({ ...saved, candles: [...saved.candles, { ...saved.candles[0], time: '2025-01-01T01:00:00Z' }] })).toThrow('Invalid replay response')
  for (const invalid of [null, { ...saved.candles[0], open: null }, { ...saved.candles[0], high: 90 }, { ...saved.candles[0], volume: -1 }]) {
    expect(() => api.view({ ...saved, candles: [invalid] })).toThrow('Invalid replay candle')
  }
})
it('merges only the next revealed window and rejects gaps or a different session', () => {
  const previous = api.view(saved)
  const candle = { ...saved.candles[0], time: '2025-01-01T01:00:00Z' }
  const state = { ...saved, cursor: 1, version: 2, candles: [candle] }
  const merged = api.view({ state, candleStart: 1 }, previous)
  expect(merged.candles).toHaveLength(2)
  expect(merged.candles[0]).toEqual(previous.candles[0])
  expect(api.view({ state: { ...state, candles: [], version: 3 }, candleStart: 2 }, merged).candles).toEqual(merged.candles)
  expect(() => api.view({ state, candleStart: 2 }, previous)).toThrow('Invalid replay window')
  expect(() => api.view({ state: { ...state, id: 'another' }, candleStart: 1 }, previous)).toThrow('Invalid replay window')
})
it('adds a study to the revealed chart without issuing a trading command', async () => {
  render(<ReplayWorkspace account={account} onClose={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: /Resume COINBASE/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Indicators' }))
  fireEvent.click(await screen.findByRole('button', { name: /^Simple Moving Average/ }))
  expect(api.write).not.toHaveBeenCalled()
  expect(screen.getByLabelText(/Hide SMA/)).toBeInTheDocument()
})
it('keeps an uncertain command frozen and retries its exact identity', async () => {
  const close = vi.fn(), blocked = vi.fn()
  vi.mocked(api.write).mockRejectedValueOnce(new Error('Network interrupted')).mockResolvedValue(saved)
  render(<ReplayWorkspace account={account} onClose={close} onCloseBlocked={blocked}/>)
  fireEvent.click(await screen.findByRole('button', { name: /Resume COINBASE/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Long' }))
  fireEvent.change(screen.getByLabelText('Position size'), { target: { value: '0.5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm simulation' }))
  const retry = await screen.findByRole('button', { name: 'Retry exact request' })
  expect(screen.getByRole('button', { name: 'Back to chart' })).toBeDisabled()
  expect(blocked).toHaveBeenLastCalledWith(true)
  const original = vi.mocked(api.write).mock.calls[0]
  fireEvent.click(retry)
  await waitFor(() => expect(api.write).toHaveBeenCalledTimes(2))
  expect(vi.mocked(api.write).mock.calls[1]).toEqual(original)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Back to chart' })).toBeEnabled())
  expect(close).not.toHaveBeenCalled()
})
it('explains a next-open balance rejection instead of silently returning to a draft', async () => {
  vi.mocked(api.read).mockImplementation(async (_, path) => path.endsWith('/capabilities') ? { items: [] } : path === '/replay' ? [{ id: saved.id, instrument: 'BTC-USD', provider: 'COINBASE' }] : { ...saved, trades: [{ id: 'cancelled', side: 'LONG', state: 'CANCELLED', exitReason: 'INSUFFICIENT_BALANCE' }] })
  render(<ReplayWorkspace account={account} onClose={() => {}}/>)
  fireEvent.click(await screen.findByRole('button', { name: /Resume COINBASE/ }))
  expect(await screen.findByText(/next open price and fees exceeded available balance/)).toBeInTheDocument()
})

it('position setup exposes percentage levels and verified quantity fallback without draft writes', async () => {
  render(<ReplayWorkspace account={account} onClose={() => {}} />)
  fireEvent.click(await screen.findByRole('button', { name: /Resume COINBASE/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Long' }))
  expect(screen.getByRole('complementary', { name: 'Position Setup' })).toBeVisible()
  expect(screen.getByText(/lot metadata unavailable/i)).toBeVisible()
  fireEvent.change(screen.getByLabelText('Stop Loss %'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('Take Profit %'), { target: { value: '6' } })
  expect(Number((screen.getByLabelText('Stop Loss') as HTMLInputElement).value)).toBe(97)
  expect(Number((screen.getByLabelText('Take Profit') as HTMLInputElement).value)).toBe(106)
  expect(api.write).not.toHaveBeenCalled()
})
