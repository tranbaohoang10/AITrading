import { ApiError, privateRequest, request } from '../auth/api'
import { boundedJson } from '../chat/aiApi'

export type Proposal = { kind: 'proposal' | 'clarification'; explanation: string; assumptions: string[]; questions: string[]; dslJson: string | null }
export type GenerationState = 'PENDING' | 'READY' | 'CLARIFICATION' | 'FAILED' | 'CANCELLED' | 'REJECTED' | 'ACCEPTED'
export type Generation = { strategyId: string; requestId: string; conversationId: string; expectedRevision: number; expectedConversationVersion: number; sourceSequence: number;
  contextStart: number; contextCount: number; contextHash: string; provider: 'gemini' | 'openai'; model: string; state: GenerationState; errorCode: string | null;
  proposal: Proposal | null; dslHash: string | null; acceptedRevision: number | null; createdAt: string; expiresAt: string; updatedAt: string }
export type GenerationIntent = { strategyId: string; requestId: string; conversationId: string; expectedRevision: number; expectedConversationVersion: number; sourceSequence: number }

const invalid = () => new Error('Invalid strategy generation response. Check status before retrying.')
const uuid = (v: unknown) => { if (typeof v !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(v)) throw invalid(); return v }
const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER) => { if (!Number.isSafeInteger(v) || (v as number) < 1 || (v as number) > max) throw invalid(); return v as number }
const text = (v: unknown, max: number) => { if (typeof v !== 'string' || !v.trim() || v.length > max) throw invalid(); return v }
const date = (v: unknown) => { const value = text(v, 64); if (!Number.isFinite(Date.parse(value))) throw invalid(); return value }
const object = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid(); return v as Record<string, unknown> }
const exact = (v: Record<string, unknown>, keys: string[]) => { if (Object.keys(v).sort().join() !== [...keys].sort().join()) throw invalid() }
const strings = (v: unknown) => { if (!Array.isArray(v) || v.length > 5 || v.some(x => typeof x !== 'string' || !x.trim() || x.length > 160)) throw invalid(); return [...v] as string[] }
function parseProposal(v: unknown): Proposal | null {
  if (v === null) return null
  const p = object(v); exact(p, ['kind', 'explanation', 'assumptions', 'questions', 'dslJson'])
  if (p.kind !== 'proposal' && p.kind !== 'clarification') throw invalid()
  const result: Proposal = { kind: p.kind, explanation: text(p.explanation, 1500), assumptions: strings(p.assumptions), questions: strings(p.questions), dslJson: p.dslJson === null ? null : text(p.dslJson, 65536) }
  if ((result.kind === 'proposal' && (!result.dslJson || result.questions.length)) || (result.kind === 'clarification' && (result.dslJson !== null || !result.questions.length))) throw invalid()
  return result
}
function parse(v: unknown): Generation {
  const x = object(v); exact(x, ['strategyId','requestId','conversationId','expectedRevision','expectedConversationVersion','sourceSequence','contextStart','contextCount','contextHash','provider','model','state','errorCode','proposal','dslHash','acceptedRevision','createdAt','expiresAt','updatedAt'])
  if (!['PENDING','READY','CLARIFICATION','FAILED','CANCELLED','REJECTED','ACCEPTED'].includes(String(x.state)) || !['gemini','openai'].includes(String(x.provider))) throw invalid()
  if (x.errorCode !== null && (typeof x.errorCode !== 'string' || !/^AI_[A-Z_]{1,29}$/.test(x.errorCode))) throw invalid()
  if (x.dslHash !== null && (typeof x.dslHash !== 'string' || !/^[0-9a-f]{64}$/.test(x.dslHash))) throw invalid()
  const proposal = parseProposal(x.proposal), accepted = x.acceptedRevision === null ? null : integer(x.acceptedRevision, 100)
  if ((x.state === 'READY' || x.state === 'ACCEPTED') && (!proposal || proposal.kind !== 'proposal' || !x.dslHash)) throw invalid()
  if (x.state === 'CLARIFICATION' && (!proposal || proposal.kind !== 'clarification')) throw invalid()
  if (typeof x.contextHash !== 'string' || !/^[0-9a-f]{64}$/.test(x.contextHash)) throw invalid()
  return { strategyId: uuid(x.strategyId), requestId: uuid(x.requestId), conversationId: uuid(x.conversationId), expectedRevision: integer(x.expectedRevision,100),
    expectedConversationVersion: integer(x.expectedConversationVersion), sourceSequence: integer(x.sourceSequence,1999), contextStart: integer(x.contextStart,1999), contextCount: integer(x.contextCount,20), contextHash: x.contextHash,
    provider: x.provider as 'gemini'|'openai', model: text(x.model,128), state: x.state as GenerationState, errorCode: x.errorCode as string|null, proposal, dslHash: x.dslHash as string|null,
    acceptedRevision: accepted, createdAt: date(x.createdAt), expiresAt: date(x.expiresAt), updatedAt: date(x.updatedAt) }
}
async function post(path: string, body: object, accountId?: string) {
  const token = object(await boundedJson(await request('/auth/csrf')))
  if (token.headerName !== 'X-CSRF-TOKEN' || typeof token.token !== 'string') throw invalid()
  return boundedJson(await privateRequest(accountId, path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token.token }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) }), 524288)
}
const route = (strategyId: string) => `/strategies/${uuid(strategyId)}/generations`
export async function start(intent: GenerationIntent, accountId?: string) { return parse(await post(route(intent.strategyId), { requestId: uuid(intent.requestId), expectedRevision: integer(intent.expectedRevision,100), conversationId: uuid(intent.conversationId), expectedConversationVersion: integer(intent.expectedConversationVersion), sourceSequence: integer(intent.sourceSequence,1999) }, accountId)) }
export async function get(intent: GenerationIntent, accountId?: string) { return parse(await boundedJson(await privateRequest(accountId, `${route(intent.strategyId)}/${uuid(intent.requestId)}`), 524288)) }
export async function latest(strategyId: string, accountId?: string) { const response=await privateRequest(accountId,route(strategyId)); return response.status===204?null:parse(await boundedJson(response,524288)) }
export async function decide(value: Generation, action: 'accept'|'reject'|'cancel', accountId?: string) { return parse(await post(`${route(value.strategyId)}/${uuid(value.requestId)}/${action}`,{},accountId)) }
export const definite = (e: unknown) => e instanceof ApiError && [400,401,403,404,409,429].includes(e.status)
export const failure = (code: string | null) => code ? `Strategy proposal failed (${code}). Check status before retrying.` : ''
