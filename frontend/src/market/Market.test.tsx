import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AuthContext } from '../auth/AuthContext'
import { ApiError } from '../auth/api'
import { DatasetChart } from './DatasetChart'
import { MarketProvider } from './MarketProvider'
import * as api from './api'

vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), listDatasets: vi.fn(), candles: vi.fn(), importDataset: vi.fn(), deleteDataset: vi.fn() }))
const first: api.Dataset = { id: '00000000-0000-0000-0000-000000000001', name: 'Research A', symbol: 'TEST_USD', timeframe: '1h', timezone: 'UTC', sourceKind: 'USER_UPLOAD', sourceLabel: 'Private source', rawHash: 'b'.repeat(64), dataHash: 'a'.repeat(64), formatVersion: 'ohlcv-v1', candleCount: 360, gapCount: 0, firstTime: '2024-01-01T00:00:00Z', lastTime: '2024-01-15T23:00:00Z', createdAt: '2024-02-01T00:00:00Z' }
const second = { ...first, id: '00000000-0000-0000-0000-000000000002', name: 'Research B', symbol: 'OTHER_USD', dataHash: 'c'.repeat(64) }
const page = (dataset = first, size = 100, start = dataset.candleCount - size): api.CandlePage => ({ dataset, start, total: dataset.candleCount, items: Array.from({ length: Math.min(size, dataset.candleCount - start) }, (_, i) => ({ ordinal: start + i, time: new Date(Date.UTC(2024, 0, 1, start + i)).toISOString().replace('.000Z', 'Z'), open: '100.12345678', high: '102', low: '99', close: '101', volume: '0' })) })
const clear = vi.fn()
function App({ user = 'a' }: { user?: string }) {
  return <AuthContext.Provider value={{ user: { id: user, email: `${user}@example.test`, displayName: user }, update: vi.fn(), clear }}><MarketProvider key={user}><DatasetChart /></MarketProvider></AuthContext.Provider>
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.listDatasets).mockResolvedValue({ items: [first, second], nextCursor: null })
  vi.mocked(api.candles).mockImplementation(async (item, size, start) => page(item, size, start))
  vi.mocked(api.importDataset).mockResolvedValue({ ...first, name: 'Synthetic research sample', sourceKind: 'SYNTHETIC' })
  vi.mocked(api.deleteDataset).mockResolvedValue(undefined)
})
const openImport = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Import CSV' }))
  const dialog = screen.getByRole('dialog', { name: 'Import market data' })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Load synthetic sample' }))
  return dialog
}

