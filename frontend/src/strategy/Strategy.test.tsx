import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AuthContext } from '../auth/AuthContext'
import { ApiError } from '../auth/api'
import { App as Shell } from '../App'
import { ConversationProvider } from '../chat/ConversationProvider'
import { MarketContext, type MarketState } from '../market/MarketContext'
import { StrategyEditor } from './StrategyEditor'
import { StrategyProvider } from './StrategyProvider'
import * as api from './api'
import sample from './sample.json'

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), listStrategies: vi.fn(), getRevision: vi.fn(), history: vi.fn(), createStrategy: vi.fn(), saveRevision: vi.fn(), validateDraft: vi.fn(), deleteStrategy: vi.fn() }))
vi.mock('../chat/api', async original => ({ ...await original<typeof import('../chat/api')>(), listConversations: async () => ({ items: [], nextCursor: null }) }))
vi.mock('../market/DatasetChart', () => ({ DatasetChart: () => <div>Chart context fixture</div> }))
const first: api.Revision = { strategyId: '00000000-0000-0000-0000-000000000001', revision: 1, title: 'Research A', draftText: '', status: 'DRAFT', canonicalJson: null, hash: null, schemaVersion: null, validatorVersion: null, minimumBars: null, symbol: null, timeframe: null, createdAt: '2024-01-01T00:00:00Z' }
const second = { ...first, strategyId: '00000000-0000-0000-0000-000000000002', title: 'Research B', draftText: 'B only' }
const brief = (r: api.Revision): api.Brief => ({ id: r.strategyId, revision: r.revision, title: r.title, status: r.status, symbol: r.symbol, timeframe: r.timeframe, createdAt: r.createdAt })
const valid: api.Validation = { valid: true, document: { canonicalJson: JSON.stringify(sample), hash: 'a'.repeat(64), schemaVersion: '1.0.0', validatorVersion: '1.0.0', minimumBars: 1 }, errors: [] }
const clear = vi.fn()
function App({ user = 'a', shell = false }: { user?: string; shell?: boolean }) {
  return <AuthContext.Provider value={{ user: { id: user, email: `${user}@example.test`, displayName: user }, update: vi.fn(), clear }}><StrategyProvider key={user}>{shell ? <ConversationProvider><Shell /></ConversationProvider> : <StrategyEditor />}</StrategyProvider></AuthContext.Provider>
}
beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1280 })
  vi.mocked(api.listStrategies).mockResolvedValue({ items: [brief(first), brief(second)], nextCursor: null })
  vi.mocked(api.getRevision).mockImplementation(async id => id === first.strategyId ? first : second)
  vi.mocked(api.history).mockResolvedValue({ items: [brief(first)], nextBefore: null })
  vi.mocked(api.createStrategy).mockResolvedValue(first)
  vi.mocked(api.saveRevision).mockImplementation(async (id, body) => ({ ...first, strategyId: id, revision: body.expectedRevision + 1, title: body.title, draftText: body.draftText, status: body.mode, ...(body.mode === 'VALIDATED' ? { ...valid.document!, symbol: 'BTC_USDT', timeframe: '1h' } : {}) }))
  vi.mocked(api.validateDraft).mockResolvedValue(valid)
  vi.mocked(api.deleteStrategy).mockResolvedValue(undefined)
})
const choose = async (item = first) => {
  await screen.findByRole('option', { name: `${item.title} · r${item.revision}` })
  fireEvent.change(screen.getByLabelText('Strategy'), { target: { value: item.strategyId } })
  await waitFor(() => expect(screen.getByLabelText('Strategy JSON')).toHaveValue(item.draftText))
}
const edit = (text: string) => fireEvent.change(screen.getByLabelText('Strategy JSON'), { target: { value: text } })

