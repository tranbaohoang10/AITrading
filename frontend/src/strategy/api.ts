import { ApiError, mutate, request } from '../auth/api'

export type Status = 'DRAFT' | 'VALIDATED'
export type Brief = { id: string; revision: number; title: string; status: Status; symbol: string | null; timeframe: string | null; createdAt: string }
export type Document = { canonicalJson: string; hash: string; schemaVersion: string; validatorVersion: string; minimumBars: number }
export type Revision = Omit<Brief, 'id'> & { strategyId: string; draftText: string; canonicalJson: string | null; hash: string | null; schemaVersion: string | null; validatorVersion: string | null; minimumBars: number | null }
export type Validation = { valid: boolean; document: Document | null; errors: { path: string; code: string }[] }
export type Save = { requestId: string; expectedRevision: number; title: string; draftText: string; mode: Status }
export class ValidationError extends ApiError {
  constructor(public validation: Validation) { super(422); this.message = 'Strategy validation failed. The draft has not been saved as validated.' }
}
const invalid = () => new Error('Invalid strategy response. Reload before continuing.')
const object = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid(); return v as Record<string, unknown> }
const text = (v: unknown, max = 65536): string => { if (typeof v !== 'string' || v.length > max) throw invalid(); return v }
const integer = (v: unknown, max = 100): number => { if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > max) throw invalid(); return v }
const id = (v: unknown) => { const value = text(v, 36); if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value)) throw invalid(); return value }
const hash = (v: unknown) => { const value = text(v, 64); if (!/^[0-9a-f]{64}$/.test(value)) throw invalid(); return value }
function document(value: unknown): Document {
  const v = object(value)
  if (v.schemaVersion !== '1.0.0' || v.validatorVersion !== '1.0.0') throw invalid()
  return { canonicalJson: text(v.canonicalJson), hash: hash(v.hash), schemaVersion: v.schemaVersion, validatorVersion: v.validatorVersion, minimumBars: integer(v.minimumBars, 10000) }
}
function common(value: unknown): Omit<Brief, 'id'> {
  const v = object(value), status = v.status
  if (!['DRAFT', 'VALIDATED'].includes(text(status)) || !Number.isFinite(Date.parse(text(v.createdAt, 40))) || !text(v.title, 120)) throw invalid()
  if (status === 'DRAFT' ? v.symbol !== null || v.timeframe !== null : !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/.test(text(v.symbol, 32)) || !['1m', '5m', '15m', '30m', '1h', '4h', '1d'].includes(text(v.timeframe))) throw invalid()
  return { revision: integer(v.revision), title: text(v.title), status: status as Status, symbol: v.symbol as string | null, timeframe: v.timeframe as string | null, createdAt: text(v.createdAt) }
}
function revision(value: unknown, expectedId?: string, expectedRevision?: number): Revision {
  const v = object(value), base = common(v), strategyId = id(v.strategyId)
  if ((expectedId && strategyId !== expectedId) || (expectedRevision && base.revision !== expectedRevision)) throw invalid()
  const result = { ...base, strategyId, draftText: text(v.draftText) }
  if (new TextEncoder().encode(result.draftText).length > 65536) throw invalid()
  if (base.status === 'VALIDATED') return { ...result, ...document(v) }
  for (const key of ['canonicalJson', 'hash', 'schemaVersion', 'validatorVersion', 'minimumBars']) if (v[key] !== null) throw invalid()
  return { ...result, canonicalJson: null, hash: null, schemaVersion: null, validatorVersion: null, minimumBars: null }
}
function validation(value: unknown): Validation {
  const v = object(value)
  if (typeof v.valid !== 'boolean' || !Array.isArray(v.errors) || v.errors.length > 20) throw invalid()
  if (v.valid) { if (v.errors.length) throw invalid(); return { valid: true, document: document(v.document), errors: [] } }
  if (v.document !== null || !v.errors.length) throw invalid()
  return { valid: false, document: null, errors: v.errors.map(value => { const e = object(value); return { path: text(e.path, 512), code: text(e.code, 128) } }) }
}
export async function listStrategies(cursor?: string) {
  const v = object(await (await request(`/strategies?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)).json())
  if (!Array.isArray(v.items) || v.items.length > 20) throw invalid()
  return { items: v.items.map(item => ({ ...common(item), id: id(object(item).id) })), nextCursor: v.nextCursor === null ? null : text(v.nextCursor, 128) }
}
export const getRevision = async (strategy: string, version?: number) => revision(await (await request(`/strategies/${id(strategy)}${version === undefined ? '' : `/versions/${integer(version)}`}`)).json(), strategy, version)
export async function history(strategy: string, before?: number) {
  const v = object(await (await request(`/strategies/${id(strategy)}/versions?limit=20${before === undefined ? '' : `&before=${integer(before, 101)}`}`)).json())
  if (!Array.isArray(v.items) || v.items.length > 20) throw invalid()
  let previous = before ?? 101
  const items = v.items.map(item => { const result = { ...common(item), id: id(object(item).id) }; if (result.id !== strategy || result.revision >= previous) throw invalid(); previous = result.revision; return result })
  const nextBefore = v.nextBefore === null ? null : integer(v.nextBefore)
  if (nextBefore !== null && (!items.length || nextBefore !== previous)) throw invalid()
  return { items, nextBefore }
}
export const createStrategy = async (payload: { requestId: string; title: string }) => revision(await mutate('/strategies', payload), undefined, 1)
export async function saveRevision(strategy: string, payload: Save) {
  try { return revision(await mutate(`/strategies/${id(strategy)}/versions`, payload), strategy, payload.expectedRevision + 1) }
  catch (error) {
    if (error instanceof ApiError && error.status === 422 && error.response) throw new ValidationError(validation(await error.response.json()))
    throw error
  }
}
export const deleteStrategy = (selected: Revision) => mutate(`/strategies/${id(selected.strategyId)}`, { expectedRevision: selected.revision }, 'DELETE')
export async function validateDraft(draft: string): Promise<Validation> {
  if (new TextEncoder().encode(draft).length > 65536) throw new ApiError(413)
  const token = object(await (await request('/auth/csrf')).json())
  if (token.headerName !== 'X-CSRF-TOKEN' || typeof token.token !== 'string') throw invalid()
  try { return validation(await (await request('/dsl/validate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token.token }, body: draft })).json()) }
  catch (error) {
    if (error instanceof ApiError && error.status === 422 && error.response) return validation(await error.response.json())
    if (error instanceof ApiError && error.status === 400) return { valid: false, document: null, errors: [{ path: '', code: 'MALFORMED_JSON' }] }
    throw error
  }
}
