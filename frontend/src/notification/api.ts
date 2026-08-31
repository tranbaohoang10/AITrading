import { ApiError, currentUser, privateRequest, request, workspaceHeaders } from '../auth/api'

export type Notice = { id: string; jobId: string; state: 'SUCCEEDED' | 'FAILED' | 'CANCELLED'; errorCode: string | null; createdAt: string; readAt: string | null }
export type NoticePage = { items: Notice[]; nextCursor: string | null; unreadCount: number }
const invalid = () => new Error('Invalid notification response. Please refresh.')
const id = (v: unknown): v is string => typeof v === 'string' && /^[1-9][0-9]{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v)
const time = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && v.endsWith('Z') && Number.isFinite(Date.parse(v))
const codes = new Set(['WORKER_UNCONFIGURED', 'WORKER_RESOURCE_UNAVAILABLE', 'WORKER_TIMEOUT', 'WORKER_OUTPUT_LIMIT', 'WORKER_INVALID_RESULT', 'WORKER_FAILED', 'WORKER_INTERRUPTED', 'QUEUE_EXPIRED', 'JOB_CANCELLED', 'CREDENTIAL_REVOKED', 'SNAPSHOT_INVALID', 'ENGINE_REJECTED'])
export function parseNotice(value: unknown): Notice {
  if (!value || typeof value !== 'object') throw invalid()
  const v = value as Notice
  if (!id(v.id) || !uuid(v.jobId) || !['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(v.state) || !time(v.createdAt)
    || (v.readAt !== null && !time(v.readAt)) || (v.state === 'SUCCEEDED' ? v.errorCode !== null : !codes.has(v.errorCode!))) throw invalid()
  return { id: v.id, jobId: v.jobId, state: v.state, errorCode: v.errorCode, createdAt: v.createdAt, readAt: v.readAt }
}
export function parsePage(value: unknown, before?: string): NoticePage {
  if (!value || typeof value !== 'object') throw invalid()
  const v = value as NoticePage
  if (!Array.isArray(v.items) || v.items.length > 25 || !Number.isSafeInteger(v.unreadCount) || v.unreadCount < 0) throw invalid()
  const items = v.items.map(parseNotice), jobs = new Set<string>()
  let previous = before
  for (const item of items) {
    if ((previous && BigInt(item.id) >= BigInt(previous)) || jobs.has(item.jobId)) throw invalid()
    previous = item.id; jobs.add(item.jobId)
  }
  if (v.nextCursor !== null && (!id(v.nextCursor) || items.length !== 25 || v.nextCursor !== items.at(-1)?.id)) throw invalid()
  if (items.filter(x => !x.readAt).length > v.unreadCount) throw invalid()
  return { items, nextCursor: v.nextCursor, unreadCount: v.unreadCount }
}
async function json(response: Response): Promise<unknown> {
  const reader = response.body?.getReader()
  if (!reader) throw invalid()
  let size = 0
  const chunks: Uint8Array[] = []
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
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown }
  catch { throw invalid() }
}
async function verifyAccount(accountId: string) {
  try { if ((await currentUser(accountId)).id !== accountId) throw new ApiError(401) }
  catch (failure) { if (failure instanceof ApiError) throw failure; throw invalid() }
}
export async function listNotices(accountId: string, before?: string): Promise<NoticePage> {
  if (before !== undefined && !id(before)) throw invalid()
  const page = parsePage(await json(await privateRequest(accountId, `/backtests/notifications?limit=25${before ? `&before=${before}` : ''}`)), before)
  await verifyAccount(accountId)
  return page
}
export async function markRead(accountId: string, notice: Notice): Promise<Notice> {
  if (!id(notice.id)) throw invalid()
  const headers = workspaceHeaders(accountId)
  const token = await json(await request('/auth/csrf')) as { headerName?: unknown; token?: unknown }
  if (!token || token.headerName !== 'X-CSRF-TOKEN' || typeof token.token !== 'string') throw invalid()
  headers.set('Content-Type', 'application/json'); headers.set(token.headerName, token.token)
  const result = parseNotice(await json(await privateRequest(accountId, `/backtests/notifications/${notice.id}/read`, { method: 'POST', headers, body: '{}' })))
  if (result.id !== notice.id || result.jobId !== notice.jobId || result.state !== notice.state || result.errorCode !== notice.errorCode
    || result.createdAt !== notice.createdAt || !result.readAt || (notice.readAt && result.readAt !== notice.readAt)) throw invalid()
  await verifyAccount(accountId)
  return result
}
