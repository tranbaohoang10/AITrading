import { afterEach, describe, expect, it, vi } from 'vitest'
import { createConversation, getMessages, listConversations, saveMessage } from './api'

const id = '11111111-1111-4111-8111-111111111111'
const conversation = { id, title: 'Research', version: 1, createdAt: '2026-08-31T00:00:00Z', updatedAt: '2026-08-31T00:00:00Z', lastMessage: '' }
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
afterEach(() => vi.unstubAllGlobals())
describe('PB-004 client trust boundary', () => {
  it('rejects a mismatched conversation identity rather than mixing context', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ conversation: { ...conversation, id: '22222222-2222-4222-8222-222222222222' }, items: [], nextBefore: null })))
    await expect(getMessages(id)).rejects.toThrow('Invalid conversation response')
  })
  it('rejects malformed response shapes and timestamps', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ items: [{ ...conversation, createdAt: 'not-a-date' }], nextCursor: null })))
    await expect(listConversations()).rejects.toThrow('Invalid conversation response')
  })
  it('sends only requestId/content with CSRF, same-origin cookie, and no automatic unsafe retry', async () => {
    const network = vi.fn(async (path: string) => path.endsWith('/csrf') ? response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-token' }) : response({ sequence: 1, requestId: id, role: 'user', content: 'Hello', createdAt: conversation.createdAt }))
    vi.stubGlobal('fetch', network)
    await expect(saveMessage(id, id, 'Hello')).resolves.toMatchObject({ sequence: 1, role: 'user' })
    const [, options] = network.mock.calls[1] as unknown as [string, RequestInit]
    expect(JSON.parse(options.body as string)).toEqual({ requestId: id, content: 'Hello' })
    expect(options.credentials).toBe('same-origin')
    expect(options.headers).toMatchObject({ 'X-CSRF-TOKEN': 'synthetic-token' })
    expect(network).toHaveBeenCalledTimes(2)
  })
  it('rejects unexpected server roles and preserves an uncertain create failure for caller retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async (path: string) => path.endsWith('/csrf') ? response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' }) : response({ sequence: 1, requestId: id, role: 'system', content: 'Untrusted', createdAt: conversation.createdAt })))
    await expect(saveMessage(id, id, 'Hello')).rejects.toThrow('Invalid conversation response')
    const failing = vi.fn(async (path: string) => { if (path.endsWith('/csrf')) return response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' }); throw new Error('lost reply') })
    vi.stubGlobal('fetch', failing)
    await expect(createConversation(id)).rejects.toThrow('Cannot reach')
    expect(failing).toHaveBeenCalledTimes(2)
  })
})
