// Synthetic test fixtures only. Never imported by application components.
import fixtures from './test-fixtures.json'
import { parseJob, parseResult, type Job, type FrozenPage } from './api'
export { fixtures }
export const key = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
export function fixture(name: keyof typeof fixtures = 'win', n = 1) {
  const value = fixtures[name], c = value.result.runCard
  const job: Job = parseJob({ id: key(n), requestId: key(n + 10), strategyId: key(100), revision: 2, strategyTitle: '<script>inert</script> research',
    datasetId: key(200), datasetName: 'Synthetic three bars', symbol: 'TEST_USD', timeframe: '1h', sourceKind: 'SYNTHETIC', retryOf: null,
    state: 'SUCCEEDED', errorCode: null, inputHash: c.inputHash, dslHash: c.dslHash, dataHash: c.dataset.dataHash, candleCount: 3, resultHash: value.result.resultHash,
    createdAt: '2024-01-02T00:00:00Z', startedAt: '2024-01-02T00:00:01Z', leaseUntil: '2024-01-02T00:01:01Z', finishedAt: '2024-01-02T00:00:02Z' })
  const result = parseResult(value.result, job)
  const page: FrozenPage = { jobId: job.id, inputHash: job.inputHash, dataHash: job.dataHash, symbol: job.symbol, start: 0, total: 3,
    items: value.input.dataset.candles.map((c, ordinal) => ({ ordinal, time: c.timestamp, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })) }
  return { job, result, page, input: value.input }
}
