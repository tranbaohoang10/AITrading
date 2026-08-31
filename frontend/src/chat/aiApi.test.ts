import { beforeEach, expect, it, vi } from 'vitest'
import { ApiError, request } from '../auth/api'
import { AiUnconfigured, cancelAiTurn, getAiConfiguration, getAiTurn, getLatestAiTurn, startAi, type AiIntent } from './aiApi'
vi.mock('../auth/api', async original => ({ ...await original<typeof import('../auth/api')>(), request: vi.fn() }))
const intent: AiIntent = { conversationId: '11111111-1111-4111-8111-111111111111', requestId: '22222222-2222-4222-8222-222222222222', expectedVersion: 2, sourceSequence: 1 }
const success = { ...intent, state: 'SUCCEEDED', errorCode: null, provider: 'openai', model: 'configured-test-model', assistantSequence: 2, contextStart: 1, contextEnd: 1, contextCount: 1, contextHash: 'a'.repeat(64), createdAt: '2026-08-31T00:00:00Z', expiresAt: '2026-08-31T00:00:45Z', updatedAt: '2026-08-31T00:00:01Z' }
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
beforeEach(() => { vi.resetAllMocks() })

it('uses same-origin fresh CSRF and only approved intent fields with a bounded AI timeout', async () => {
  vi.mocked(request).mockResolvedValueOnce(response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' })).mockResolvedValueOnce(response(success))
  expect(await startAi(intent)).toEqual(success)
  expect(request).toHaveBeenNthCalledWith(1, '/auth/csrf')
  const [path, options] = vi.mocked(request).mock.calls[1]
  expect(path).toEqual(`/conversations/${intent.conversationId}/ai-turns`)
  expect(JSON.parse(options!.body as string)).toEqual({ requestId: intent.requestId, expectedVersion: 2, sourceSequence: 1 })
  expect(options!.signal).toBeInstanceOf(AbortSignal)
  expect(options!.headers).toEqual({ 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'synthetic-csrf' })
})

it('rejects wrong identity, impossible terminal fields and invalid provenance', async () => {
  for (const patch of [{ conversationId: intent.requestId }, { requestId: intent.conversationId }, { expectedVersion: 3 }, { sourceSequence: 2 }, { assistantSequence: null }, { errorCode: 'AI_REFUSED' }, { state: 'PENDING' }, { contextCount: 2 }, { contextHash: 'wrong' }, { model: 'bad\nmodel' }]) {
    vi.mocked(request).mockResolvedValueOnce(response({ ...success, ...patch }))
    await expect(getAiTurn(intent)).rejects.toThrow('Invalid AI service response')
  }
})

it('reads latest attempt or204 and cancels with an empty body, never request content', async () => {
  vi.mocked(request).mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(response(success))
  expect(await getLatestAiTurn(intent.conversationId)).toBeNull()
  expect(await getLatestAiTurn(intent.conversationId)).toEqual(success)
  vi.mocked(request).mockResolvedValueOnce(response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' })).mockResolvedValueOnce(response({ ...success, state: 'CANCELLED', errorCode: 'AI_CANCELLED', assistantSequence: null }))
  expect((await cancelAiTurn(intent)).state).toEqual('CANCELLED')
  expect(vi.mocked(request).mock.calls.at(-1)?.[1]?.body).toEqual('{}')
})

it('distinguishes unconfigured503 from uncertain DB/network503 and validates availability', async () => {
  vi.mocked(request).mockResolvedValueOnce(response({ configured: false, provider: 'openai', model: null }))
  expect((await getAiConfiguration()).configured).toBe(false)
  vi.mocked(request).mockResolvedValueOnce(response({ configured: 'true', provider: 'openai', model: 'model' }))
  await expect(getAiConfiguration()).rejects.toThrow()
  const unconfigured = new ApiError(503, response({ code: 'AI_UNCONFIGURED' }))
  vi.mocked(request).mockResolvedValueOnce(response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })).mockRejectedValueOnce(unconfigured)
  await expect(startAi(intent)).rejects.toBeInstanceOf(AiUnconfigured)
  const unavailable = new ApiError(503, response({ code: 'UNAVAILABLE' }))
  vi.mocked(request).mockResolvedValueOnce(response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })).mockRejectedValueOnce(unavailable)
  await expect(startAi(intent)).rejects.toBe(unavailable)
})