it('saves an incomplete draft then explicitly saves a validated immutable revision', async () => {
  render(<App />); await choose(); edit('{ incomplete')
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  await screen.findByText('Saved revision 2 · DRAFT.')
  expect(api.saveRevision).toHaveBeenLastCalledWith(first.strategyId, expect.objectContaining({ expectedRevision: 1, draftText: '{ incomplete', mode: 'DRAFT' }))
  fireEvent.click(screen.getByRole('button', { name: 'Load synthetic DSL example' }))
  expect(screen.getByLabelText('Strategy JSON')).toHaveValue(JSON.stringify(sample, null, 2))
  expect(api.saveRevision).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Save validated revision' }))
  await screen.findByText('Saved revision 3 · VALIDATED.')
  expect(api.saveRevision).toHaveBeenLastCalledWith(first.strategyId, expect.objectContaining({ expectedRevision: 2, mode: 'VALIDATED' }))
  expect(screen.getByText('Editor matches saved revision')).toBeInTheDocument()
})

it('ignores a validation result after text changes and never calls save during validation', async () => {
  let resolve!: (v: api.Validation) => void
  vi.mocked(api.validateDraft).mockReturnValueOnce(new Promise(done => { resolve = done }))
  render(<App />); await choose(); edit(JSON.stringify(sample))
  fireEvent.click(screen.getByRole('button', { name: 'Validate' })); edit('changed invalid')
  await act(async () => resolve(valid))
  expect(screen.queryByText(/Current text passes/)).not.toBeInTheDocument(); expect(api.saveRevision).not.toHaveBeenCalled()
  const invalid: api.Validation = { valid: false, document: null, errors: [{ path: '', code: 'MALFORMED_JSON' }] }
  vi.mocked(api.saveRevision).mockRejectedValueOnce(new api.ValidationError(invalid))
  fireEvent.click(screen.getByRole('button', { name: 'Save validated revision' }))
  await screen.findByText('Current text is not valid DSL.')
  expect(screen.getByLabelText('Strategy JSON')).toHaveValue('changed invalid'); expect(screen.getByLabelText('Strategy JSON')).not.toBeDisabled()
})

