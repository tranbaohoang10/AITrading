import { beforeEach, expect, it, vi } from 'vitest'
import { AiUnconfigured, cancelAiTurn, getAiConfiguration, getAiTurn, getLatestAiTurn, startAi, type AiIntent } from './aiApi'
const network = vi.fn<typeof fetch>()
afterEach(() => vi.unstubAllGlobals())
const intent: AiIntent = { conversationId: '11111111-1111-4111-8111-111111111111', requestId: '22222222-2222-4222-8222-222222222222', expectedVersion: 2, sourceSequence: 1 }
const success = { ...intent, state: 'SUCCEEDED', errorCode: null, provider: 'openai', model: 'configured-test-model', assistantSequence: 2, contextStart: 1, contextEnd: 1, contextCount: 1, contextHash: 'a'.repeat(64), createdAt: '2026-08-31T00:00:00Z', expiresAt: '2026-08-31T00:00:45Z', updatedAt: '2026-08-31T00:00:01Z' }
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('fetch', network) })

it('uses same-origin fresh CSRF and only approved intent fields with a bounded AI timeout', async () => {
  network.mockResolvedValueOnce(response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' })).mockResolvedValueOnce(response(success))
  expect(await startAi(intent, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toEqual(success)
  expect(network).toHaveBeenNthCalledWith(1, '/api/auth/csrf', expect.objectContaining({ credentials: 'same-origin' }))
  const [path, options] = network.mock.calls[1]
  expect(path).toEqual(`/api/conversations/${intent.conversationId}/ai-turns`)
  expect(JSON.parse(options!.body as string)).toEqual({ requestId: intent.requestId, expectedVersion: 2, sourceSequence: 1 })
  expect(options!.signal).toBeInstanceOf(AbortSignal)
  expect(Object.fromEntries(new Headers(options!.headers))).toEqual({ 'content-type': 'application/json', 'x-csrf-token': 'synthetic-csrf', 'x-workspace-user': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
})

it('rejects wrong identity, impossible terminal fields and invalid provenance', async () => {
  for (const patch of [{ conversationId: intent.requestId }, { requestId: intent.conversationId }, { expectedVersion: 3 }, { sourceSequence: 2 }, { assistantSequence: null }, { errorCode: 'AI_REFUSED' }, { state: 'PENDING' }, { contextCount: 2 }, { contextHash: 'wrong' }, { model: 'bad\nmodel' }]) {
    network.mockResolvedValueOnce(response({ ...success, ...patch }))
    await expect(getAiTurn(intent, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow('Invalid AI service response')
  }
})

it('reads latest attempt or204 and cancels with an empty body, never request content', async () => {
  network.mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(response(success))
  expect(await getLatestAiTurn(intent.conversationId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBeNull()
  expect(await getLatestAiTurn(intent.conversationId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toEqual(success)
  network.mockResolvedValueOnce(response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' })).mockResolvedValueOnce(response({ ...success, state: 'CANCELLED', errorCode: 'AI_CANCELLED', assistantSequence: null }))
  expect((await cancelAiTurn(intent, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).state).toEqual('CANCELLED')
  expect(network.mock.calls.at(-1)?.[1]?.body).toEqual('{}')
})

it('distinguishes unconfigured503 from uncertain DB/network503 and validates availability', async () => {
  network.mockResolvedValueOnce(response({ configured: false, provider: 'openai', model: null }))
  expect((await getAiConfiguration('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).configured).toBe(false)
  network.mockResolvedValueOnce(response({ configured: 'true', provider: 'openai', model: 'model' }))
  await expect(getAiConfiguration('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow()
  const unconfigured = new Response(JSON.stringify({ code: 'AI_UNCONFIGURED' }), { status: 503 })
  network.mockResolvedValueOnce(response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })).mockResolvedValueOnce(unconfigured)
  await expect(startAi(intent, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toBeInstanceOf(AiUnconfigured)
  const unavailable = new Response(JSON.stringify({ code: 'UNAVAILABLE' }), { status: 503 })
  network.mockResolvedValueOnce(response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })).mockResolvedValueOnce(unavailable)
  await expect(startAi(intent, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toMatchObject({ status: 503 })
})

it('accepts Gemini selection without relabelling existing OpenAI turns and fails closed on unknown selection', async () => {
  for (const configuration of [
    { configured: true, provider: 'gemini', model: 'gemini-3.5-flash' },
    { configured: false, provider: 'gemini', model: null },
    { configured: false, provider: null, model: null },
  ]) {
    network.mockResolvedValueOnce(response(configuration))
    expect(await getAiConfiguration('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toEqual(configuration)
  }
  for (const provider of ['openai', 'gemini']) {
    network.mockResolvedValueOnce(response({ ...success, provider }))
    expect((await getAiTurn(intent, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).provider).toBe(provider)
  }
  for (const configuration of [{ configured: true, provider: null, model: 'model' }, { configured: true, provider: 'unknown', model: 'model' }, { configured: false, provider: 'secret-like-value', model: null }]) {
    network.mockResolvedValueOnce(response(configuration))
    await expect(getAiConfiguration('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow('Invalid AI service response')
  }
  network.mockResolvedValueOnce(response({ ...success, provider: 'unknown' }))
  await expect(getAiTurn(intent, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow('Invalid AI service response')
})

it('bounds JSON and hides malformed response fragments that could contain secrets', async () => {
  for (const body of ['synthetic-secret-not-json', '{"synthetic-secret":', ' '.repeat(65537), new Uint8Array([0xff])]) {
    network.mockResolvedValueOnce(new Response(body))
    await expect(getAiConfiguration('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow(/^Invalid AI service response\. Check status before retrying\.$/)
  }
  network.mockResolvedValueOnce(response({ ...success, provider: 'gemini', state: 'FAILED', errorCode: 'AI_RATE_LIMITED', assistantSequence: null }))
  expect(await getAiTurn(intent, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toMatchObject({ provider: 'gemini', errorCode: 'AI_RATE_LIMITED' })
})