describe('PB-006 private market UI (API contract mocks)', () => {
  it('renders persisted prices and navigates candle windows without fake indicators', async () => {
    render(<App />)
    expect(await screen.findByRole('img', { name: /TEST_USD imported candlesticks/ })).toBeInTheDocument()
    expect(screen.getByText(/O 100\.12345678/)).toBeInTheDocument()
    expect(screen.queryByText(/EMA 50/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Older' }))
    await waitFor(() => expect(api.candles).toHaveBeenLastCalledWith(first, 100, 160, 'a'))
    await screen.findByRole('img', { name: /TEST_USD imported/ })
    fireEvent.change(screen.getByLabelText('Candle window'), { target: { value: '50' } })
    await waitFor(() => expect(api.candles).toHaveBeenLastCalledWith(first, 50, undefined, 'a'))
    await screen.findByRole('img', { name: /50 candles/ })
    expect(screen.queryByRole('button', { name: /Previous candle|Next candle/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Candle index')).not.toBeInTheDocument()
  })

  it('keeps loading, empty and list failure distinguishable and permits retry', async () => {
    let resolve!: (value: { items: api.Dataset[]; nextCursor: null }) => void
    vi.mocked(api.listDatasets).mockReturnValueOnce(new Promise(done => { resolve = done }))
    render(<App />); expect(screen.getByText('Loading datasets…')).toBeInTheDocument()
    await act(async () => resolve({ items: [], nextCursor: null }))
    expect(screen.getByText('Your market datasets')).toBeInTheDocument()
    vi.mocked(api.listDatasets).mockRejectedValueOnce(new Error('Offline fixture'))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh datasets' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline fixture')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh datasets' }))
    expect(await screen.findByRole('img', { name: /TEST_USD imported/ })).toBeInTheDocument()
  })

  it('never shows late A candles under selected B metadata', async () => {
    let resolveA!: (value: api.CandlePage) => void
    vi.mocked(api.candles).mockImplementation(async (item, size) => item.id === first.id ? new Promise(done => { resolveA = done }) : page(item, size))
    render(<App />); await screen.findByRole('heading', { name: first.name })
    fireEvent.change(screen.getByLabelText('Dataset'), { target: { value: second.id } })
    expect(await screen.findByRole('img', { name: /OTHER_USD imported/ })).toBeInTheDocument()
    await act(async () => resolveA(page(first)))
    expect(screen.queryByRole('img', { name: /TEST_USD imported/ })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: second.name })).toBeInTheDocument()
  })

  it('preserves exact uncertain import payload and prevents duplicate submit or edits', async () => {
    let finish!: (value: api.Dataset) => void
    vi.mocked(api.importDataset).mockRejectedValueOnce(new Error('Network uncertain')).mockReturnValueOnce(new Promise(done => { finish = done }))
    render(<App />); await screen.findByRole('img', { name: /TEST_USD imported/ })
    const dialog = await openImport()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import dataset' }))
    const retry = await within(dialog).findByRole('button', { name: 'Retry import' })
    expect(within(dialog).getByLabelText('CSV data')).toBeDisabled()
    expect(screen.getByLabelText('Dataset')).toBeDisabled()
    const original = vi.mocked(api.importDataset).mock.calls[0][0]
    fireEvent.click(retry); fireEvent.click(retry)
    expect(api.importDataset).toHaveBeenCalledTimes(2)
    expect(vi.mocked(api.importDataset).mock.calls[1][0]).toEqual(original)
    expect(original.sourceKind).toBe('SYNTHETIC'); expect(original.csv).toContain('timestamp,open,high,low,close,volume')
    await act(async () => finish({ ...first, name: 'Saved sample', sourceKind: 'SYNTHETIC' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Import market data' })).not.toBeInTheDocument())
    expect(await screen.findByRole('heading', { name: 'Saved sample' })).toBeInTheDocument()
  })

  it('retains editable CSV after definite validation rejection and shows line diagnostics', async () => {
    vi.mocked(api.importDataset).mockRejectedValueOnce(new api.CsvError(3, 'CSV_TIME_ORDER'))
    render(<App />); await screen.findByRole('img', { name: /TEST_USD imported/ })
    const dialog = await openImport()
    const originalCsv = (within(dialog).getByLabelText('CSV data') as HTMLTextAreaElement).value
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import dataset' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('line 3')
    expect(within(dialog).getByLabelText('CSV data')).not.toBeDisabled()
    expect(within(dialog).getByLabelText('CSV data')).toHaveValue(originalCsv)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close import' }))
    expect(screen.queryByRole('dialog', { name: 'Import market data' })).not.toBeInTheDocument()
  })

  it('rejects wrong extension/oversized file and reads a valid CSV without executing it', async () => {
    render(<App />); await screen.findByRole('img', { name: /TEST_USD imported/ })
    const dialog = await openImport(), input = within(dialog).getByLabelText('Choose CSV file')
    fireEvent.change(input, { target: { files: [new File(['x'], 'payload.exe')] } })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('.csv file up to 1 MiB')
    fireEvent.change(input, { target: { files: [new File(['x'.repeat(1024 * 1024 + 1)], 'huge.csv')] } })
    expect(within(dialog).getByRole('alert')).toHaveTextContent('.csv file up to 1 MiB')
    const csv = 'timestamp,open,high,low,close,volume\n2024-01-01T00:00:00Z,1,2,1,2,0\n'
    fireEvent.change(input, { target: { files: [new File([csv], 'valid.csv', { type: 'text/csv' })] } })
    await waitFor(() => expect(within(dialog).getByLabelText('CSV data')).toHaveValue(csv))
    expect(api.importDataset).not.toHaveBeenCalled()
  })

  it('requires delete confirmation and retains resource on failure before successful retry', async () => {
    vi.mocked(api.deleteDataset).mockRejectedValueOnce(new ApiError(503)).mockResolvedValueOnce(undefined)
    render(<App />); await screen.findByRole('img', { name: /TEST_USD imported/ })
    fireEvent.click(screen.getByRole('button', { name: 'Delete dataset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel deletion' })); expect(api.deleteDataset).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete dataset' }))
    let dialog = screen.getByRole('dialog', { name: 'Delete dataset' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm deletion' }))
    await within(dialog).findByRole('alert')
    expect(screen.getByRole('heading', { name: first.name })).toBeInTheDocument()
    dialog = screen.getByRole('dialog', { name: 'Delete dataset' }); fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm deletion' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Delete dataset' })).not.toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: first.name })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Dataset')).toHaveTextContent(second.name)
  })

  it('shows gaps/provenance as inert text and reports failed candle loads without old chart', async () => {
    vi.mocked(api.listDatasets).mockResolvedValue({ items: [{ ...first, name: '<script>fixture()</script>', gapCount: 3 }], nextCursor: null })
    vi.mocked(api.candles).mockRejectedValueOnce(new Error('Dataset unavailable'))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Dataset unavailable')
    expect(screen.getByRole('note')).toHaveTextContent('3 missing candle intervals')
    expect(document.querySelector('script')).toBeNull()
    expect(screen.queryByRole('img', { name: /imported candlesticks/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry candles' }))
    expect(await screen.findByRole('img', { name: /TEST_USD imported/ })).toBeInTheDocument()
  })

  it('clears identity-specific state and ignores pending old-user import acknowledgement', async () => {
    let resolve!: (value: api.Dataset) => void
    vi.mocked(api.importDataset).mockReturnValueOnce(new Promise(done => { resolve = done }))
    const view = render(<App />); await screen.findByRole('img', { name: /TEST_USD imported/ })
    const dialog = await openImport(); fireEvent.click(within(dialog).getByRole('button', { name: 'Import dataset' }))
    vi.mocked(api.listDatasets).mockResolvedValue({ items: [], nextCursor: null })
    view.rerender(<App user="b" />)
    await screen.findByText('Your market datasets')
    await act(async () => resolve(first))
    expect(screen.queryByRole('heading', { name: first.name })).not.toBeInTheDocument()
    expect(screen.queryByText('Dataset imported and saved.')).not.toBeInTheDocument()
  })

  it('restores authentication flow on401 and deduplicates list paging', async () => {
    vi.mocked(api.listDatasets).mockResolvedValueOnce({ items: [first], nextCursor: 'cursor' }).mockResolvedValueOnce({ items: [first, second], nextCursor: null }).mockRejectedValueOnce(new ApiError(401))
    render(<App />); await screen.findByRole('img', { name: /TEST_USD imported/ })
    fireEvent.click(screen.getByRole('button', { name: 'More datasets' }))
    await screen.findByRole('option', { name: /Research B/ })
    expect(screen.getAllByRole('option', { name: /Research A/ })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh datasets' }))
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1))
  })

  it('PB-031 switches only to compatible higher display intervals and honest chart types', async () => {
    render(<App />)
    expect(await screen.findByRole('img', { name: /100 candles in UTC/ })).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Timeframe'))
    expect(screen.getByRole('button', { name: /15m Unavailable/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /4h UTC/ }))
    expect(screen.getByRole('img', { name: /25 candles in UTC/ })).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Chart type'))
    fireEvent.click(screen.getByRole('button', { name: 'Bars' }))
    expect(screen.getByRole('img', { name: /imported bars/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Footprint enriched data/ })).toBeDisabled()
    expect(api.candles).toHaveBeenCalledTimes(1)
  })

  it('PB-031 adds configurable visual indicators and applies effective chart settings', async () => {
    render(<App />); await screen.findByRole('img', { name: /imported candlesticks/ })
    fireEvent.click(screen.getByLabelText('Indicators'))
    fireEvent.click(screen.getByRole('button', { name: '+ sma' })); fireEvent.click(screen.getByRole('button', { name: '+ rsi' }))
    expect(screen.getByLabelText('SMA period')).toHaveValue(50)
    expect(screen.getByLabelText('RSI period')).toHaveValue(14)
    const legend = screen.getByLabelText('Active indicators')
    expect(within(legend).getByText(/sma 50/i)).toBeInTheDocument()
    expect(within(legend).getByText(/rsi 14/i)).toBeInTheDocument()
    const rsiSplitter = screen.getByRole('separator', { name: 'Resize RSI pane' })
    expect(rsiSplitter).toHaveAttribute('aria-valuenow', '92')
    fireEvent.keyDown(rsiSplitter, { key: 'ArrowUp' })
    expect(rsiSplitter).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByLabelText('Chart timezone and current time')).toHaveTextContent('UTC')
    fireEvent.click(within(legend).getByRole('button', { name: 'Hide SMA 50' }))
    expect(within(legend).getByRole('button', { name: 'Show SMA 50' })).toBeInTheDocument()
    fireEvent.click(within(legend).getByRole('button', { name: 'Remove SMA 50' }))
    expect(within(legend).queryByText(/sma 50/i)).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /imported candlesticks/ }).querySelectorAll('polyline').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Chart settings' }))
    const dialog = screen.getByRole('dialog', { name: 'Chart settings' })
    fireEvent.change(within(dialog).getByLabelText('Settings chart type'), { target: { value: 'area' } })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Grid' }))
    fireEvent.change(within(dialog).getByLabelText('Chart timezone'), { target: { value: 'Asia/Ho_Chi_Minh' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close chart settings' }))
    expect(screen.getByRole('img', { name: /imported area.*Asia\/Ho_Chi_Minh/ })).toBeInTheDocument()
  })

  it('PB-031 creates local drawings with undo, redo, selection and deletion controls', async () => {
    render(<App />)
    const chart = await screen.findByRole('img', { name: /imported candlesticks/ })
    fireEvent.click(screen.getByRole('button', { name: 'Trend Line' }))
    fireEvent.pointerDown(chart, { pointerId: 1, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(chart, { pointerId: 1, clientX: 120, clientY: 80 })
    fireEvent.pointerUp(chart, { pointerId: 1, clientX: 120, clientY: 80 })
    expect(chart.querySelector('[data-drawing-type="trend"]')).toHaveAttribute('data-drawing-anchor', 'time-price')
    expect(screen.getByRole('button', { name: 'Undo drawing' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Undo drawing' }))
    expect(screen.getByRole('button', { name: 'Redo drawing' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Redo drawing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    fireEvent.pointerDown(chart, { pointerId: 2, clientX: 60, clientY: 60 })
    expect(screen.getByLabelText('Selected note text')).toHaveValue('Text')
    fireEvent.change(screen.getByLabelText('Selected note text'), { target: { value: 'Breakout' } })
    expect(chart).toHaveTextContent('Breakout')
    fireEvent.keyDown(chart, { key: 'Delete' })
    expect(screen.queryByLabelText('Selected note text')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Object Tree' }))
    const drawingName = screen.getByLabelText('Rename Trend Line')
    fireEvent.change(drawingName, { target: { value: 'Primary trend' } })
    expect(drawingName).toHaveValue('Primary trend')
    fireEvent.click(screen.getByRole('button', { name: 'Lock Trend Line' }))
    expect(screen.getByRole('button', { name: 'Unlock Trend Line' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hide Trend Line' }))
    expect(chart.querySelector('[data-drawing-type="trend"]')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 't', altKey: true })
    expect(screen.getByLabelText('Lines tools')).toHaveClass('text-slate-100')
  })

  it('PB-031 renders the extended drawing tools and marks complex channels unavailable', async () => {
    render(<App />)
    const chart = await screen.findByRole('img', { name: /imported candlesticks/ })
    for (const [label, type] of [['Ray', 'ray'], ['Vertical Line', 'vertical'], ['Rectangle', 'rectangle'], ['Arrow', 'arrow']] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      fireEvent.pointerDown(chart, { pointerId: 3, clientX: 30, clientY: 30 })
      if (type !== 'vertical') fireEvent.pointerMove(chart, { pointerId: 3, clientX: 130, clientY: 90 })
      fireEvent.pointerUp(chart, { pointerId: 3, clientX: 130, clientY: 90 })
      expect(chart.querySelector(`[data-drawing-type="${type}"]`)).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Parallel Channel' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Gann Fan unavailable' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear drawings' })).toBeEnabled()
  })

  it('PB-031 zooms, pans and resets only the loaded candle viewport', async () => {
    render(<App />)
    const chart = await screen.findByRole('img', { name: /100 candles in UTC \(100 of 100 loaded\)/ })
    fireEvent.wheel(chart, { deltaY: -100, clientX: 450 })
    await waitFor(() => expect(screen.queryByRole('img', { name: /100 candles in UTC \(100 of 100 loaded\)/ })).not.toBeInTheDocument())
    fireEvent.pointerDown(chart, { pointerId: 8, clientX: 500, clientY: 180 })
    fireEvent.pointerMove(chart, { pointerId: 8, clientX: 440, clientY: 220 })
    fireEvent.pointerUp(chart, { pointerId: 8, clientX: 440, clientY: 220 })
    await waitFor(() => expect(screen.getByText('Manual price')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Reset chart view' }))
    expect(screen.getByRole('img', { name: /100 candles in UTC \(100 of 100 loaded\)/ })).toBeInTheDocument()
  })
})

it('PB-027 keeps the exact imported content after a rate-limited uncertain retry', async () => {
  vi.mocked(api.importDataset).mockRejectedValueOnce(new Error('Lost acknowledgement')).mockRejectedValueOnce(new ApiError(429))
  render(<App />); await screen.findByRole('img', { name: /TEST_USD imported/ })
  const dialog = await openImport()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Import dataset' }))
  fireEvent.click(await within(dialog).findByRole('button', { name: 'Retry import' }))
  await waitFor(() => expect(api.importDataset).toHaveBeenCalledTimes(2))
  expect(within(dialog).getByLabelText('CSV data')).toBeDisabled()
  expect(vi.mocked(api.importDataset).mock.calls[1]).toEqual(vi.mocked(api.importDataset).mock.calls[0])
  fireEvent.click(within(dialog).getByRole('button', { name: 'Retry import' }))
  await waitFor(() => expect(api.importDataset).toHaveBeenCalledTimes(3))
  expect(vi.mocked(api.importDataset).mock.calls[2]).toEqual(vi.mocked(api.importDataset).mock.calls[0])
})
