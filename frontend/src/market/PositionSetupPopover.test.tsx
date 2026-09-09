import { fireEvent, render, screen } from '@testing-library/react'
import { PositionSetupPopover, positionSetupValues } from './PositionSetupPopover'
import type { Instrument, MarketCandle } from './liveMarket'

const instrument: Instrument = { symbol: 'BTC-USD', displaySymbol: 'BTC/USD', name: 'Bitcoin / US Dollar', assetClass: 'CRYPTO', provider: 'COINBASE', priceIncrement: .01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] }
const candle: MarketCandle = { symbol: 'BTC-USD', interval: '1h', openTime: Date.parse('2026-09-09T06:00:00Z'), closeTime: Date.parse('2026-09-09T07:00:00Z'), open: '99', high: '102', low: '98', close: '100', volume: '5', closed: true }

it('calculates long and short setup values for account percent or quantity sizing', () => {
  expect(positionSetupValues({ side: 'LONG', entry: 100, stopPercent: 1, targetPercent: 2, capital: 10_000, sizingMode: 'ACCOUNT_PERCENT', size: 1 })).toEqual({ stop: 99, target: 102, quantity: 1, risk: 1, reward: 2, ratio: 2 })
  expect(positionSetupValues({ side: 'SHORT', entry: 100, stopPercent: 1, targetPercent: 2, capital: 10_000, sizingMode: 'LOT_QUANTITY', size: 2 })).toEqual({ stop: 101, target: 98, quantity: 2, risk: 2, reward: 4, ratio: 2 })
})

it('opens inline, previews the setup, and emits a chart drawing without opening Replay', () => {
  const apply = vi.fn()
  render(<PositionSetupPopover instrument={instrument} candle={candle} timeframe="1h" onApply={apply} />)

  fireEvent.click(screen.getByRole('button', { name: 'Open Position Setup' }))
  expect(screen.getByRole('dialog', { name: 'Position Setup' })).toBeVisible()
  expect(screen.getByLabelText('Position entry')).toHaveValue(100)
  expect(screen.getByLabelText('Default capital')).toHaveValue(10000)
  expect(screen.getByLabelText('Position Setup summary')).toHaveTextContent('99.00')
  expect(screen.getByLabelText('Position Setup summary')).toHaveTextContent('102.00')
  expect(screen.queryByText(/Start \/ resume Replay/)).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Short' }))
  fireEvent.change(screen.getByLabelText('Position sizing mode'), { target: { value: 'LOT_QUANTITY' } })
  fireEvent.change(screen.getByLabelText('Position size'), { target: { value: '2' } })
  expect(screen.getByLabelText('Position Setup summary')).toHaveTextContent('101.00')
  expect(screen.getByLabelText('Position Setup summary')).toHaveTextContent('98.00')
  fireEvent.click(screen.getByRole('button', { name: 'Show setup on chart' }))

  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ type: 'shortPosition', text: expect.stringContaining('2 qty'), points: [{ time: '2026-09-09T06:00:00.000Z', price: 100 }, { time: '2026-09-09T18:00:00.000Z', price: 101 }, { time: '2026-09-09T18:00:00.000Z', price: 98 }] }))
})
