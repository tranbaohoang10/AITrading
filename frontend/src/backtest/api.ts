import { mutate, request } from '../auth/api'
import type { Candle } from '../market/api'

export type Job = {
  id: string; requestId: string; strategyId: string; revision: number; strategyTitle: string
  datasetId: string; datasetName: string; symbol: string; timeframe: string; sourceKind: string
  retryOf: string | null; state: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'; errorCode: string | null
  inputHash: string; dslHash: string; dataHash: string; candleCount: number; resultHash: string | null
  createdAt: string; startedAt: string | null; leaseUntil: string; finishedAt: string | null
}
export type Bar = { index: number; openTime: string; closeTime: string; equity: string; balance: string; drawdownPct: string; unrealizedGross: string }
export type Detail = Record<string, string | number | null>
export type Event = Detail & { id: number; barIndex: number; kind: string }
export type Result = {
  bars: Bar[]; events: Event[]; trades: Detail[]; openPosition: Detail | null
  metrics: Record<string, string | number | null>; resultHash: string
  runCard: { inputHash: string; dslHash: string; engineVersion: string; canonicalDsl: string; minimumBars: number; dataset: Detail; policy: Detail; limitations: string[] }
  raw: Record<string, unknown>
}
export type FrozenPage = { jobId: string; inputHash: string; dataHash: string; symbol: string; start: number; total: number; items: Candle[] }
export type Create = { requestId: string; strategyId: string; revision: number; datasetId: string }
export const activeJob = (job: Job) => job.state === 'QUEUED' || job.state === 'RUNNING'
const invalid = () => new Error('Invalid backtest response. Refresh before continuing.')
const obj = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid(); return v as Record<string, unknown> }
const str = (v: unknown, max = 128): string => { if (typeof v !== 'string' || v.length > max) throw invalid(); return v }
const int = (v: unknown, min = 0, max = 5000): number => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) throw invalid(); return v }
const id = (v: unknown) => { const s = str(v, 36); if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s)) throw invalid(); return s }
const hash = (v: unknown) => { const s = str(v, 64); if (!/^[0-9a-f]{64}$/.test(s)) throw invalid(); return s }
const time = (v: unknown) => { const s = str(v, 40); if (!s.endsWith('Z') || !Number.isFinite(Date.parse(s))) throw invalid(); return s }
const decimal = (v: unknown) => { const s = str(v, 1024); if (!/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(s) || !Number.isFinite(Number(s))) throw invalid(); return s }
const array = (v: unknown, max: number): unknown[] => { if (!Array.isArray(v) || v.length > max) throw invalid(); return v }
const optional = <T,>(v: unknown, parse: (v: unknown) => T) => v === null ? null : parse(v)
const interval: Record<string, number> = { '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000, '1h': 3600000, '4h': 14400000, '1d': 86400000 }
function detail(v: unknown): Detail {
  const o = obj(v), result: Detail = {}
  if (Object.keys(o).length > 40) throw invalid()
  for (const [k, value] of Object.entries(o)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(k) || !['string', 'number'].includes(typeof value) && value !== null) throw invalid()
    result[k] = typeof value === 'string' ? str(value, 1024) : value === null ? null : int(value, -1, 20000)
  }
  return result
}
export function parseJob(value: unknown, expected?: string): Job {
  const v = obj(value), key = id(v.id), state = str(v.state) as Job['state']
  if (expected && key !== expected || !['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED'].includes(state)
    || !Object.hasOwn(interval, str(v.timeframe)) || !['SYNTHETIC', 'USER_UPLOAD'].includes(str(v.sourceKind))) throw invalid()
  const result: Job = { id: key, requestId: id(v.requestId), strategyId: id(v.strategyId), revision: int(v.revision, 1, 100), strategyTitle: str(v.strategyTitle, 120),
    datasetId: id(v.datasetId), datasetName: str(v.datasetName, 120), symbol: str(v.symbol, 32), timeframe: str(v.timeframe), sourceKind: str(v.sourceKind),
    retryOf: optional(v.retryOf, id), state, errorCode: optional(v.errorCode, x => { const s = str(x, 48); if (!/^[A-Z_]+$/.test(s)) throw invalid(); return s }),
    inputHash: hash(v.inputHash), dslHash: hash(v.dslHash), dataHash: hash(v.dataHash), candleCount: int(v.candleCount, 1), resultHash: optional(v.resultHash, hash),
    createdAt: time(v.createdAt), startedAt: optional(v.startedAt, time), leaseUntil: time(v.leaseUntil), finishedAt: optional(v.finishedAt, time) }
  if (state === 'SUCCEEDED' ? !result.resultHash || !result.finishedAt || result.errorCode !== null : result.resultHash !== null) throw invalid()
  return result
}
function position(value: unknown, bars: Bar[], closed: boolean): Detail {
  const v = detail(value), entry = int(v.entryBar, 0, bars.length - 1)
  if (!['long', 'short'].includes(str(v.side)) || time(v.entryTime) !== bars[entry].openTime) throw invalid()
  for (const key of ['quantity', 'entryPrice', 'entryFee', 'margin', 'entryNotional', 'stopPrice', 'takeProfitPrice']) decimal(v[key])
  if (closed) {
    const exit = int(v.exitBar, entry, bars.length - 1)
    for (const key of ['exitPrice', 'exitFee', 'grossPnl', 'netPnl']) decimal(v[key])
    if (v.exitTimePrecision === 'OPEN' ? time(v.exitTime) !== bars[exit].openTime : v.exitTimePrecision !== 'BAR_INTERVAL' || v.exitTime !== null) throw invalid()
  } else { decimal(v.markPrice); decimal(v.unrealizedGross); if (time(v.markTime) !== bars.at(-1)!.closeTime) throw invalid() }
  return v
}
export function parseResult(value: unknown, job: Job): Result {
  const v = obj(value), card = obj(v.runCard), source = obj(card.dataset)
  if (job.state !== 'SUCCEEDED' || hash(v.resultHash) !== job.resultHash || hash(card.inputHash) !== job.inputHash || hash(card.dslHash) !== job.dslHash
    || hash(source.dataHash) !== job.dataHash || source.symbol !== job.symbol || source.timeframe !== job.timeframe || source.count !== job.candleCount
    || source.sourceType !== job.sourceKind || source.timezone !== 'UTC' || source.sourceVerified !== false) throw invalid()
  for (const k of ['engineVersion', 'protocolVersion', 'schemaVersion', 'validatorVersion']) if (card[k] !== '1.0.0') throw invalid()
  let previous: Bar | undefined
  const bars = array(v.bars, 5000).map((value, i) => {
    const b = obj(value)
    const bar = { index: int(b.index), openTime: time(b.openTime), closeTime: time(b.closeTime), equity: decimal(b.equity), balance: decimal(b.balance), drawdownPct: decimal(b.drawdownPct), unrealizedGross: decimal(b.unrealizedGross) }
    if (bar.index !== i || Date.parse(bar.closeTime) - Date.parse(bar.openTime) !== interval[job.timeframe] || previous && bar.openTime !== previous.closeTime) throw invalid()
    previous = bar; return bar
  })
  if (bars.length !== job.candleCount || source.start !== bars[0].openTime || source.end !== bars.at(-1)!.openTime || source.closedThrough !== bars.at(-1)!.closeTime) throw invalid()
  const events = array(v.events, bars.length * 4).map((value, i) => {
    const e = detail(value), kind = str(e.kind), barIndex = int(e.barIndex, 0, bars.length - 1), eventId = int(e.id, 1, 20000)
    if (eventId !== i + 1 || !['SIGNAL', 'ENTRY', 'EXIT', 'SKIP'].includes(kind)) throw invalid()
    if (kind === 'SIGNAL' && (e.signalTime !== bars[barIndex].closeTime || e.confirmationTime !== e.signalTime)) throw invalid()
    if (kind === 'ENTRY' || kind === 'EXIT') {
      decimal(e.price)
      if (e.timePrecision === 'OPEN' ? e.executionTime !== bars[barIndex].openTime : kind !== 'EXIT' || e.timePrecision !== 'BAR_INTERVAL' || e.executionTime !== null
        || e.barOpenTime !== bars[barIndex].openTime || e.barCloseTime !== bars[barIndex].closeTime) throw invalid()
    }
    return { ...e, id: eventId, kind, barIndex }
  })
  const trades = array(v.trades, bars.length).map(value => position(value, bars, true))
  const metrics = detail(v.metrics)
  for (const k of ['initialCapital', 'finalBalance', 'finalEquity', 'netProfit', 'returnPct', 'closedNetPnl', 'totalFees', 'maxDrawdownPct']) decimal(metrics[k])
  for (const k of ['winRatePct', 'profitFactor']) optional(metrics[k], decimal)
  if (int(metrics.closedTrades) !== trades.length || int(metrics.winningTrades) + int(metrics.losingTrades) + int(metrics.breakevenTrades) !== trades.length
    || metrics.finalEquity !== bars.at(-1)!.equity || metrics.finalBalance !== bars.at(-1)!.balance || !trades.length && metrics.winRatePct !== null) throw invalid()
  const policy = detail(card.policy)
  for (const k of ['commissionBps', 'slippageBps', 'spreadBps']) decimal(policy[k])
  if (policy.fill !== 'next_bar_open' || policy.signal !== 'bar_close' || obj(v.termination).reason !== 'DATASET_END') throw invalid()
  // Preserve the server-verified complete document for export; only parsed fields drive UI.
  return { bars, events, trades, openPosition: v.openPosition === null ? null : position(v.openPosition, bars, false), metrics, resultHash: hash(v.resultHash), raw: v,
    runCard: { inputHash: hash(card.inputHash), dslHash: hash(card.dslHash), engineVersion: str(card.engineVersion), canonicalDsl: str(card.canonicalDsl, 65536),
      minimumBars: int(card.minimumBars, 1, 10000), dataset: { ...detail(Object.fromEntries(Object.entries(source).filter(([k]) => k !== 'sourceVerified'))), sourceVerified: 'false' },
      policy, limitations: array(card.limitations, 20).map(s => str(s, 512)) } }
}
async function json(path: string, maximum = 256 * 1024): Promise<unknown> {
  const response = await request(path), reader = response.body?.getReader()
  if (!reader) throw invalid()
  const chunks: Uint8Array[] = []; let size = 0
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maximum) throw invalid(); chunks.push(value) } }
  finally { await reader.cancel(); reader.releaseLock() }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}
