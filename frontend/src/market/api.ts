import { ApiError, mutate, request } from '../auth/api'

export type Dataset = {
  id: string; name: string; symbol: string; timeframe: string; timezone: 'UTC'
  sourceKind: 'USER_UPLOAD' | 'SYNTHETIC'; sourceLabel: string; rawHash: string; dataHash: string
  formatVersion: 'ohlcv-v1'; candleCount: number; gapCount: number; firstTime: string; lastTime: string; createdAt: string
}
export type Candle = { ordinal: number; time: string; open: string; high: string; low: string; close: string; volume: string }
export type CandlePage = { dataset: Dataset; start: number; total: number; items: Candle[] }
export type ImportDraft = { name: string; symbol: string; timeframe: string; sourceKind: Dataset['sourceKind']; sourceLabel: string; csv: string }
export type ImportRequest = ImportDraft & { requestId: string }
export class CsvError extends ApiError {
  constructor(public line: number, public code: string) {
    super(422)
    this.message = `CSV validation failed${line ? ` at line ${line}` : ''} (${code}). Check the import format.`
  }
}
const invalid = () => new Error('Invalid market-data response. Please reload.')
const object = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid(); return v as Record<string, unknown> }
const text = (v: unknown): string => { if (typeof v !== 'string') throw invalid(); return v }
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < min || v > max) throw invalid(); return v }
const id = (v: unknown) => { const s = text(v); if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s)) throw invalid(); return s }
const hash = (v: unknown) => { const s = text(v); if (!/^[0-9a-f]{64}$/.test(s)) throw invalid(); return s }
const time = (v: unknown) => { const s = text(v); if (!Number.isFinite(Date.parse(s))) throw invalid(); return s }
const decimal = (v: unknown, zero = false) => {
  const s = text(v)
  if (!/^[0-9]{1,13}(\.[0-9]{1,8})?$/.test(s) || !Number.isFinite(Number(s)) || Number(s) > 1e12 || (zero ? Number(s) < 0 : Number(s) <= 0)) throw invalid()
  return s
}
function dataset(value: unknown): Dataset {
  const v = object(value)
  if (v.timezone !== 'UTC' || v.formatVersion !== 'ohlcv-v1' || (v.sourceKind !== 'USER_UPLOAD' && v.sourceKind !== 'SYNTHETIC')
    || !['1m', '5m', '15m', '30m', '1h', '4h', '1d'].includes(text(v.timeframe))) throw invalid()
  return { id: id(v.id), name: text(v.name), symbol: text(v.symbol), timeframe: text(v.timeframe), timezone: 'UTC', sourceKind: v.sourceKind,
    sourceLabel: text(v.sourceLabel), rawHash: hash(v.rawHash), dataHash: hash(v.dataHash), formatVersion: 'ohlcv-v1', candleCount: integer(v.candleCount, 1, 5000),
    gapCount: integer(v.gapCount), firstTime: time(v.firstTime), lastTime: time(v.lastTime), createdAt: time(v.createdAt) }
}
export async function listDatasets(cursor?: string): Promise<{ items: Dataset[]; nextCursor: string | null }> {
  const v = object(await (await request(`/datasets?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)).json())
  if (!Array.isArray(v.items) || v.items.length > 20) throw invalid()
  return { items: v.items.map(dataset), nextCursor: v.nextCursor === null ? null : text(v.nextCursor) }
}
export async function candles(selected: Dataset, limit: number, start?: number): Promise<CandlePage> {
  const v = object(await (await request(`/datasets/${id(selected.id)}/candles?limit=${integer(limit, 1, 500)}${start === undefined ? '' : `&start=${integer(start, 0, selected.candleCount)}`}`)).json())
  const meta = dataset(v.dataset), from = integer(v.start, 0, meta.candleCount), total = integer(v.total, 1, 5000)
  if (meta.id !== selected.id || meta.dataHash !== selected.dataHash || total !== meta.candleCount || total !== selected.candleCount
    || from !== (start ?? Math.max(0, total - limit)) || !Array.isArray(v.items)
    || v.items.length !== Math.min(limit, total - from)) throw invalid()
  let previous = -Infinity
  const items = v.items.map((item, index) => {
    const c = object(item), timestamp = time(c.time), ordinal = integer(c.ordinal, 0, 4999)
    if (ordinal !== from + index || Date.parse(timestamp) <= previous) throw invalid()
    previous = Date.parse(timestamp)
    const candle = { ordinal, time: timestamp, open: decimal(c.open), high: decimal(c.high), low: decimal(c.low), close: decimal(c.close), volume: decimal(c.volume, true) }
    if (Number(candle.high) < Math.max(Number(candle.open), Number(candle.close), Number(candle.low)) || Number(candle.low) > Math.min(Number(candle.open), Number(candle.close))) throw invalid()
    return candle
  })
  return { dataset: meta, start: from, total, items }
}
export async function importDataset(payload: ImportRequest): Promise<Dataset> {
  try { return dataset(await mutate('/datasets/import', payload)) }
  catch (error) {
    if (error instanceof ApiError && error.status === 422 && error.response) {
      try {
        const body = object(await error.response.json())
        const line = integer(body.line, 0, 5002), code = text(body.code)
        if (/^CSV_[A-Z_]{1,40}$/.test(code)) throw new CsvError(line, code)
      } catch (detail) { if (detail instanceof CsvError) throw detail }
    }
    throw error
  }
}
export const deleteDataset = (value: Dataset) => mutate(`/datasets/${id(value.id)}`, { expectedDataHash: value.dataHash }, 'DELETE')
