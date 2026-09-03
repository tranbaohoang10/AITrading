import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BacktestProvider } from './BacktestProvider'
import { BacktestWorkspace } from './BacktestWorkspace'
import { ApiError, currentUser } from '../auth/api'
import { AuthContext } from '../auth/AuthContext'
import * as api from './api'
import * as strategy from '../strategy/api'
import * as market from '../market/api'
import { fixture } from './fixtures'

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), listJobs: vi.fn(), getJob: vi.fn(), getResult: vi.fn(), getCandles: vi.fn(), capabilities: vi.fn(), createJob: vi.fn(), retryJob: vi.fn(), cancelJob: vi.fn(), deleteJob: vi.fn() }))
vi.mock('../strategy/api', async original => ({ ...await original<typeof import('../strategy/api')>(), listStrategies: vi.fn(), history: vi.fn(), getRevision: vi.fn() }))
vi.mock('../market/api', async original => ({ ...await original<typeof import('../market/api')>(), listDatasets: vi.fn() }))
vi.mock('../auth/api', async original => ({ ...await original<typeof import('../auth/api')>(), currentUser: vi.fn() }))
const sample = fixture(), second = fixture('loss', 2)
const brief: strategy.Brief = { id: sample.job.strategyId, title: sample.job.strategyTitle, revision: 2, status: 'VALIDATED', symbol: 'TEST_USD', timeframe: '1h', createdAt: sample.job.createdAt }
const saved: strategy.Revision = { ...brief, strategyId: brief.id, draftText: sample.result.runCard.canonicalDsl, canonicalJson: sample.result.runCard.canonicalDsl, hash: sample.job.dslHash, schemaVersion: '1.0.0', validatorVersion: '1.0.0', minimumBars: 1 }
const dataset: market.Dataset = { id: sample.job.datasetId, name: sample.job.datasetName, symbol: 'TEST_USD', timeframe: '1h', timezone: 'UTC', sourceKind: 'SYNTHETIC', sourceLabel: 'Test fixture', rawHash: 'a'.repeat(64), dataHash: sample.job.dataHash, formatVersion: 'ohlcv-v1', candleCount: 3, gapCount: 0, firstTime: sample.page.items[0].time, lastTime: sample.page.items[2].time, createdAt: sample.job.createdAt }
function App({ identity = 'a', trades = false }: { identity?: string; trades?: boolean }) { return <BacktestProvider key={identity}><BacktestWorkspace tradesOnly={trades} /></BacktestProvider> }
async function selectJob(id = sample.job.id) { await screen.findByRole('option', { name: /SUCCEEDED/ }); await act(async () => { fireEvent.change(screen.getByLabelText('Backtest job'), { target: { value: id } }) }) }
async function inputs() {
  await screen.findByRole('option', { name: sample.job.strategyTitle })
  fireEvent.change(screen.getByLabelText('Backtest strategy'), { target: { value: brief.id } })
  await screen.findByRole('option', { name: 'r2 · TEST_USD / 1h' })
  fireEvent.change(screen.getByLabelText('Backtest revision'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Backtest dataset'), { target: { value: dataset.id } })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start saved backtest' })).toBeEnabled())
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.listJobs).mockResolvedValue({ items: [sample.job], nextCursor: null })
  vi.mocked(api.getJob).mockImplementation(async id => id === second.job.id ? second.job : sample.job)
  vi.mocked(api.getResult).mockImplementation(async job => job.id === second.job.id ? second.result : sample.result)
  vi.mocked(api.getCandles).mockImplementation(async job => job.id === second.job.id ? second.page : sample.page)
  vi.mocked(api.capabilities).mockResolvedValue(true)
  vi.mocked(api.createJob).mockResolvedValue(sample.job); vi.mocked(api.retryJob).mockResolvedValue(sample.job)
  vi.mocked(api.cancelJob).mockResolvedValue({ ...sample.job, state: 'CANCELLED', resultHash: null })
  vi.mocked(api.deleteJob).mockResolvedValue(undefined)
  vi.mocked(strategy.listStrategies).mockResolvedValue({ items: [brief], nextCursor: null })
  vi.mocked(strategy.history).mockResolvedValue({ items: [brief], nextBefore: null })
  vi.mocked(strategy.getRevision).mockResolvedValue(saved)
  vi.mocked(market.listDatasets).mockResolvedValue({ items: [dataset], nextCursor: null })
})
it('requires explicit saved input choices and start; actual metrics/chart/trades have no demo fallback', async () => {
  render(<App />); await inputs()
  expect(api.createJob).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Start saved backtest' }))
  await screen.findByLabelText('Actual backtest metrics')
  expect(api.createJob).toHaveBeenCalledTimes(1)
  expect(vi.mocked(api.createJob).mock.calls[0][0]).toMatchObject({ strategyId: brief.id, revision: 2, datasetId: dataset.id })
  expect(within(screen.getByLabelText('Actual backtest metrics')).getByText('final Equity').nextElementSibling).toHaveTextContent(/^1100$/)
  expect(await screen.findByRole('img', { name: /frozen backtest/ })).toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Result bar index' }), { key: 'End' })
  expect(screen.getByRole('slider', { name: 'Result bar index' })).toHaveValue('2')
  expect(screen.getByLabelText('Exact selected result bar')).toHaveTextContent('2024-01-01T03:00:00Z')
  fireEvent.keyDown(screen.getByRole('slider', { name: 'Result bar index' }), { key: 'ArrowRight' })
  expect(screen.getByRole('slider', { name: 'Result bar index' })).toHaveValue('2')
  expect(screen.queryByText(/mock presentation/)).not.toBeInTheDocument()
  expect(document.querySelector('script')).toBeNull()
})
it('retains one uncertain UUID and input choices across repeated click and same-intent retry', async () => {
  vi.mocked(api.createJob).mockRejectedValueOnce(new Error('interrupted'))
  render(<App />); await inputs()
  fireEvent.click(screen.getByRole('button', { name: 'Start saved backtest' })); fireEvent.click(screen.getByRole('button', { name: 'Start saved backtest' }))
  await screen.findByRole('button', { name: 'Retry same job request' })
  expect(api.createJob).toHaveBeenCalledTimes(1)
  const original = vi.mocked(api.createJob).mock.calls[0][0]
  expect(screen.getByLabelText('Backtest strategy')).toBeDisabled(); expect(screen.getByLabelText('Backtest dataset')).toHaveValue(dataset.id)
  fireEvent.click(screen.getByRole('button', { name: 'Retry same job request' }))
  await screen.findByLabelText('Actual backtest metrics')
  expect(api.createJob).toHaveBeenLastCalledWith(original, undefined)
})
it('keeps input selection editable after a definite rejection and disables unavailable worker', async () => {
  vi.mocked(api.createJob).mockRejectedValueOnce(new ApiError(422))
  render(<App />); await inputs(); fireEvent.click(screen.getByRole('button', { name: 'Start saved backtest' }))
  await screen.findByRole('alert'); expect(screen.getByLabelText('Backtest dataset')).not.toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Retry same job request' })).not.toBeInTheDocument()
  vi.mocked(api.capabilities).mockResolvedValue(false); fireEvent.click(screen.getByRole('button', { name: 'Refresh jobs and inputs' }))
  await screen.findByText('Python worker is not configured on this server.')
  expect(screen.getByRole('button', { name: 'Start saved backtest' })).toBeDisabled()
})
it('retains a previously uncertain intent even when its retry is rate-limited', async () => {
  vi.mocked(api.createJob).mockRejectedValueOnce(new Error('response lost')).mockRejectedValueOnce(new ApiError(429))
  render(<App />); await inputs(); fireEvent.click(screen.getByRole('button', { name: 'Start saved backtest' }))
  await screen.findByRole('button', { name: 'Retry same job request' })
  const original = vi.mocked(api.createJob).mock.calls[0][0]
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry same job request' })) })
  expect(screen.getByLabelText('Backtest strategy')).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Retry same job request' })).toBeEnabled()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry same job request' })) })
  expect(api.createJob).toHaveBeenLastCalledWith(original, undefined)
  expect(screen.getByLabelText('Actual backtest metrics')).toBeInTheDocument()
})
it('ignores late A results after selecting B and clears A immediately', async () => {
  vi.mocked(api.listJobs).mockResolvedValue({ items: [sample.job, second.job], nextCursor: null })
  let resolve!: (result: api.Result) => void
  vi.mocked(api.getResult).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  render(<App />); await waitFor(() => expect(screen.getByLabelText('Backtest job').querySelectorAll('option')).toHaveLength(3))
  fireEvent.change(screen.getByLabelText('Backtest job'), { target: { value: sample.job.id } })
  await waitFor(() => expect(api.getResult).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByLabelText('Backtest job'), { target: { value: second.job.id } })
  await screen.findByLabelText('Actual backtest metrics')
  await act(async () => resolve(sample.result))
  expect(within(screen.getByLabelText('Actual backtest metrics')).getByText('net Profit').nextElementSibling).toHaveTextContent(/^-100$/)
  expect(screen.getByText(`Job ${second.job.id}`)).toBeInTheDocument()
})
it('ignores stale candle windows and all pending data after identity remount', async () => {
  let resolve!: (page: api.FrozenPage) => void
  vi.mocked(api.getCandles).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const view = render(<App />); await selectJob()
  await waitFor(() => expect(api.getCandles).toHaveBeenCalled())
  await act(async () => { view.rerender(<App identity="b" />) })
  await act(async () => resolve(sample.page))
  expect(screen.queryByLabelText('Actual backtest metrics')).not.toBeInTheDocument()
  expect(screen.queryByRole('img', { name: /frozen backtest/ })).not.toBeInTheDocument()
})
it('never attaches late A candles beneath the selected B result', async () => {
  vi.mocked(api.listJobs).mockResolvedValue({ items: [sample.job, second.job], nextCursor: null })
  let resolve!: (page: api.FrozenPage) => void
  vi.mocked(api.getCandles).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  render(<App />); await waitFor(() => expect(screen.getByLabelText('Backtest job').querySelectorAll('option')).toHaveLength(3))
  await act(async () => { fireEvent.change(screen.getByLabelText('Backtest job'), { target: { value: sample.job.id } }) })
  await act(async () => { fireEvent.change(screen.getByLabelText('Backtest job'), { target: { value: second.job.id } }) })
  await screen.findByRole('img', { name: /frozen backtest/ })
  await act(async () => resolve(sample.page))
  const frozenChart = screen.getByRole('img', { name: /frozen backtest/ })
  expect(frozenChart).toHaveTextContent('O 90')
  expect(frozenChart).not.toHaveTextContent('O 110')
})
it('clears an authenticated tab when its shared server session switches accounts', async () => {
  const clear = vi.fn(), a = { id: 'account-a', email: 'a@example.test', displayName: 'A' }
  vi.mocked(currentUser).mockResolvedValue(a)
  render(<AuthContext.Provider value={{ user: a, clear, update: vi.fn() }}><App /></AuthContext.Provider>)
  await selectJob(); await screen.findByLabelText('Actual backtest metrics')
  vi.mocked(currentUser).mockResolvedValue({ ...a, id: 'account-b' })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refresh selected job' })) })
  expect(clear).toHaveBeenCalled()
  expect(screen.queryByLabelText('Actual backtest metrics')).not.toBeInTheDocument()
  expect(screen.queryByRole('img', { name: /frozen backtest/ })).not.toBeInTheDocument()
})
it('requires confirmation before deletion and never shows stale result after it', async () => {
  render(<App />); await selectJob(); await screen.findByLabelText('Actual backtest metrics')
  fireEvent.click(screen.getByRole('button', { name: 'Delete job…' })); fireEvent.click(screen.getByRole('button', { name: 'Keep job' }))
  expect(api.deleteJob).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Delete job…' })); await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' })) })
  await waitFor(() => expect(screen.queryByLabelText('Actual backtest metrics')).not.toBeInTheDocument())
  expect(api.deleteJob).toHaveBeenCalledWith(sample.job, undefined)
})
it('cancels active jobs and explicitly retries the failed snapshot with a new intent', async () => {
  const queued: api.Job = { ...sample.job, state: 'QUEUED', resultHash: null, finishedAt: null }
  vi.mocked(api.getJob).mockResolvedValueOnce(queued).mockResolvedValueOnce({ ...queued, state: 'CANCELLED', finishedAt: sample.job.finishedAt })
  render(<App />); await selectJob(); await screen.findByRole('button', { name: 'Cancel job…' })
  expect(screen.queryByLabelText('Actual backtest metrics')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel job…' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm cancel' }))
  await screen.findByRole('button', { name: 'Retry frozen snapshot' }); fireEvent.click(screen.getByRole('button', { name: 'Retry frozen snapshot' }))
  await screen.findByLabelText('Actual backtest metrics')
  expect(api.retryJob).toHaveBeenCalledTimes(1); expect(vi.mocked(api.retryJob).mock.calls[0][0].id).toBe(queued.id)
  expect(vi.mocked(api.retryJob).mock.calls[0][1]).not.toBe(queued.requestId)
})
it.each(['zero', 'loss', 'open', 'negative', 'protective'] as const)('renders actual %s boundary result without fabricated profitability or exit times', async name => {
  const value = fixture(name)
  vi.mocked(api.getJob).mockResolvedValue(value.job); vi.mocked(api.getResult).mockResolvedValue(value.result); vi.mocked(api.getCandles).mockResolvedValue(value.page)
  render(<App />); await selectJob(); await screen.findByLabelText('Actual backtest metrics')
  expect(within(screen.getByLabelText('Actual backtest metrics')).getAllByText(String(value.result.metrics.netProfit)).length).toBeGreaterThan(0)
  if (name === 'zero') expect(screen.getByText(/No closed trades in this run/)).toBeInTheDocument()
  if (name === 'open') expect(screen.getByLabelText('Open position')).toHaveTextContent('100')
  if (name === 'protective') expect(screen.getByText(/Exact exit time unknown/)).toHaveTextContent('2024-01-01T02:00:00Z → 2024-01-01T03:00:00Z')
})
it('exports only the selected actual JSON under a static filename after explicit action', async () => {
  const create = vi.fn().mockReturnValue('blob:synthetic'), revoke = vi.fn(), click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create }); Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke })
  render(<App />); await selectJob(); await screen.findByLabelText('Actual backtest metrics')
  expect(create).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole('button', { name: 'Export result JSON' }))
  expect(create).toHaveBeenCalledTimes(1); expect(create.mock.calls[0][0].type).toBe('application/json')
  const exported = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsText(create.mock.calls[0][0]) })
  expect(JSON.parse(exported)).toEqual({ job: sample.job, result: sample.result.raw })
  expect(exported).not.toMatch(/password|csrf|credentialVersion|apiKey/i)
  expect(click.mock.instances[0]).toHaveAttribute('download', 'backtest-result.json'); click.mockRestore()
})
it('handles private read failures without result fallback and rejects mismatched setup', async () => {
  vi.mocked(market.listDatasets).mockResolvedValue({ items: [{ ...dataset, symbol: 'OTHER' }], nextCursor: null })
  vi.mocked(api.getJob).mockRejectedValue(new ApiError(401))
  render(<App />); await selectJob(); await screen.findByRole('alert')
  expect(screen.queryByLabelText('Actual backtest metrics')).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Backtest dataset'), { target: { value: dataset.id } })
  expect(screen.getByRole('button', { name: 'Start saved backtest' })).toBeDisabled()
  expect(api.createJob).not.toHaveBeenCalled()
})

it('PB-027 retains the acknowledged job intent when the subsequent identity check is rate-limited', async () => {
  const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.test', displayName: 'A' }
  vi.mocked(currentUser).mockResolvedValue(user)
  render(<AuthContext.Provider value={{ user, clear: vi.fn(), update: vi.fn() }}><App /></AuthContext.Provider>)
  await inputs()
  vi.mocked(currentUser).mockRejectedValueOnce(new ApiError(429))
  fireEvent.click(screen.getByRole('button', { name: 'Start saved backtest' }))
  const retry = await screen.findByRole('button', { name: 'Retry same job request' })
  const original = vi.mocked(api.createJob).mock.calls[0][0]
  expect(api.createJob).toHaveBeenLastCalledWith(original, user.id)
  fireEvent.click(retry)
  await waitFor(() => expect(api.createJob).toHaveBeenCalledTimes(2))
  expect(api.createJob).toHaveBeenLastCalledWith(original, user.id)
})
