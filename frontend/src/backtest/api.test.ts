import * as api from './api'
import { fixture, fixtures, key } from './fixtures'

afterEach(() => vi.unstubAllGlobals())
function reply(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
it.each(['win', 'zero', 'loss', 'open', 'negative'] as const)('parses actual engine %s fixture without losing exact economics', name => {
  const { job, result } = fixture(name)
  expect(api.parseResult(fixtures[name].result, job).metrics).toEqual(result.metrics)
  if (name === 'zero') { expect(result.metrics.winRatePct).toBeNull(); expect(result.trades).toHaveLength(0) }
  if (name === 'loss') { expect(result.metrics.netProfit).toBe('-100'); expect(result.metrics.profitFactor).toBe('0') }
  if (name === 'negative') expect(result.metrics.finalEquity).toBe('-8900')
  if (name === 'open') { expect(result.trades).toHaveLength(0); expect(result.openPosition?.unrealizedGross).toBe('100') }
})
it('rejects wrong result identity, version, counts, times, precision and decimal values', () => {
  const { job } = fixture()
  for (const change of [
    (v: typeof fixtures.win.result) => { v.resultHash = 'f'.repeat(64) },
    (v: typeof fixtures.win.result) => { v.runCard.inputHash = 'f'.repeat(64) },
    (v: typeof fixtures.win.result) => { v.runCard.dataset.symbol = 'OTHER' },
    (v: typeof fixtures.win.result) => { v.runCard.engineVersion = '2' },
    (v: typeof fixtures.win.result) => { v.bars[0].equity = 'Infinity' },
    (v: typeof fixtures.win.result) => { v.bars[1].index = 0 },
    (v: typeof fixtures.win.result) => { v.bars[1].openTime = v.bars[0].openTime },
    (v: typeof fixtures.win.result) => { v.metrics.closedTrades = 0 },
    (v: typeof fixtures.win.result) => { v.trades[0].exitTimePrecision = 'TICK' },
  ]) { const value = structuredClone(fixtures.win.result); change(value); expect(() => api.parseResult(value, job)).toThrow('Invalid backtest') }
  expect(() => api.parseJob({ ...job, id: '../../other' })).toThrow()
  expect(() => api.parseJob(job, key(9))).toThrow()
})
it('enforces frozen candle identity, global ordinals, result times and price bounds', async () => {
  const { job, result, page } = fixture()
  const fetcher = vi.fn().mockResolvedValue(reply(page)); vi.stubGlobal('fetch', fetcher)
  expect(await api.getCandles(job, result, 0, undefined, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toEqual(page)
  expect(fetcher.mock.calls[0][0]).toBe(`/api/backtests/${job.id}/candles?start=0&limit=100`)
  for (const value of [{ ...page, jobId: key(2) }, { ...page, dataHash: 'f'.repeat(64) }, { ...page, start: 1 },
    { ...page, items: page.items.slice(1) }, { ...page, items: page.items.map(c => ({ ...c, low: '999' })) },
    { ...page, items: page.items.map(c => ({ ...c, time: '2024-02-01T00:00:00Z' })) }]) {
    fetcher.mockResolvedValueOnce(reply(value)); await expect(api.getCandles(job, result, 0, undefined, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow()
  }
  await expect(api.getCandles(job, result, -1, undefined, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow()
  await expect(api.getCandles(job, result, 0, 501, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow()
})
it('bounds streamed responses and propagates authorization without mock fallback', async () => {
  const { job } = fixture(), fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  fetcher.mockResolvedValueOnce(new Response(' '.repeat(256 * 1024 + 1)))
  await expect(api.getJob(job.id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow('Invalid backtest')
  fetcher.mockResolvedValueOnce(reply({ code: 'UNAUTHORIZED' }, 401))
  await expect(api.getJob(job.id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toMatchObject({ status: 401 })
})
it('submits flat exact intent with fresh CSRF and rejects a replay of a different source', async () => {
  const { job } = fixture(), fetcher = vi.fn().mockResolvedValueOnce(reply({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })).mockResolvedValueOnce(reply(job))
  vi.stubGlobal('fetch', fetcher)
  const body = { requestId: job.requestId, strategyId: job.strategyId, revision: job.revision, datasetId: job.datasetId }
  expect(await api.createJob(body, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toEqual(job)
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(body)
  expect(new Headers(fetcher.mock.calls[1][1].headers).get('X-CSRF-TOKEN')).toBe('synthetic')
  fetcher.mockResolvedValueOnce(reply({ headerName: 'X-CSRF-TOKEN', token: 'synthetic2' })).mockResolvedValueOnce(reply({ ...job, datasetId: key(999) }))
  await expect(api.createJob(body, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow()
})