it('retains exact uncertain save intent, locks edits and retries without duplicate requests', async () => {
  vi.mocked(api.saveRevision).mockRejectedValueOnce(new Error('Network interrupted'))
  render(<App />); await choose(); edit('original pending')
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' })); fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  await screen.findByRole('button', { name: 'Retry strategy request' })
  expect(api.saveRevision).toHaveBeenCalledTimes(1)
  const original = vi.mocked(api.saveRevision).mock.calls[0][1]
  expect(screen.getByLabelText('Strategy JSON')).toBeDisabled(); expect(screen.getByLabelText('Strategy')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry strategy request' }))
  await screen.findByText('Saved revision 2 · DRAFT.')
  expect(api.saveRevision).toHaveBeenLastCalledWith(first.strategyId, original)
  expect(screen.getByLabelText('Strategy JSON')).toHaveValue('original pending')
})

it('preserves a conflicting draft until explicit reload confirmation and cancel keeps editing', async () => {
  vi.mocked(api.saveRevision).mockRejectedValueOnce(new ApiError(409))
  render(<App />); await choose(); edit('local work')
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  await screen.findByRole('alert'); expect(screen.getByLabelText('Strategy JSON')).toHaveValue('local work')
  fireEvent.click(screen.getByRole('button', { name: 'Reload current revision' }))
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
  expect(api.getRevision).toHaveBeenCalledTimes(1); expect(screen.getByLabelText('Strategy JSON')).toHaveValue('local work')
  vi.mocked(api.getRevision).mockResolvedValueOnce({ ...first, revision: 2, draftText: 'remote newer' })
  fireEvent.click(screen.getByRole('button', { name: 'Reload current revision' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }))
  await waitFor(() => expect(screen.getByLabelText('Strategy JSON')).toHaveValue('remote newer'))
  expect(screen.getByText('Saved r2 · DRAFT')).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Research A · r2' })).toBeInTheDocument()
})

it('rejects late strategy reads and requires discard before switching a dirty editor', async () => {
  let resolve!: (v: api.Revision) => void
  vi.mocked(api.getRevision).mockReturnValueOnce(new Promise(done => { resolve = done }))
  render(<App />); await screen.findByRole('option', { name: 'Research A · r1' })
  fireEvent.change(screen.getByLabelText('Strategy'), { target: { value: first.strategyId } })
  // Provider guards writes while loading; a second programmatic selection still cancels the first read.
  fireEvent.change(screen.getByLabelText('Strategy'), { target: { value: second.strategyId } })
  await waitFor(() => expect(screen.getByLabelText('Strategy JSON')).toHaveValue(second.draftText))
  await act(async () => resolve(first)); expect(screen.getByLabelText('Strategy title')).toHaveValue(second.title)
  edit('unsaved B'); fireEvent.change(screen.getByLabelText('Strategy'), { target: { value: first.strategyId } })
  expect(screen.getByRole('dialog', { name: 'Confirm strategy action' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' })); expect(screen.getByLabelText('Strategy JSON')).toHaveValue('unsaved B')
})

it('keeps historical revision read-only then copies it into a new revision based on current state', async () => {
  vi.mocked(api.getRevision).mockResolvedValueOnce({ ...first, revision: 3, draftText: 'current' }).mockResolvedValueOnce({ ...first, draftText: 'old immutable' })
  render(<App />); await screen.findByRole('option', { name: 'Research A · r1' }); fireEvent.change(screen.getByLabelText('Strategy'), { target: { value: first.strategyId } })
  await waitFor(() => expect(screen.getByLabelText('Strategy JSON')).toHaveValue('current'))
  fireEvent.click(await screen.findByRole('button', { name: /View revision 1/ }))
  await screen.findByRole('region', { name: 'Historical revision' })
  expect(screen.getByLabelText('Strategy JSON')).toHaveValue('current'); expect(api.saveRevision).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Use revision in editor' })); expect(screen.getByLabelText('Strategy JSON')).toHaveValue('old immutable')
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' })); await screen.findByText('Saved revision 4 · DRAFT.')
  expect(api.saveRevision).toHaveBeenLastCalledWith(first.strategyId, expect.objectContaining({ expectedRevision: 3, draftText: 'old immutable' }))
})

it('creates an empty strategy only on submission and preserves uncertain create UUID', async () => {
  vi.mocked(api.listStrategies).mockResolvedValue({ items: [], nextCursor: null })
  vi.mocked(api.createStrategy).mockRejectedValueOnce(new Error('Create acknowledgement lost'))
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'New strategy' }))
  expect(api.createStrategy).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('New strategy title'), { target: { value: 'Research A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create strategy' }))
  await screen.findByRole('button', { name: 'Retry strategy request' })
  const original = vi.mocked(api.createStrategy).mock.calls[0][0]
  fireEvent.click(screen.getByRole('button', { name: 'Cancel creation' })); fireEvent.click(screen.getByRole('button', { name: 'Retry strategy request' }))
  await screen.findByText('Saved revision 1 · DRAFT.'); expect(api.createStrategy).toHaveBeenLastCalledWith(original)
})

it('does not apply late saves after changing authenticated identity', async () => {
  let resolve!: (v: api.Revision) => void
  vi.mocked(api.saveRevision).mockReturnValueOnce(new Promise(done => { resolve = done }))
  const app = render(<App />); await choose(); edit('A private unsaved'); fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  vi.mocked(api.listStrategies).mockResolvedValue({ items: [], nextCursor: null }); app.rerender(<App user="b" />)
  await act(async () => resolve({ ...first, revision: 2, draftText: 'A private unsaved' }))
  expect(screen.queryByLabelText('Strategy JSON')).not.toBeInTheDocument(); expect(screen.queryByText(/A private unsaved/)).not.toBeInTheDocument()
})

it('handles list failure and expired sessions without invented saved content', async () => {
  vi.mocked(api.listStrategies).mockRejectedValueOnce(new Error('Service offline'))
  render(<App />); expect(await screen.findByRole('alert')).toHaveTextContent('Service offline')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh strategies' })); await choose()
  vi.mocked(api.saveRevision).mockRejectedValueOnce(new ApiError(401)); edit('changed'); fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  await waitFor(() => expect(clear).toHaveBeenCalledOnce())
})

