import { candles, importDataset, listDatasets, type Dataset, type ImportRequest, CsvError } from './api'
import { ApiError } from '../auth/api'

const dataset: Dataset = { id: '00000000-0000-0000-0000-000000000001', name: 'Exact data', symbol: 'TEST', timeframe: '1h', timezone: 'UTC', sourceKind: 'USER_UPLOAD', sourceLabel: 'User declared source', rawHash: 'a'.repeat(64), dataHash: 'b'.repeat(64), formatVersion: 'ohlcv-v1', candleCount: 1, gapCount: 0, firstTime: '2024-01-01T00:00:00Z', lastTime: '2024-01-01T00:00:00Z', createdAt: '2024-02-01T00:00:00Z' }
const candle = { ordinal: 0, time: '2024-01-01T00:00:00Z', open: '100.12345678', high: '101', low: '99', close: '100', volume: '0' }
const payload: ImportRequest = { requestId: '00000000-0000-0000-0000-000000000002', name: 'Exact data', symbol: 'TEST', timeframe: '1h', sourceKind: 'USER_UPLOAD', sourceLabel: 'Source', csv: 'timestamp,open,high,low,close,volume\n2024-01-01T00:00:00Z,1,2,1,2,0\n' }
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('retains exact decimal text and rejects another dataset, hash or offset in page response', async () => {
  const body = { dataset, start: 0, total: 1, items: [candle] }
  const fetch = vi.fn().mockResolvedValueOnce(response(200, body))
    .mockResolvedValueOnce(response(200, { ...body, dataset: { ...dataset, id: payload.requestId } }))
    .mockResolvedValueOnce(response(200, { ...body, dataset: { ...dataset, dataHash: 'c'.repeat(64) } }))
    .mockResolvedValueOnce(response(200, { ...body, start: 1, items: [] }))
  vi.stubGlobal('fetch', fetch)
  expect((await candles(dataset, 50)).items[0].open).toBe('100.12345678')
  await expect(candles(dataset, 50)).rejects.toThrow('Invalid market-data response')
  await expect(candles(dataset, 50)).rejects.toThrow('Invalid market-data response')
  await expect(candles(dataset, 50)).rejects.toThrow('Invalid market-data response')
  expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
})

it('rejects numeric coercion, nonfinite prices, invalid bars and invented metadata', async () => {
  const fetch = vi.fn()
  for (const changed of [{ open: 100 }, { high: 'Infinity' }, { volume: '-1' }, { low: '102' }, { ordinal: 2 }, { time: 'invalid-date' }])
    fetch.mockResolvedValueOnce(response(200, { dataset, start: 0, total: 1, items: [{ ...candle, ...changed }] }))
  fetch.mockResolvedValueOnce(response(200, { items: [{ ...dataset, sourceKind: 'VERIFIED_EXCHANGE' }], nextCursor: null }))
  vi.stubGlobal('fetch', fetch)
  for (let i = 0; i < 6; i++) await expect(candles(dataset, 50)).rejects.toThrow('Invalid market-data response')
  await expect(listDatasets()).rejects.toThrow('Invalid market-data response')
})

it('submits the bounded document via CSRF and never retries uncertain mutation automatically', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(200, { headerName: 'X-CSRF-TOKEN', token: 'synthetic-token' })).mockRejectedValueOnce(new TypeError('network fixture'))
  vi.stubGlobal('fetch', fetch)
  await expect(importDataset(payload)).rejects.toThrow('Cannot reach the service')
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(fetch.mock.calls[1][0]).toBe('/api/datasets/import')
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(payload)
  expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'synthetic-token' } })
})

it('shows only bounded CSV error codes and line numbers, never raw server messages', async () => {
  const fetch = vi.fn()
  for (const body of [{ line: 2, code: 'CSV_NUMBER_FORMAT', message: 'private input must not appear' }, { line: 999999, code: '<script>injected</script>', message: 'private' }]) {
    fetch.mockResolvedValueOnce(response(200, { headerName: 'X-CSRF-TOKEN', token: 'synthetic-token' })).mockResolvedValueOnce(response(422, body))
  }
  vi.stubGlobal('fetch', fetch)
  await expect(importDataset(payload)).rejects.toEqual(expect.objectContaining({ line: 2, code: 'CSV_NUMBER_FORMAT', message: 'CSV validation failed at line 2 (CSV_NUMBER_FORMAT). Check the import format.' }))
  try { await importDataset(payload); throw new Error('Should reject') }
  catch (error) { expect(error).toBeInstanceOf(ApiError); expect(error).not.toBeInstanceOf(CsvError); expect((error as Error).message).not.toMatch(/private|script/) }
})
