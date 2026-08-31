import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { JournalProvider } from './JournalProvider'
import { JournalWorkspace } from './JournalWorkspace'
import { AuthContext } from '../auth/AuthContext'
import { ApiError, currentUser } from '../auth/api'
import * as api from './api'
import * as market from '../market/api'
import { fixture, key, summaryFixture } from './fixtures'

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), list: vi.fn(), summary: vi.fn(), get: vi.fn(), save: vi.fn(), remove: vi.fn() }))
vi.mock('../market/api', async original => ({ ...await original<typeof import('../market/api')>(), listDatasets: vi.fn(), getDataset: vi.fn(), candles: vi.fn() }))
vi.mock('../auth/api', async original => ({ ...await original<typeof import('../auth/api')>(), currentUser: vi.fn() }))
const first = fixture(), second = { ...fixture(2), netPnl: '-1', data: { ...fixture(2).data, entryReason: 'Second reason' } }
const dataset: market.Dataset = { id: key(50), name: 'Linked real fixture', symbol: 'TEST_USD', timeframe: '1h', timezone: 'UTC', sourceKind: 'SYNTHETIC', sourceLabel: 'Test only', rawHash: 'a'.repeat(64), dataHash: 'b'.repeat(64), formatVersion: 'ohlcv-v1', candleCount: 3, gapCount: 1, firstTime: '2024-01-01T00:00:00Z', lastTime: '2024-01-01T03:00:00Z', createdAt: first.createdAt }
const candles: market.Candle[] = [0, 1, 3].map((hour, ordinal) => ({ ordinal, time: `2024-01-01T0${hour}:00:00Z`, open: '100', high: '110', low: '90', close: '105', volume: '1' }))
function App({ identity = 'a', visible = true }: { identity?: string; visible?: boolean }) { return <JournalProvider key={identity}>{visible && <JournalWorkspace />}</JournalProvider> }
async function select(id = first.id) { const button = await screen.findByRole('button', { name: `Open journal TEST_USD ${id}` });fireEvent.click(button);await screen.findByText(/Edit manual entry/);await waitFor(() => expect(screen.getByLabelText('Entry reason')).not.toBeDisabled()) }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.list).mockImplementation(async filter => ({ filter, items: [first, second], nextCursor: null }))
  vi.mocked(api.summary).mockImplementation(async filter => summaryFixture(filter, true))
  vi.mocked(api.get).mockImplementation(async id => id === second.id ? second : first)
  vi.mocked(api.save).mockImplementation(async (id, input) => ({ requestId: input.requestId, appliedVersion: input.expectedVersion + 1, entry: { ...first, id: id ?? first.id, version: input.expectedVersion + 1, data: input.entry } }))
  vi.mocked(api.remove).mockResolvedValue(undefined)
  vi.mocked(market.listDatasets).mockResolvedValue({ items: [dataset], nextCursor: null })
  vi.mocked(market.getDataset).mockResolvedValue(dataset)
  vi.mocked(market.candles).mockImplementation(async (_dataset, limit, start = 0) => ({ dataset, start, total: 3, items: candles.slice(start, start + limit) }))
})
it('renders exact real totals, inert reasons and explicit saved/no-chart distinction', async () => {
  render(<App />);await select()
  expect(screen.getByLabelText('Entry reason')).toHaveValue('<script>inert reason</script>');expect(document.querySelector('script')).toBeNull()
  expect(screen.getByLabelText('Saved journal P&L')).toHaveTextContent('0.027')
  expect(within(screen.getByLabelText('Realized journal totals')).getByText('Net P&L').nextElementSibling).toHaveTextContent('0.027 USD')
  expect(screen.getByText('No chart linked to this saved entry.')).toBeInTheDocument()
  expect(api.save).not.toHaveBeenCalled()
})
it('guards dirty new/selection/refresh, preserves draft on cancellation and across view changes', async () => {
  const view = render(<App />);await select();fireEvent.change(screen.getByLabelText('Journal notes'), { target: { value: 'Unsaved unique note' } })
  fireEvent.click(screen.getByRole('button', { name: `Open journal TEST_USD ${second.id}` }));expect(api.get).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Keep journal draft' }));expect(screen.getByLabelText('Journal notes')).toHaveValue('Unsaved unique note')
  await act(async () => { view.rerender(<App visible={false} />) });await act(async () => { view.rerender(<App />) });expect(screen.getByLabelText('Journal notes')).toHaveValue('Unsaved unique note')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh journal' }));fireEvent.click(screen.getByRole('button', { name: 'Keep journal draft' }))
  fireEvent.click(screen.getByRole('button', { name: 'New journal entry' }));fireEvent.click(screen.getByRole('button', { name: 'Confirm journal action' }))
  expect(screen.getByLabelText('Journal notes')).toHaveValue('');expect(screen.getByText('New manual entry')).toBeInTheDocument()
})
it('freezes exact uncertain UUID across rate-limited retry and prevents repeated clicks', async () => {
  vi.mocked(api.save).mockRejectedValueOnce(new Error('response lost')).mockRejectedValueOnce(new ApiError(429))
  render(<App />);await select();fireEvent.change(screen.getByLabelText('Journal notes'), { target: { value: 'New intent' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Manual journal entry' }));fireEvent.submit(screen.getByRole('form', { name: 'Manual journal entry' }))
  await screen.findByRole('button', { name: 'Retry same journal save' });expect(api.save).toHaveBeenCalledTimes(1)
  const intent = vi.mocked(api.save).mock.calls[0][1];expect(screen.getByLabelText('Journal notes')).toBeDisabled()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry same journal save' })) });expect(screen.getByLabelText('Journal notes')).toBeDisabled()
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry same journal save' })) });expect(api.save).toHaveBeenLastCalledWith(first.id, intent, '')
  expect(screen.getByLabelText('Journal notes')).toHaveValue('New intent');expect(screen.getByLabelText('Journal notes')).not.toBeDisabled()
  expect(screen.getByText('Saved request as v2. Showing current v2.')).toBeInTheDocument()
})
it.each([400, 409])('keeps draft editable after first definite %s and never silently refreshes it', async status => {
  vi.mocked(api.save).mockRejectedValueOnce(new ApiError(status));render(<App />);await select()
  fireEvent.change(screen.getByLabelText('Journal notes'), { target: { value: 'Keep this note' } });fireEvent.submit(screen.getByRole('form', { name: 'Manual journal entry' }))
  await screen.findByRole('alert');expect(screen.getByLabelText('Journal notes')).toHaveValue('Keep this note');expect(screen.getByLabelText('Journal notes')).not.toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Retry same journal save' })).not.toBeInTheDocument();expect(api.get).toHaveBeenCalledTimes(1)
})
it('ignores late selection and range responses without mixing entry data', async () => {
  let resolve!: (entry: api.Entry) => void;vi.mocked(api.get).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  render(<App />);fireEvent.click(await screen.findByRole('button', { name: `Open journal TEST_USD ${first.id}` }))
  // Context selection can change while a read is pending; the UI disables clicks
  // until it finishes, and identity remount must also reject the old response.
  await act(async () => resolve(first));await screen.findByText(/Edit manual entry/)
  let late!: (summary: api.Summary) => void
  const previous = vi.mocked(api.summary).mock.calls[0][0]
  vi.mocked(api.summary).mockImplementationOnce(() => new Promise(r => { late = r }))
  fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));const oldFilter = vi.mocked(api.summary).mock.calls.at(-1)![0]
  fireEvent.click(screen.getByRole('button', { name: 'Next month' }))
  await waitFor(() => expect(screen.getByText(`Report: ${previous.from} → ${previous.to} · UTC · USD`)).toBeInTheDocument())
  await act(async () => late(summaryFixture(oldFilter, true)))
  expect(screen.getByText(`Report: ${previous.from} → ${previous.to} · UTC · USD`)).toBeInTheDocument()
})
it('drops pending reads when identity changes and checks server user before displaying data', async () => {
  let resolve!: (entry: api.Entry) => void;vi.mocked(api.get).mockImplementationOnce(() => new Promise(r => { resolve = r }))
  const view = render(<App />);fireEvent.click(await screen.findByRole('button', { name: `Open journal TEST_USD ${first.id}` }))
  view.rerender(<App identity="b" />);await act(async () => resolve(first));expect(screen.getByLabelText('Journal notes')).toHaveValue('')
  view.unmount()
  const clear = vi.fn(), user = { id: 'a', email: 'a@example.test', displayName: 'A' };vi.mocked(currentUser).mockResolvedValue(user)
  render(<AuthContext.Provider value={{ user, clear, update: vi.fn() }}><App /></AuthContext.Provider>);await screen.findByRole('button', { name: `Open journal TEST_USD ${first.id}` })
  vi.mocked(currentUser).mockResolvedValue({ ...user, id: 'b' });fireEvent.click(screen.getByRole('button', { name: `Open journal TEST_USD ${first.id}` }))
  await waitFor(() => expect(clear).toHaveBeenCalled());expect(screen.queryByLabelText('Saved journal P&L')).not.toBeInTheDocument()
})
it('centers on actual gapped candles, preserves saved context through edits and handles deleted source', async () => {
  const linked = { ...first, data: { ...first.data, entryTime: '2024-01-01T03:00:00Z', datasetId: dataset.id } };vi.mocked(api.get).mockResolvedValue(linked)
  render(<App />);await select();await screen.findByRole('img', { name: /imported candlesticks/ })
  expect(market.getDataset).toHaveBeenCalledWith(dataset.id, undefined);expect(market.candles).toHaveBeenCalledWith(dataset, 500, 0, undefined);expect(market.candles).toHaveBeenCalledWith(dataset, 100, 0, undefined)
  fireEvent.change(screen.getByLabelText('Symbol'), { target: { value: 'OTHER' } });expect(screen.getByText(/Chart and P&L show the saved version/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh journal' }));fireEvent.click(screen.getByRole('button', { name: 'Confirm journal action' }))
  vi.mocked(market.getDataset).mockRejectedValue(new ApiError(404))
  await screen.findByText(/Linked chart unavailable/);expect(screen.getByLabelText('Saved journal P&L')).toHaveTextContent('0.027');expect(screen.queryByRole('img', { name: /imported candlesticks/ })).not.toBeInTheDocument()
})
it('requires explicit delete confirmation and preserves draft and error on stale deletion', async () => {
  vi.mocked(api.remove).mockRejectedValueOnce(new ApiError(409));render(<App />);await select()
  fireEvent.change(screen.getByLabelText('Journal notes'), { target: { value: 'Dirty but preserved' } })
  fireEvent.click(screen.getByRole('button', { name: 'Delete journal entry' }));expect(api.remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Keep journal draft' }));expect(api.remove).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Delete journal entry' }));fireEvent.click(screen.getByRole('button', { name: 'Confirm journal action' }))
  await screen.findByRole('alert');expect(screen.getByLabelText('Journal notes')).toHaveValue('Dirty but preserved');expect(api.remove).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Delete journal entry' })).toBeEnabled())
  expect(screen.getByRole('alert')).toHaveTextContent('resource changed')
})
it('supports explicit custom range and open-state invariants without automatic writes', async () => {
  render(<App />);await select();fireEvent.change(screen.getByLabelText('Trade state'), { target: { value: 'OPEN' } });expect(screen.queryByLabelText('Exit price')).not.toBeInTheDocument()
  fireEvent.submit(screen.getByRole('form', { name: 'Manual journal entry' }));await waitFor(() => expect(api.save).toHaveBeenCalled())
  expect(vi.mocked(api.save).mock.calls[0][1].entry).toMatchObject({ state: 'OPEN', exitPrice: null, exitTime: null, exitFee: '0' })
  fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2024-02-29' } });fireEvent.change(screen.getByLabelText('Through date'), { target: { value: '2024-03-01' } })
  fireEvent.change(screen.getByLabelText('Report timezone'), { target: { value: 'Asia/Ho_Chi_Minh' } });fireEvent.change(screen.getByLabelText('Report settlement unit'), { target: { value: 'EUR' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Journal report filters' }));await waitFor(() => expect(api.summary).toHaveBeenLastCalledWith({ from: '2024-02-29', to: '2024-03-01', zone: 'Asia/Ho_Chi_Minh', currency: 'EUR' }, undefined))
})
it('retains partial ISO UTC input and sends exact millisecond timestamps from a new form', async () => {
  render(<App />);await screen.findByLabelText('Realized journal totals')
  fireEvent.change(screen.getByLabelText('Entry time · UTC'), { target: { value: '2024-01-' } })
  expect(screen.getByLabelText('Entry time · UTC')).toHaveValue('2024-01-')
  for (const [label, value] of [['Symbol', 'TEST_USD'], ['Quantity', '2'], ['Entry price', '100'], ['Entry time · UTC', '2024-01-01T01:00:00.123Z'], ['Entry reason', 'Actual closed candle reason']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.change(screen.getByLabelText('Trade state'), { target: { value: 'CLOSED' } })
  fireEvent.change(screen.getByLabelText('Exit price'), { target: { value: '110' } });fireEvent.change(screen.getByLabelText('Exit time · UTC'), { target: { value: '2024-01-01T03:00:00Z' } })
  fireEvent.submit(screen.getByRole('form', { name: 'Manual journal entry' }));await waitFor(() => expect(api.save).toHaveBeenCalled())
  expect(vi.mocked(api.save).mock.calls[0][0]).toBeNull()
  expect(vi.mocked(api.save).mock.calls[0][1]).toMatchObject({ expectedVersion: 0, entry: { entryTime: '2024-01-01T01:00:00.123Z', exitTime: '2024-01-01T03:00:00Z' } })
})
it('keeps an acknowledged write frozen if the later account verification is rate-limited', async () => {
  const user = { id: key(90), email: 'a@example.test', displayName: 'A' };vi.mocked(currentUser).mockResolvedValue(user)
  render(<AuthContext.Provider value={{ user, clear: vi.fn(), update: vi.fn() }}><App /></AuthContext.Provider>);await select()
  fireEvent.change(screen.getByLabelText('Journal notes'), { target: { value: 'Acknowledged but unverified' } })
  vi.mocked(currentUser).mockRejectedValueOnce(new ApiError(429));fireEvent.submit(screen.getByRole('form', { name: 'Manual journal entry' }))
  await screen.findByRole('button', { name: 'Retry same journal save' });expect(screen.getByLabelText('Journal notes')).toBeDisabled()
  const intent = vi.mocked(api.save).mock.calls[0][1]
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry same journal save' })) })
  expect(api.save).toHaveBeenLastCalledWith(first.id, intent, user.id);expect(screen.getByLabelText('Journal notes')).not.toBeDisabled()
})
it('does not interpret another accounts404 as proof an uncertain deletion succeeded', async () => {
  const user = { id: key(90), email: 'a@example.test', displayName: 'A' }, clear = vi.fn();vi.mocked(currentUser).mockResolvedValue(user)
  render(<AuthContext.Provider value={{ user, clear, update: vi.fn() }}><App /></AuthContext.Provider>);await select()
  vi.mocked(api.remove).mockRejectedValueOnce(new Error('lost response'));vi.mocked(api.get).mockRejectedValueOnce(new ApiError(404))
  vi.mocked(currentUser).mockResolvedValue({ ...user, id: key(91) })
  fireEvent.click(screen.getByRole('button', { name: 'Delete journal entry' }));fireEvent.click(screen.getByRole('button', { name: 'Confirm journal action' }))
  await waitFor(() => expect(clear).toHaveBeenCalled());expect(screen.queryByText(/Deletion was verified/)).not.toBeInTheDocument()
})
it('warns when manual entry is outside the linked candle range without altering trade values', async () => {
  vi.mocked(api.get).mockResolvedValue({ ...first, data: { ...first.data, entryTime: '2024-01-02T00:00:00Z', datasetId: dataset.id } })
  render(<App />);await select();await screen.findByText(/Entry time is outside this dataset/)
  expect(screen.getByLabelText('Saved journal P&L')).toHaveTextContent('0.027');expect(screen.getByLabelText('Entry time · UTC')).toHaveValue('2024-01-02T00:00:00Z')
})