it('keeps hostile text inert and rejects oversized UTF-8 draft before save', async () => {
  render(<App />); await choose(); const hostile = '<img src=x onerror=fixture()> https://internal.invalid ../file'
  edit(hostile); expect(screen.getByLabelText('Strategy JSON')).toHaveValue(hostile); expect(document.querySelector('img')).toBeNull()
  edit('é'.repeat(32769)); fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('64 KiB'); expect(api.saveRevision).not.toHaveBeenCalled()
})

it('confirms deletion, preserves on failure and does not delete on cancel', async () => {
  vi.mocked(api.deleteStrategy).mockRejectedValueOnce(new ApiError(409))
  render(<App />); await choose(); fireEvent.click(screen.getByRole('button', { name: 'Delete strategy' }))
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' })); expect(api.deleteStrategy).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Delete strategy' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }))
  await screen.findByRole('alert'); expect(screen.getByLabelText('Strategy JSON')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Delete strategy' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }))
  await screen.findByText('Strategy deleted. Datasets and conversations were not deleted.'); expect(screen.queryByLabelText('Strategy JSON')).not.toBeInTheDocument()
})

it('preserves drafts through workspace aliases and mobile navigation', async () => {
  render(<App shell />); fireEvent.click(screen.getByRole('tab', { name: 'Strategy DSL' })); await choose(); edit('persist across navigation')
  fireEvent.click(screen.getByRole('tab', { name: 'Chart' })); fireEvent.click(screen.getByRole('button', { name: 'My Code' }))
  expect(screen.getByLabelText('Strategy JSON')).toHaveValue('persist across navigation')
  fireEvent.click(screen.getByRole('button', { name: 'Strategies' })); expect(screen.getByLabelText('Strategy JSON')).toHaveValue('persist across navigation')
  act(() => { window.innerWidth = 390; window.dispatchEvent(new Event('resize')) })
  fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
  const nav = screen.getByRole('dialog', { name: 'Mobile navigation' }); fireEvent.click(within(nav).getByRole('button', { name: 'Strategy DSL' }))
  expect(screen.getByLabelText('Strategy JSON')).toHaveValue('persist across navigation')
})

it('warns on saved validated market mismatch but never invents a match from edited draft text', async () => {
  const saved: api.Revision = { ...first, status: 'VALIDATED', ...valid.document!, symbol: 'BTC_USDT', timeframe: '1h' }
  vi.mocked(api.getRevision).mockResolvedValue(saved)
  const market: MarketState = { items: [], selected: { id: second.strategyId, name: 'Context', symbol: 'DEMO_USD', timeframe: '1h', timezone: 'UTC', sourceKind: 'SYNTHETIC', sourceLabel: 'Fixture', rawHash: 'b'.repeat(64), dataHash: 'c'.repeat(64), formatVersion: 'ohlcv-v1', candleCount: 1, gapCount: 0, firstTime: first.createdAt, lastTime: first.createdAt, createdAt: first.createdAt }, nextCursor: null, page: null, window: 100, busy: false, uncertain: false, listLoading: false, pageLoading: false, listError: '', pageError: '', mutationError: '', notice: '', select: vi.fn(), loadList: vi.fn(), loadPage: vi.fn(), setWindow: vi.fn(), importData: vi.fn(), remove: vi.fn() }
  const app = render(<MarketContext.Provider value={market}><App /></MarketContext.Provider>); await choose()
  fireEvent.click(screen.getByRole('button', { name: 'Show chart' }))
  expect(screen.getByRole('note')).toHaveTextContent('does not match')
  app.rerender(<MarketContext.Provider value={{ ...market, selected: { ...market.selected!, symbol: 'BTC_USDT' } }}><App /></MarketContext.Provider>)
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Show editor' })); edit('unvalidated unrelated text'); fireEvent.click(screen.getByRole('button', { name: 'Show chart' }))
  expect(screen.getByText(/editor has unsaved changes/)).toHaveTextContent('BTC_USDT')
  expect(api.saveRevision).not.toHaveBeenCalled()
})
