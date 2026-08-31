import { privateRequest } from '../auth/api'
import { request } from '../auth/api'

export type Input = {
  symbol: string; timeframe: string; settlementCurrency: string; side: 'LONG' | 'SHORT'; state: 'OPEN' | 'CLOSED'
  quantity: string; entryPrice: string; exitPrice: string | null; entryFee: string; exitFee: string
  entryTime: string; exitTime: string | null; entryReason: string; notes: string; datasetId: string | null
}
export type Entry = { id: string; version: number; data: Input; grossPnl: string | null; netPnl: string | null; createdAt: string; updatedAt: string }
export type Write = { requestId: string; expectedVersion: number; entry: Input }
export type Saved = { requestId: string; appliedVersion: number; entry: Entry }
export type Filter = { from: string; to: string; zone: string; currency: string }
export type Values = { closed: number; open: number; wins: number; losses: number; breakeven: number; grossPnl: string; fees: string; netPnl: string }
export type Summary = { filter: Filter; totals: Values; days: { date: string; values: Values }[] }
export type Page = { filter: Filter; items: Entry[]; nextCursor: string | null }
const invalid = () => new Error('Invalid journal response. Please reload.')
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown> }
const text = (value: unknown, max = 8000): string => { if (typeof value !== 'string' || value.length > max) throw invalid(); return value }
const integer = (value: unknown, min: number, max: number): number => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw invalid(); return value }
const id = (value: unknown): string => { const s = text(value, 36); if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(s)) throw invalid(); return s }
const timestamp = (value: unknown): string => { const s = text(value, 32); if (!/Z$/.test(s) || !Number.isFinite(Date.parse(s))) throw invalid(); return s }
const decimal = (value: unknown): string => { const s = text(value, 48); if (!/^-?(0|[1-9][0-9]{0,27})(\.[0-9]{1,16})?$/.test(s)) throw invalid(); return s }
const scaled = (value: string) => { const [whole, fraction = ''] = value.replace(/^-/, '').split('.'); return BigInt(whole + fraction.padEnd(16, '0')) * (value.startsWith('-') ? -1n : 1n) }
const date = (value: unknown): string => { const s = text(value, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) throw invalid(); return s }
export const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d']
function entry(value: unknown): Entry {
  const v = object(value), d = object(v.data)
  if (!['LONG', 'SHORT'].includes(text(d.side)) || !['OPEN', 'CLOSED'].includes(text(d.state))
    || !timeframes.includes(text(d.timeframe)) || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/.test(text(d.symbol))
    || !/^[A-Z0-9]{2,12}$/.test(text(d.settlementCurrency))) throw invalid()
  const data: Input = { symbol: text(d.symbol), timeframe: text(d.timeframe), settlementCurrency: text(d.settlementCurrency), side: d.side as Input['side'], state: d.state as Input['state'],
    quantity: decimal(d.quantity), entryPrice: decimal(d.entryPrice), exitPrice: d.exitPrice === null ? null : decimal(d.exitPrice), entryFee: decimal(d.entryFee), exitFee: decimal(d.exitFee),
    entryTime: timestamp(d.entryTime), exitTime: d.exitTime === null ? null : timestamp(d.exitTime), entryReason: text(d.entryReason, 2000), notes: text(d.notes, 4000), datasetId: d.datasetId === null ? null : id(d.datasetId) }
  for (const field of ['quantity', 'entryPrice', 'entryFee', 'exitFee', 'exitPrice'] as const) {
    const amount = data[field]
    if (amount === null) continue
    if (!/^(0|[1-9][0-9]{0,12})(\.[0-9]{1,8})?$/.test(amount) || scaled(amount) > 1000000000000n * 10n ** 16n || (!field.endsWith('Fee') && scaled(amount) === 0n)) throw invalid()
  }
  const grossPnl = v.grossPnl === null ? null : decimal(v.grossPnl), netPnl = v.netPnl === null ? null : decimal(v.netPnl)
  if (data.state === 'OPEN' ? data.exitTime !== null || data.exitPrice !== null || data.exitFee !== '0' || grossPnl !== null || netPnl !== null
    : data.exitTime === null || data.exitPrice === null || grossPnl === null || netPnl === null || Date.parse(data.exitTime) < Date.parse(data.entryTime)) throw invalid()
  return { id: id(v.id), version: integer(v.version, 1, 100), data, grossPnl, netPnl, createdAt: timestamp(v.createdAt), updatedAt: timestamp(v.updatedAt) }
}
const sameFilter = (actual: unknown, expected: Filter): Filter => {
  const v = object(actual)
  for (const key of ['from', 'to', 'zone', 'currency'] as const) if (v[key] !== expected[key]) throw invalid()
  return { ...expected }
}
function values(value: unknown): Values {
  const v = object(value), result = { closed: integer(v.closed, 0, 500), open: integer(v.open, 0, 500), wins: integer(v.wins, 0, 500), losses: integer(v.losses, 0, 500), breakeven: integer(v.breakeven, 0, 500), grossPnl: decimal(v.grossPnl), fees: decimal(v.fees), netPnl: decimal(v.netPnl) }
  if (result.wins + result.losses + result.breakeven !== result.closed || result.closed + result.open > 500 || result.fees.startsWith('-')) throw invalid()
  return result
}
async function body(response: Response): Promise<unknown> {
  // At most50 records × bounded reason/notes; summaries at most366 rows.
  const reader = response.body?.getReader(); if (!reader) throw invalid()
  const chunks: Uint8Array[] = []; let size = 0
  try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 1024 * 1024) { await reader.cancel(); throw invalid() } chunks.push(chunk.value) } }
  finally { reader.releaseLock() }
  const all = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(all)) as unknown
}
const query = (filter: Filter) => new URLSearchParams(filter).toString()
export async function list(filter: Filter, cursor?: string, accountId?: string): Promise<Page> {
  const v = object(await body(await privateRequest(accountId, `/journal?${query(filter)}&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)))
  if (!Array.isArray(v.items) || v.items.length > 20) throw invalid()
  const items = v.items.map(entry)
  if (new Set(items.map(item => item.id)).size !== items.length || items.some(item => item.data.settlementCurrency !== filter.currency)) throw invalid()
  const nextCursor = v.nextCursor === null ? null : text(v.nextCursor, 256)
  if (nextCursor !== null && !/^[A-Za-z0-9_-]+$/.test(nextCursor)) throw invalid()
  return { filter: sameFilter(v.filter, filter), items, nextCursor }
}
export async function summary(filter: Filter, accountId?: string): Promise<Summary> {
  const v = object(await body(await privateRequest(accountId, `/journal/summary?${query(filter)}`)))
  const daysCount = (Date.parse(date(filter.to)) - Date.parse(date(filter.from))) / 86400000 + 1
  if (!Array.isArray(v.days) || daysCount < 1 || daysCount > 366 || v.days.length !== daysCount) throw invalid()
  const days = v.days.map((row, index) => { const day = object(row), expected = new Date(Date.parse(filter.from) + index * 86400000).toISOString().slice(0, 10); if (date(day.date) !== expected) throw invalid(); return { date: expected, values: values(day.values) } })
  const totals = values(v.totals)
  for (const field of ['closed', 'open', 'wins', 'losses', 'breakeven'] as const) if (days.reduce((sum, day) => sum + day.values[field], 0) !== totals[field]) throw invalid()
  for (const field of ['grossPnl', 'fees', 'netPnl'] as const) if (days.reduce((sum, day) => sum + scaled(day.values[field]), 0n) !== scaled(totals[field])) throw invalid()
  for (const value of [totals, ...days.map(day => day.values)]) if (scaled(value.grossPnl) - scaled(value.fees) !== scaled(value.netPnl)) throw invalid()
  return { filter: sameFilter(v.filter, filter), totals, days }
}
export async function get(key: string, accountId?: string): Promise<Entry> {
  const result = entry(await body(await privateRequest(accountId, `/journal/${id(key)}`))); if (result.id !== key) throw invalid(); return result
}
async function mutate(path: string, payload: unknown, accountId: string, method = 'POST') {
  const workspace = id(accountId)
  const csrf = object(await (await request('/auth/csrf')).json())
  if (csrf.headerName !== 'X-CSRF-TOKEN' || typeof csrf.token !== 'string') throw invalid()
  return request(path, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf.token, 'X-Workspace-User': workspace }, body: JSON.stringify(payload) })
}
export async function save(key: string | null, intent: Write, accountId: string): Promise<Saved> {
  const v = object(await body(await mutate(`/journal${key ? `/${id(key)}` : ''}`, intent, accountId))), result = entry(v.entry), appliedVersion = integer(v.appliedVersion, 1, 100)
  if (id(v.requestId) !== intent.requestId || (key !== null && result.id !== key) || appliedVersion !== intent.expectedVersion + 1 || result.version < appliedVersion) throw invalid()
  return { requestId: intent.requestId, appliedVersion, entry: result }
}
export async function remove(selected: Entry, accountId: string): Promise<void> {
  const response = await mutate(`/journal/${id(selected.id)}`, { expectedVersion: selected.version }, accountId, 'DELETE')
  if (response.status !== 204) throw invalid()
}
