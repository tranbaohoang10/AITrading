import { ApiError, request } from '../auth/api'

export type AiConfiguration = { configured: boolean; provider: 'openai'; model: string | null }
export type AiIntent = { conversationId: string; requestId: string; expectedVersion: number; sourceSequence: number }
export type AiTurn = AiIntent & { state: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'; errorCode: string | null; provider: 'openai'; model: string; assistantSequence: number | null; contextStart: number; contextEnd: number; contextCount: number; contextHash: string; createdAt: string; expiresAt: string; updatedAt: string }
const invalid = () => new Error('Invalid AI service response. Check status before retrying.')
const object = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid(); return v as Record<string, unknown> }
const id = (v: unknown): string => { if (typeof v !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v)) throw invalid(); return v }
const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER): number => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 1 || v > max) throw invalid(); return v }
const date = (v: unknown): string => { if (typeof v !== 'string' || !Number.isFinite(Date.parse(v))) throw invalid(); return v }
const model = (v: unknown): string => { if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v)) throw invalid(); return v }
export class AiUnconfigured extends Error { constructor() { super('AI is not configured on the server. Saved messages remain available.') } }
export function aiFailure(code: string | null): string {
  const messages: Record<string, string> = {
    AI_REFUSED: 'The provider declined this request. No assistant reply was saved.',
    AI_TIMEOUT: 'The provider timed out. No assistant reply was saved.',
    AI_CANCELLED: 'AI request cancelled. A request already sent to the provider may still incur usage.',
    AI_EXPIRED: 'The request expired without a saved reply. Retry explicitly if needed.',
    AI_STALE_CONTEXT: 'The conversation changed while AI was answering. The outdated reply was discarded.',
    AI_BUSY: 'The server is busy with other AI requests. Try again later.',
    AI_RATE_LIMITED: 'The provider rate limit was reached. Try again later.',
    AI_PROVIDER_AUTH: 'The server provider credentials were rejected. Contact the project operator.',
    AI_INCOMPLETE: 'The provider returned an incomplete answer. Nothing was saved.',
    AI_RESPONSE_LIMIT: 'The provider response exceeded the safety limit. Nothing was saved.',
    AI_INVALID_RESPONSE: 'The provider response failed validation. Nothing was saved.',
    AI_PROVIDER_REJECTED: 'The provider rejected the configured request. Nothing was saved.',
    AI_PROVIDER_UNAVAILABLE: 'The provider is unavailable. Nothing was saved.',
  }
  return code && messages[code] ? messages[code] : 'AI request failed. No assistant reply was saved.'
}
function turn(value: unknown, expected: AiIntent): AiTurn {
  const v = object(value)
  if (!['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED'].includes(String(v.state)) || v.provider !== 'openai'
    || (v.errorCode !== null && (typeof v.errorCode !== 'string' || !/^AI_[A-Z_]{1,28}$/.test(v.errorCode)))) throw invalid()
  const result: AiTurn = { conversationId: id(v.conversationId), requestId: id(v.requestId), expectedVersion: integer(v.expectedVersion), sourceSequence: integer(v.sourceSequence, 1999),
    state: v.state as AiTurn['state'], errorCode: v.errorCode as string | null, provider: 'openai', model: model(v.model),
    assistantSequence: v.assistantSequence === null ? null : integer(v.assistantSequence, 2000), contextStart: integer(v.contextStart, 1999),
    contextEnd: integer(v.contextEnd, 1999), contextCount: integer(v.contextCount, 20), contextHash: typeof v.contextHash === 'string' ? v.contextHash : '',
    createdAt: date(v.createdAt), expiresAt: date(v.expiresAt), updatedAt: date(v.updatedAt) }
  if (result.conversationId !== expected.conversationId || result.requestId !== expected.requestId || result.expectedVersion !== expected.expectedVersion || result.sourceSequence !== expected.sourceSequence
    || result.contextEnd !== result.sourceSequence || result.contextStart > result.contextEnd || result.contextEnd - result.contextStart + 1 !== result.contextCount
    || !/^[0-9a-f]{64}$/.test(result.contextHash)) throw invalid()
  if (result.state === 'SUCCEEDED' ? result.assistantSequence !== result.sourceSequence + 1 || result.errorCode !== null
    : result.assistantSequence !== null || (result.state === 'PENDING' ? result.errorCode !== null : result.errorCode === null)) throw invalid()
  return result
}
export async function getAiConfiguration(): Promise<AiConfiguration> {
  const v = object(await (await request('/ai/capabilities')).json())
  if (typeof v.configured !== 'boolean' || v.provider !== 'openai' || (!v.configured && v.model !== null)) throw invalid()
  return { configured: v.configured, provider: 'openai', model: v.configured ? model(v.model) : null }
}
const route = (intent: AiIntent) => `/conversations/${id(intent.conversationId)}/ai-turns`
async function post(path: string, body: object) {
  const token = object(await (await request('/auth/csrf')).json())
  if (token.headerName !== 'X-CSRF-TOKEN' || typeof token.token !== 'string') throw invalid()
  try {
    return await (await request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token.token }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) })).json()
  } catch (error) {
    if (error instanceof ApiError && error.status === 503 && error.response) {
      const details: unknown = await error.response.clone().json().catch(() => null)
      if (details && typeof details === 'object' && 'code' in details && details.code === 'AI_UNCONFIGURED') throw new AiUnconfigured()
    }
    throw error
  }
}
export async function startAi(intent: AiIntent): Promise<AiTurn> {
  const payload = { requestId: id(intent.requestId), expectedVersion: integer(intent.expectedVersion), sourceSequence: integer(intent.sourceSequence, 1999) }
  return turn(await post(route(intent), payload), intent)
}
export async function getAiTurn(intent: AiIntent): Promise<AiTurn> { return turn(await (await request(`${route(intent)}/${id(intent.requestId)}`)).json(), intent) }
export async function getLatestAiTurn(conversationId: string): Promise<AiTurn | null> {
  const response = await request(`/conversations/${id(conversationId)}/ai-turns`)
  if (response.status === 204) return null
  const value = object(await response.json())
  return turn(value, { conversationId, requestId: id(value.requestId), expectedVersion: integer(value.expectedVersion), sourceSequence: integer(value.sourceSequence, 1999) })
}
export async function cancelAiTurn(intent: AiIntent): Promise<AiTurn> { return turn(await post(`${route(intent)}/${id(intent.requestId)}/cancel`, {}), intent) }