export async function listJobs(cursor?: string) {
  const v = obj(await json(`/backtests?limit=20${cursor ? `&cursor=${encodeURIComponent(str(cursor))}` : ''}`))
  return { items: array(v.items, 20).map(x => parseJob(x)), nextCursor: optional(v.nextCursor, x => str(x)) }
}
export const getJob = async (key: string) => parseJob(await json(`/backtests/${id(key)}`), key)
export const getResult = async (job: Job) => parseResult(await json(`/backtests/${id(job.id)}/result`, 32 * 1024 * 1024), job)
export async function getCandles(job: Job, result: Result, start: number, limit = 100): Promise<FrozenPage> {
  int(start, 0, job.candleCount); int(limit, 1, 500)
  const v = obj(await json(`/backtests/${id(job.id)}/candles?start=${start}&limit=${limit}`))
  if (v.jobId !== job.id || v.inputHash !== job.inputHash || v.dataHash !== job.dataHash || v.symbol !== job.symbol || v.start !== start || v.total !== job.candleCount) throw invalid()
  const items = array(v.items, limit).map((value, index) => {
    const c = obj(value), ordinal = int(c.ordinal, 0, job.candleCount - 1)
    if (ordinal !== start + index || time(c.time) !== result.bars[ordinal].openTime) throw invalid()
    const candle = { ordinal, time: time(c.time), open: decimal(c.open), high: decimal(c.high), low: decimal(c.low), close: decimal(c.close), volume: decimal(c.volume) }
    const prices = [candle.open, candle.high, candle.low, candle.close].map(Number)
    if (prices.some(n => n <= 0 || n > 1e12) || Number(candle.volume) < 0 || Number(candle.volume) > 1e12 || prices[1] < Math.max(...prices) || prices[2] > Math.min(...prices)) throw invalid()
    return candle
  })
  if (items.length !== Math.min(limit, job.candleCount - start)) throw invalid()
  return { jobId: job.id, inputHash: job.inputHash, dataHash: job.dataHash, symbol: job.symbol, start, total: job.candleCount, items }
}
export async function capabilities() { const v = obj(await json('/backtests/capabilities')); if (typeof v.configured !== 'boolean') throw invalid(); return v.configured }
export async function createJob(body: Create) {
  const job = parseJob(await mutate('/backtests', body))
  if (job.requestId !== body.requestId || job.strategyId !== body.strategyId || job.revision !== body.revision || job.datasetId !== body.datasetId || job.retryOf !== null) throw invalid()
  return job
}
export async function retryJob(old: Job, requestId: string) {
  const job = parseJob(await mutate(`/backtests/${id(old.id)}/retry`, { requestId }))
  if (job.requestId !== requestId || job.retryOf !== old.id || job.inputHash !== old.inputHash) throw invalid()
  return job
}
export const cancelJob = async (job: Job) => parseJob(await mutate(`/backtests/${id(job.id)}/cancel`, {}), job.id)
export const deleteJob = (job: Job) => mutate(`/backtests/${id(job.id)}`, {}, 'DELETE')
