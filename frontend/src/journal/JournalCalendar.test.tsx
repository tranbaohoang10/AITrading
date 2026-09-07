import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { JournalCalendar } from './JournalViews'
import type { Summary, Values } from './api'
const empty: Values = { closed: 0, open: 0, wins: 0, losses: 0, breakeven: 0, grossPnl: '0', fees: '0', netPnl: '0' }
it('uses purple activity independently of P&L and pads February to five weeks', () => {
  const report: Summary = { filter: { from: '2021-02-01', to: '2021-02-28', zone: 'UTC', currency: 'USD' }, totals: empty, days: Array.from({ length: 28 }, (_, n) => ({ date: `2021-02-${String(n + 1).padStart(2, '0')}`, values: n < 3 ? { ...empty, closed: 1, netPnl: n === 0 ? '100' : n === 1 ? '-100' : '0' } : empty })) }
  render(<JournalCalendar report={report} mode="month" onDay={() => {}} />)
  expect(screen.getByRole('button', { name: 'Open day 2021-02-01' })).toHaveAttribute('data-trading-activity', 'closed')
  expect(screen.getByRole('button', { name: 'Open day 2021-02-02' })).toHaveAttribute('data-trading-activity', 'closed')
  expect(screen.getByRole('button', { name: 'Open day 2021-02-03' })).toHaveAttribute('data-trading-activity', 'breakeven')
  expect(screen.getByRole('button', { name: 'Open day 2021-02-04' })).toHaveAttribute('data-trading-activity', 'none')
  expect(screen.getAllByText(/Weekly P&L:/)).toHaveLength(5)
})
