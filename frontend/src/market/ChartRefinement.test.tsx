import { CandleChart } from './CandleChart'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChartClock } from '../components/ChartWorkspacePanels'
import { TimeframePopover } from './TimeframePopover'

it('timeframe exposes its downward caret and translucent hover state', () => {
  render(<TimeframePopover value="1h" eod={false} onChange={() => {}} />)
  const trigger = screen.getByRole('button', { name: 'Timeframe' })
  expect(trigger.className).toContain('hover:bg-slate-800/60')
  expect(trigger.querySelector('svg')).not.toBeNull()
  fireEvent.click(trigger)
  expect(trigger).toHaveAttribute('aria-expanded', 'true')
})

it('clock portals below the toolbar and returns focus after timezone selection and Escape', () => {
  const change = vi.fn()
  render(<ChartClock timezone="UTC" onChange={change} />)
  const trigger = screen.getByRole('button', { name: 'Chart clock' })
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({ left: 300, bottom: 45 } as DOMRect)
  fireEvent.click(trigger)
  const dialog = screen.getByRole('dialog', { name: 'Clock / timezone' })
  expect(dialog.parentElement).toBe(document.body)
  expect(parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(45)
  fireEvent.change(screen.getByLabelText('Clock timezone'), { target: { value: 'Asia/Ho_Chi_Minh' } })
  expect(change).toHaveBeenCalledWith('Asia/Ho_Chi_Minh')
  expect(trigger).toHaveFocus()
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(trigger)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(trigger).toHaveFocus()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('keeps both crosshair axis badges inside the SVG at the left and right edges', () => {
  render(<CandleChart page={{ dataset: { symbol: 'BTC-USD' }, items: [{ ordinal: 0, time: '2025-01-01T00:00:00Z', open: '100', high: '110', low: '90', close: '105', volume: '1' }] }} />)
  expect(screen.getByTestId('live-price-axis-badge')).toHaveTextContent('105')
  expect(screen.getByTestId('price-clock')).toHaveTextContent(/\d{2}:\d{2}:\d{2}/)
  const svg = screen.getByRole('img', { name: /candlesticks/ })
  for (const x of [13, 820]) {
    fireEvent.pointerMove(svg, { clientX: x, clientY: 60 })
    const price = screen.getByTestId('crosshair-price'), time = screen.getByTestId('crosshair-time')
    expect(price).toBeVisible(); expect(time).toBeVisible()
    const rect = time.querySelector('rect')!
    expect(Number(rect.getAttribute('x'))).toBeGreaterThanOrEqual(0)
    expect(Number(rect.getAttribute('x')) + Number(rect.getAttribute('width'))).toBeLessThanOrEqual(900)
  }
})

it('selects the Replay start candle and shades candles to its right', () => {
  const selectTime = vi.fn(), items = Array.from({ length: 3 }, (_, ordinal) => ({ ordinal, time: new Date(Date.parse('2026-09-09T00:00:00Z') + ordinal * 3_600_000).toISOString(), open: '100', high: '110', low: '90', close: '105', volume: '1' }))
  const view = render(<CandleChart page={{ dataset: { symbol: 'BTC-USD' }, items }} replaySelecting onSelectReplayTime={selectTime} />)
  const chart = screen.getByRole('img', { name: /candlesticks/ })
  vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, top: 0, left: 0, bottom: 420, right: 900, width: 900, height: 420, toJSON: () => ({}) })
  expect(chart.getAttribute('class')).toContain('cursor-col-resize')
  fireEvent.pointerDown(chart, { button: 0, pointerId: 1, clientX: 417, clientY: 120 })
  expect(selectTime).toHaveBeenCalledWith(items[1].time)

  view.rerender(<CandleChart page={{ dataset: { symbol: 'BTC-USD' }, items }} replayCutTime={items[1].time} />)
  expect(screen.getByTestId('replay-cut-overlay')).toHaveTextContent('Replay start')
})

it('uses verified Exchange timezone metadata and disables unknown Exchange choices', () => {
  const view = render(<ChartClock timezone="UTC" onChange={() => {}} />)
  fireEvent.click(screen.getByLabelText('Chart clock'))
  expect(screen.getByRole('option', { name: 'Exchange' })).toBeDisabled()
  view.rerender(<ChartClock timezone="EXCHANGE" exchangeTimezone="Europe/Berlin" onChange={() => {}} />)
  expect(screen.getByRole('option', { name: 'Exchange' })).not.toBeDisabled()
  expect(screen.getByLabelText('Chart clock')).not.toHaveTextContent('Europe/Berlin')
})
