import { ApiError, privateRequest, request, workspaceHeaders } from '../auth/api'
import type { Revision } from '../strategy/api'

export const generatorVersion = 'mql5-research-1.0.0'
export type Artifact = {
  strategyId: string; revision: number; dslHash: string; schemaVersion: string; validatorVersion: string
  generatorVersion: string; codeHash: string; code: string; createdAt: string; limitations: string[]
}
const invalid = () => new Error('Invalid MQL5 export response. Reload before continuing.')
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
const text = (value: unknown, max: number) => { if (typeof value !== 'string' || !value.length || value.length > max) throw invalid(); return value }
export async function parseArtifact(value: unknown, source: Revision): Promise<Artifact> {
  const v = object(value)
  if (source.status !== 'VALIDATED' || v.strategyId !== source.strategyId || v.revision !== source.revision || v.dslHash !== source.hash
    || v.schemaVersion !== source.schemaVersion || v.validatorVersion !== source.validatorVersion || v.generatorVersion !== generatorVersion) throw invalid()
  const code = text(v.code, 131072), codeHash = text(v.codeHash, 64), createdAt = text(v.createdAt, 40)
  const bytes = new TextEncoder().encode(code)
  if (bytes.length > 131072 || !code.startsWith('#property strict\n') || !/^[0-9a-f]{64}$/.test(codeHash) || !createdAt.endsWith('Z') || !Number.isFinite(Date.parse(createdAt))) throw invalid()
  if (!globalThis.crypto?.subtle) throw new Error('MQL5 integrity verification requires HTTPS or localhost.')
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  if (Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('') !== codeHash) throw invalid()
  if (!Array.isArray(v.limitations) || !v.limitations.length || v.limitations.length > 10) throw invalid()
  return { strategyId: source.strategyId, revision: source.revision, dslHash: source.hash!, schemaVersion: source.schemaVersion!,
    validatorVersion: source.validatorVersion!, generatorVersion, codeHash, code, createdAt, limitations: v.limitations.map(x => text(x, 512)) }
}
async function bounded(response: Response): Promise<unknown> {
  const reader = response.body?.getReader()
  if (!reader) throw invalid()
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 512 * 1024) throw invalid()
      chunks.push(value)
    }
  } finally { await reader.cancel(); reader.releaseLock() }
  const joined = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(joined)) as unknown
}
const failures: Record<string, string> = {
  VALIDATED_REVISION_REQUIRED: 'Only a saved VALIDATED revision can be exported.',
  SOURCE_INVALID: 'The saved DSL cannot be validated. Export was rejected.',
  SOURCE_PROVENANCE_MISMATCH: 'Saved DSL provenance does not match. Export was rejected.',
  ARTIFACT_PROVENANCE_MISMATCH: 'Stored export provenance does not match. Export was rejected.',
  TARGET_RESOURCE_LIMIT: 'MQL5 target limit: 16 indicators and 4500 warm-up bars.',
  TARGET_PERIOD_LIMIT: 'MQL5 target limit: indicator period must not exceed 200.',
  TARGET_LAG_LIMIT: 'MQL5 target limit: operand lag must not exceed 200.',
  TARGET_OUTPUT_LIMIT: 'Generated MQL5 exceeds the 128 KiB target limit.',
}
export async function exportMql5(source: Revision, accountId: string, create = false): Promise<Artifact> {
  const headers = workspaceHeaders(accountId)
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(source.strategyId) || !Number.isInteger(source.revision)
    || source.revision < 1 || source.revision > 100 || source.status !== 'VALIDATED') throw invalid()
  if (create) {
    const token = object(await (await request('/auth/csrf')).json())
    if (token.headerName !== 'X-CSRF-TOKEN' || typeof token.token !== 'string') throw invalid()
    headers.set('Content-Type', 'application/json'); headers.set(token.headerName, token.token)
  }
  try {
    const response = await privateRequest(accountId, `/strategies/${source.strategyId}/versions/${source.revision}/mql5`,
      create ? { method: 'POST', headers, body: '{}' } : { headers })
    return await parseArtifact(await bounded(response), source)
  } catch (error) {
    if (error instanceof ApiError && error.status === 422 && error.response) {
      const v = object(await bounded(error.response))
      throw new Error(typeof v.code === 'string' && Object.hasOwn(failures, v.code) ? failures[v.code] : 'This DSL is not supported by the MQL5 target.')
    }
    throw error
  }
}
