import * as api from './generationApi'

const strategyId = '11111111-1111-4111-8111-111111111111', requestId = '22222222-2222-4222-8222-222222222222', conversationId = '33333333-3333-4333-8333-333333333333'
const intent: api.GenerationIntent = { strategyId, requestId, conversationId, expectedRevision: 1, expectedConversationVersion: 2, sourceSequence: 1 }
const base: api.Generation = { ...intent, contextStart: 1, contextCount: 1, contextHash: 'a'.repeat(64), provider: 'gemini', model: 'gemini-3.5-flash', state: 'READY', errorCode: null,
  proposal: { kind: 'proposal', explanation: 'Synthetic', assumptions: [], questions: [], dslJson: '{}' }, dslHash: 'b'.repeat(64), acceptedRevision: null,
  createdAt: '2026-09-01T00:00:00Z', expiresAt: '2026-09-01T00:00:40Z', updatedAt: '2026-09-01T00:00:01Z' }
const response = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const token = () => response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('sends only the bound generation intent with fresh CSRF and no prompt or provider controls', async () => {
  const network = vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(response(base)); vi.stubGlobal('fetch', network)
  expect(await api.start(intent, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toEqual(base)
  const [path, options] = network.mock.calls[1]; expect(path).toBe(`/api/strategies/${strategyId}/generations`)
  expect(JSON.parse(options.body)).toEqual({ requestId, expectedRevision: 1, conversationId, expectedConversationVersion: 2, sourceSequence: 1 })
  expect(Object.fromEntries(new Headers(options.headers))).toEqual({ 'content-type': 'application/json', 'x-csrf-token': 'synthetic-csrf', 'x-workspace-user': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
})

it('fails closed on provenance, lifecycle, proposal and oversized or secret-like malformed responses', async () => {
  const invalid = [
    { ...base, provider: 'arbitrary' }, { ...base, contextHash: 'secret-value' }, { ...base, state: 'READY', proposal: null },
    { ...base, proposal: { ...base.proposal!, questions: ['not allowed'] } }, { ...base, state: 'CLARIFICATION', dslHash: null, proposal: { kind: 'clarification', explanation: 'Need risk', assumptions: [], questions: [], dslJson: null } },
    { ...base, ownerId: 'forged' }, { ...base, acceptedRevision: 101 },
  ]
  const network = vi.fn(); invalid.forEach(value => network.mockResolvedValueOnce(response(value))); network.mockResolvedValueOnce(new Response('private-secret'.repeat(50000))); vi.stubGlobal('fetch', network)
  for (const unused of invalid) { void unused; await expect(api.get(intent, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow('Invalid strategy generation response') }
  await expect(api.get(intent, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow('Invalid AI service response')
})

it('loads204 latest and sends empty decision bodies without repeating private context', async () => {
  const network = vi.fn().mockResolvedValueOnce(response(null, 204)).mockResolvedValueOnce(token()).mockResolvedValueOnce(response({ ...base, state: 'REJECTED' })); vi.stubGlobal('fetch', network)
  expect(await api.latest(strategyId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBeNull()
  expect((await api.decide(base, 'reject', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).state).toBe('REJECTED')
  expect(network.mock.calls[2][1].body).toBe('{}')
})
