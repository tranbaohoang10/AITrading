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
