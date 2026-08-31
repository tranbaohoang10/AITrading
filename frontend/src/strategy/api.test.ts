import * as api from './api'
const id = '00000000-0000-0000-0000-000000000001'
const base = { strategyId: id, revision: 1, title: 'Private', draftText: '{', status: 'DRAFT', canonicalJson: null, hash: null, schemaVersion: null, validatorVersion: null, minimumBars: null, symbol: null, timeframe: null, createdAt: '2024-01-01T00:00:00Z' }
const payload: api.Save = { requestId: '00000000-0000-0000-0000-000000000002', expectedRevision: 1, title: 'Private', draftText: '{', mode: 'DRAFT' }
const response = (status: number, value: unknown) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const token = () => response(200, { headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('rejects mixed resource/revision/status and forged executable metadata responses', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(response(200, base))
  const changes = [{ strategyId: payload.requestId }, { revision: 2 }, { hash: 'a'.repeat(64) }, { status: 'EXECUTABLE' }, { draftText: 'é'.repeat(32769) }]
  for (const change of changes) fetch.mockResolvedValueOnce(response(200, { ...base, ...change }))
  vi.stubGlobal('fetch', fetch); expect((await api.getRevision(id, 1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).draftText).toBe('{')
  for (const unused of changes) { void unused; await expect(api.getRevision(id, 1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow('Invalid strategy response') }
  await expect(api.getRevision('../bad', undefined, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow('Invalid strategy response')
})

it('sends exact expected revision and text with CSRF and no automatic uncertain retry', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(token()).mockRejectedValueOnce(new TypeError('connection lost'))
  vi.stubGlobal('fetch', fetch); await expect(api.saveRevision(id, payload, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow('Cannot reach the service')
  expect(fetch).toHaveBeenCalledTimes(2); expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(payload)
  expect(new Headers(fetch.mock.calls[1][1].headers).get('X-CSRF-TOKEN')).toBe('synthetic-csrf')
  expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'same-origin' })
})

it('distinguishes validation-only malformed JSON and bounded server diagnostics without echoing messages', async () => {
  const failure = { valid: false, document: null, errors: [{ path: '/rules', code: 'INVALID', message: 'private raw input not rendered' }] }
  const fetch = vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(response(400, {})).mockResolvedValueOnce(token()).mockResolvedValueOnce(response(422, failure)).mockResolvedValueOnce(token()).mockResolvedValueOnce(response(422, failure))
  vi.stubGlobal('fetch', fetch)
  expect((await api.validateDraft('{', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).errors[0].code).toBe('MALFORMED_JSON')
  expect(await api.validateDraft('{}', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toEqual({ valid: false, document: null, errors: [{ path: '/rules', code: 'INVALID' }] })
  await expect(api.saveRevision(id, { ...payload, mode: 'VALIDATED' }, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toBeInstanceOf(api.ValidationError)
  expect(fetch.mock.calls[1][1].body).toBe('{')
})

it('validates history ordering, ownership and pagination rather than mixing records', async () => {
  const item = { id, revision: 1, title: 'Private', status: 'DRAFT', symbol: null, timeframe: null, createdAt: base.createdAt }
  const fetch = vi.fn().mockResolvedValueOnce(response(200, { items: [item], nextBefore: null }))
    .mockResolvedValueOnce(response(200, { items: [{ ...item, id: payload.requestId }], nextBefore: null }))
    .mockResolvedValueOnce(response(200, { items: [item, item], nextBefore: null }))
    .mockResolvedValueOnce(response(200, { items: [item], nextBefore: 2 }))
  vi.stubGlobal('fetch', fetch); expect((await api.history(id, undefined, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).items).toHaveLength(1)
  for (let i = 0; i < 3; i++) await expect(api.history(id, undefined, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).rejects.toThrow('Invalid strategy response')
})
