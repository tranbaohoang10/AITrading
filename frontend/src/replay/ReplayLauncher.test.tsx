import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReplayLauncher, replayRange } from './ReplayLauncher'
import * as api from './api'
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), read: vi.fn() }))
it('maps leap days and months to exclusive UTC boundaries and rejects invalid dates', () => {
  expect(replayRange('DAY', '2024-02-29')).toEqual({ from: '2024-02-29T00:00:00Z', to: '2024-03-01T00:00:00Z' })
  expect(replayRange('MONTH', '2024-02')).toEqual({ from: '2024-02-01T00:00:00Z', to: '2024-03-01T00:00:00Z' })
  expect(replayRange('DAY', '2025-02-29')).toBeNull()
})
it('requires coverage, invalidates it on range edits and forwards the frozen identity', async () => {
  vi.mocked(api.read).mockResolvedValue({ status: 'PARTIAL', verifiedFromUtc: '2025-01-01T00:00:00Z', verifiedThroughUtc: '2025-01-01T23:00:00Z' })
  const launch = vi.fn()
  render(<ReplayLauncher account="test" provider="COINBASE" symbol="BTC-USD" timeframe="1h" onLaunch={launch} />)
  fireEvent.click(screen.getByRole('button', { name: 'Open Bar Replay' }))
  expect(screen.getByRole('button', { name: 'Start Replay' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Replay day'), { target: { value: '2025-01-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'Check available history' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start Replay' })).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Replay day'), { target: { value: '2025-01-02' } })
  expect(screen.getByRole('button', { name: 'Start Replay' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Replay day'), { target: { value: '2025-01-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'Check available history' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start Replay' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Start Replay' }))
  expect(launch).toHaveBeenCalledWith(expect.objectContaining({ provider: 'COINBASE', instrument: 'BTC-USD', from: '2025-01-01T00:00:00Z', to: '2025-01-02T00:00:00Z' }))
})
