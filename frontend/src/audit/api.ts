import { ApiError, currentUser, privateRequest } from '../auth/api'

export type AuditEvent = { id: string; occurredAt: string; requestId: string; category: string; operation: string; method: string; httpStatus: number | null; resourceId: string | null; errorCode: string | null }
export type AuditPage = { items: AuditEvent[]; nextCursor: string | null }
const invalid = () => new Error('Invalid activity response. Please reload.')
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v)
const cursor = (v: unknown): v is string => typeof v === 'string' && /^[1-9][0-9]{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n
const operations = new Set(['LOGIN', 'LOGOUT', 'REGISTER', 'PROFILE', 'PASSWORD', 'AUTH_OTHER', 'CONVERSATIONS', 'DATASETS', 'STRATEGIES', 'BACKTESTS', 'JOURNAL', 'DSL', 'AI', 'AUDIT', 'OTHER', 'JOB_QUEUED', 'JOB_RUNNING', 'JOB_SUCCEEDED', 'JOB_FAILED', 'JOB_CANCELLED', 'JOB_DELETED'])
const codes = new Set(['WORKER_UNCONFIGURED', 'WORKER_RESOURCE_UNAVAILABLE', 'WORKER_TIMEOUT', 'WORKER_OUTPUT_LIMIT', 'WORKER_INVALID_RESULT', 'WORKER_FAILED', 'WORKER_INTERRUPTED', 'QUEUE_EXPIRED', 'JOB_CANCELLED', 'CREDENTIAL_REVOKED', 'SNAPSHOT_INVALID', 'ENGINE_REJECTED'])
export function parsePage(input: unknown, before?: string): AuditPage {
  if (!input || typeof input !== 'object' || !('items' in input) || !Array.isArray(input.items) || input.items.length > 25 || !('nextCursor' in input)) throw invalid()
  const seen = new Set<string>()
  let previous = before
  const items = input.items.map((v: unknown): AuditEvent => {
    if (!v || typeof v !== 'object') throw invalid()
    const e = v as AuditEvent
    if (!cursor(e.id) || seen.has(e.id) || (previous && BigInt(e.id) >= BigInt(previous)) || !uuid(e.requestId)
      || typeof e.occurredAt !== 'string' || e.occurredAt.length > 40 || !e.occurredAt.endsWith('Z') || !Number.isFinite(Date.parse(e.occurredAt))
      || !['AUTH', 'RESOURCE', 'SECURITY', 'JOB'].includes(e.category) || !operations.has(e.operation)
      || !['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE', 'OTHER', 'JOB'].includes(e.method)
      || (e.errorCode !== null && !codes.has(e.errorCode))) throw invalid()
    const job = e.category === 'JOB'
    if (job ? e.method !== 'JOB' || !e.operation.startsWith('JOB_') || e.httpStatus !== null || !uuid(e.resourceId)
      : e.method === 'JOB' || e.operation.startsWith('JOB_') || !Number.isInteger(e.httpStatus) || e.httpStatus! < 100 || e.httpStatus! > 599 || e.resourceId !== null || e.errorCode !== null) throw invalid()
    seen.add(e.id); previous = e.id
    return { id: e.id, occurredAt: e.occurredAt, requestId: e.requestId, category: e.category, operation: e.operation, method: e.method, httpStatus: e.httpStatus, resourceId: e.resourceId, errorCode: e.errorCode }
  })
  const nextCursor = input.nextCursor
  if (nextCursor !== null && (!cursor(nextCursor) || items.length !== 25 || nextCursor !== items.at(-1)?.id)) throw invalid()
  return { items, nextCursor }
}
export async function loadActivity(accountId: string, before?: string): Promise<AuditPage> {
  if (before !== undefined && !cursor(before)) throw invalid()
  const response = await privateRequest(accountId, `/audit?limit=25${before ? `&before=${before}` : ''}`)
  const reader = response.body?.getReader()
  if (!reader) throw invalid()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 65536) throw invalid()
      chunks.push(value)
    }
  } finally { await reader.cancel(); reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  let input: unknown
  try { input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  catch { throw invalid() } // Native parse errors may quote response contents.
  const page = parsePage(input, before)
  try { if ((await currentUser(accountId)).id !== accountId) throw invalid() }
  catch (failure) { if (failure instanceof ApiError) throw failure; throw invalid() }
  return page
}
