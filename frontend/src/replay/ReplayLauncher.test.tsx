import { fireEvent, render, screen } from '@testing-library/react'
import { ReplayLauncher } from './ReplayLauncher'

it('starts candle selection on the chart without calendar or coverage controls', () => {
  const selectStart = vi.fn(), cancel = vi.fn()
  render(<ReplayLauncher selecting={false} onSelectStart={selectStart} onCancel={cancel} />)

  fireEvent.click(screen.getByRole('button', { name: 'Open Bar Replay' }))
  expect(screen.getByText(/Choose the starting candle directly on the chart/)).toBeVisible()
  expect(screen.queryByLabelText(/Replay day|Replay month/)).toBeNull()
  expect(screen.queryByRole('button', { name: /Check available history/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Select start on chart' }))
  expect(selectStart).toHaveBeenCalledTimes(1)
})

it('shows an existing cut and lets the user choose again or cancel', () => {
  const selectStart = vi.fn(), cancel = vi.fn()
  render(<ReplayLauncher selecting selectedTime="2026-09-09T06:00:00.000Z" onSelectStart={selectStart} onCancel={cancel} />)

  fireEvent.click(screen.getByRole('button', { name: 'Open Bar Replay' }))
  expect(screen.getByText(/Selected:/)).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Choose another candle' }))
  expect(selectStart).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Open Bar Replay' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Replay selection' }))
  expect(cancel).toHaveBeenCalledTimes(1)
})
