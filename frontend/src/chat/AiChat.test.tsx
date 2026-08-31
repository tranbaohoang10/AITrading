import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/AuthContext'
import { ApiError } from '../auth/api'
import { ConversationProvider } from './ConversationProvider'
import { PersistentChat } from './PersistentChat'
import * as api from './api'
import * as ai from './aiApi'

vi.mock('./api', () => ({ listConversations: vi.fn(), getMessages: vi.fn(), createConversation: vi.fn(), saveMessage: vi.fn(), renameConversation: vi.fn(), deleteConversation: vi.fn() }))
vi.mock('./aiApi', async original => ({ ...await original<typeof import('./aiApi')>(), getAiConfiguration: vi.fn(), startAi: vi.fn(), getAiTurn: vi.fn(), getLatestAiTurn: vi.fn(), cancelAiTurn: vi.fn() }))
const alpha: api.Conversation = { id: '11111111-1111-4111-8111-111111111111', title: 'Alpha', version: 2, createdAt: '2026-08-31T00:00:00Z', updatedAt: '2026-08-31T00:00:00Z', lastMessage: 'Saved user prompt' }
const beta = { ...alpha, id: '22222222-2222-4222-8222-222222222222', title: 'Beta' }
const userMessage: api.Message = { sequence: 1, requestId: '33333333-3333-4333-8333-333333333333', role: 'user', content: 'Saved user prompt', createdAt: alpha.createdAt }
const reply: api.Message = { ...userMessage, sequence: 2, requestId: '44444444-4444-4444-8444-444444444444', role: 'assistant', content: 'Persisted synthetic reply <script>inert()</script>' }
const turn = (intent: ai.AiIntent, state: ai.AiTurn['state'] = 'SUCCEEDED', errorCode: string | null = null): ai.AiTurn => ({ ...intent, state, errorCode, provider: 'openai', model: 'configured-test-model', assistantSequence: state === 'SUCCEEDED' ? intent.sourceSequence + 1 : null, contextStart: 1, contextEnd: intent.sourceSequence, contextCount: intent.sourceSequence, contextHash: 'a'.repeat(64), createdAt: alpha.createdAt, expiresAt: '2026-08-31T00:00:45Z', updatedAt: alpha.updatedAt })
const known: ai.AiIntent = { conversationId: alpha.id, requestId: '55555555-5555-4555-8555-555555555555', expectedVersion: 2, sourceSequence: 1 }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const clear = vi.fn()
let saved = false
function Root({ userId = 'owner-a' }: { userId?: string }) {
  return <AuthContext.Provider value={{ user: { id: userId, email: `${userId}@example.test`, displayName: 'Researcher' }, clear, update: vi.fn() }}><ConversationProvider key={userId}><PersistentChat /></ConversationProvider></AuthContext.Provider>
}
async function select(name = 'Alpha') {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }))
  await waitFor(() => expect(screen.queryByText('Loading messages…')).not.toBeInTheDocument())
}
async function ready() {
  await select()
  fireEvent.click(screen.getByRole('button', { name: 'Check AI availability' }))
  await screen.findByText('OpenAI · configured-test-model')
}
beforeEach(() => {
  vi.resetAllMocks(); saved = false
  vi.mocked(api.listConversations).mockResolvedValue({ items: [alpha, beta], nextCursor: null })
  vi.mocked(api.getMessages).mockImplementation(async id => ({ conversation: { ...(id === alpha.id ? alpha : beta), version: saved ? 3 : 2 }, items: saved ? [userMessage, reply] : [userMessage], nextBefore: null }))
  vi.mocked(ai.getAiConfiguration).mockResolvedValue({ configured: true, provider: 'openai', model: 'configured-test-model' })
  vi.mocked(ai.getLatestAiTurn).mockResolvedValue(null)
  vi.mocked(ai.startAi).mockImplementation(async intent => { saved = true; return turn(intent) })
  vi.mocked(ai.cancelAiTurn).mockImplementation(async intent => turn(intent, 'CANCELLED', 'AI_CANCELLED'))
})

it('checks availability explicitly and never invents a reply when disabled', async () => {
  vi.mocked(ai.getAiConfiguration).mockResolvedValue({ configured: false, provider: 'openai', model: null })
  render(<Root />); await select()
  expect(ai.getAiConfiguration).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Ask AI' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Check AI availability' }))
  expect(await screen.findByText('AI is not configured on the server.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ask AI' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Still save without AI' } })
  expect(screen.getByRole('button', { name: 'Save message' })).toBeEnabled()
  expect(ai.startAi).not.toHaveBeenCalled()
})

it('asks only for a saved latest user message and reloads the authoritative assistant', async () => {
  render(<Root />); await ready()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Unsent draft' } })
  expect(screen.getByRole('button', { name: 'Ask AI' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  expect(await screen.findByText(reply.content)).toBeInTheDocument()
  expect(screen.getByText('AI reply saved to this conversation.')).toBeInTheDocument()
  expect(ai.startAi).toHaveBeenCalledWith(expect.objectContaining({ conversationId: alpha.id, expectedVersion: 2, sourceSequence: 1 }), 'owner-a')
  expect(api.saveMessage).not.toHaveBeenCalled()
  expect(document.querySelector('script')).toBeNull()
  expect(screen.getByRole('button', { name: 'Ask AI' })).toBeDisabled()
})

it('keeps one request identity during uncertain transport and retries without double submit', async () => {
  vi.mocked(ai.startAi).mockRejectedValueOnce(new Error('Connection lost'))
  render(<Root />); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  expect(await screen.findByText('Connection lost')).toBeInTheDocument()
  const original = vi.mocked(ai.startAi).mock.calls[0][0]
  expect(screen.getByLabelText('Research message')).toBeDisabled()
  expect(screen.getByRole('button', { name: /^Beta/ })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry same AI request' }))
  fireEvent.click(screen.getByRole('button', { name: 'Retry same AI request' }))
  await screen.findByText(reply.content)
  expect(ai.startAi).toHaveBeenCalledTimes(2)
  expect(vi.mocked(ai.startAi).mock.calls[1][0]).toEqual(original)
})

it('checks a pending result without invoking the provider again', async () => {
  vi.mocked(ai.startAi).mockImplementation(async intent => turn(intent, 'PENDING'))
  vi.mocked(ai.getAiTurn).mockImplementation(async intent => { saved = true; return turn(intent) })
  render(<Root />); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  await screen.findByText(/AI outcome is pending or uncertain/)
  fireEvent.click(screen.getByRole('button', { name: 'Check AI status' }))
  await screen.findByText(reply.content)
  expect(ai.startAi).toHaveBeenCalledTimes(1)
  expect(ai.getAiTurn).toHaveBeenCalledWith(vi.mocked(ai.startAi).mock.calls[0][0], 'owner-a')
})

it('recovers durable request identity after reload and preserves an unsent draft', async () => {
  vi.mocked(ai.getLatestAiTurn).mockResolvedValue(turn(known, 'PENDING'))
  render(<Root />); await select()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Do not lose this draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Check AI availability' }))
  await screen.findByText(/AI outcome is pending or uncertain/)
  expect(ai.startAi).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Research message')).toHaveValue('Do not lose this draft')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel AI request' }))
  await screen.findByText(/AI request cancelled/)
  expect(ai.cancelAiTurn).toHaveBeenCalledWith(known, 'owner-a')
  expect(screen.getByLabelText('Research message')).toHaveValue('Do not lose this draft')
  expect(screen.getByLabelText('Research message')).toBeEnabled()
})

it('cancels while the original HTTP call is pending and ignores its late response', async () => {
  const pending = deferred<ai.AiTurn>()
  vi.mocked(ai.startAi).mockReturnValue(pending.promise)
  render(<Root />); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  const original = vi.mocked(ai.startAi).mock.calls[0][0]
  fireEvent.click(screen.getByRole('button', { name: 'Cancel AI request' }))
  await screen.findByText(/AI request cancelled/)
  await waitFor(() => expect(screen.getByRole('button', { name: /^Beta/ })).toBeEnabled())
  await select('Beta')
  await act(async () => pending.resolve(turn(original)))
  expect(screen.queryByText('AI reply saved to this conversation.')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Conversation title')).toHaveValue('Beta')
  expect(screen.getByRole('button', { name: 'New Chat' })).toBeEnabled()
})

it('keeps pending identity if cancel or a subsequent retry is rejected', async () => {
  vi.mocked(ai.startAi).mockRejectedValueOnce(new Error('Lost ack')).mockRejectedValueOnce(new ApiError(429))
  vi.mocked(ai.cancelAiTurn).mockRejectedValue(new Error('Cancel unavailable'))
  render(<Root />); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Ask AI' })); await screen.findByText('Lost ack')
  const original = vi.mocked(ai.startAi).mock.calls[0][0]
  fireEvent.click(screen.getByRole('button', { name: 'Retry same AI request' })); await screen.findByText(/Too many attempts/)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel AI request' })); await screen.findByText('Cancel unavailable')
  expect(ai.cancelAiTurn).toHaveBeenCalledWith(original, 'owner-a')
  expect(screen.getByRole('button', { name: 'Check AI status' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Ask AI' })).toBeDisabled()
})

it.each(['AI_REFUSED', 'AI_TIMEOUT', 'AI_STALE_CONTEXT', 'AI_INVALID_RESPONSE'])('shows %s as failed with no fake assistant and permits explicit new intent', async code => {
  vi.mocked(ai.startAi).mockImplementation(async intent => turn(intent, 'FAILED', code))
  render(<Root />); await ready(); fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  await screen.findByText(ai.aiFailure(code))
  expect(screen.queryByText(reply.content)).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ask AI' })).toBeEnabled())
  const first = vi.mocked(ai.startAi).mock.calls[0][0]
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  await waitFor(() => expect(ai.startAi).toHaveBeenCalledTimes(2))
  expect(vi.mocked(ai.startAi).mock.calls[1][0].requestId).not.toEqual(first.requestId)
})

it('ignores late configuration/attempt context after conversation or identity changes', async () => {
  const pending = deferred<ai.AiTurn | null>()
  vi.mocked(ai.getLatestAiTurn).mockReturnValueOnce(pending.promise)
  const root = render(<Root />); await select(); fireEvent.click(screen.getByRole('button', { name: 'Check AI availability' }))
  await waitFor(() => expect(ai.getLatestAiTurn).toHaveBeenCalled())
  await select('Beta'); await act(async () => pending.resolve(turn(known, 'PENDING')))
  expect(screen.queryByRole('button', { name: 'Cancel AI request' })).not.toBeInTheDocument()
  const late = deferred<ai.AiTurn>(); vi.mocked(ai.startAi).mockReturnValueOnce(late.promise)
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  const intent = vi.mocked(ai.startAi).mock.calls[0][0]
  root.rerender(<Root userId="owner-b" />)
  await act(async () => late.resolve(turn(intent)))
  expect(screen.queryByText('AI reply saved to this conversation.')).not.toBeInTheDocument()
  expect(screen.queryByText(reply.content)).not.toBeInTheDocument()
})

it('handles configuration failure, disabled races and session expiry without invented success', async () => {
  vi.mocked(ai.getAiConfiguration).mockRejectedValueOnce(new Error('Config offline'))
  render(<Root />); await select(); fireEvent.click(screen.getByRole('button', { name: 'Check AI availability' })); await screen.findByText('Config offline')
  fireEvent.click(screen.getByRole('button', { name: 'Check AI availability' })); await screen.findByText('OpenAI · configured-test-model')
  vi.mocked(ai.startAi).mockRejectedValueOnce(new ai.AiUnconfigured())
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' })); await screen.findByText(/Saved messages remain available/)
  expect(screen.queryByRole('button', { name: 'Retry same AI request' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Check AI availability' })); await screen.findByText('OpenAI · configured-test-model')
  vi.mocked(ai.startAi).mockRejectedValueOnce(new ApiError(401))
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' })); await waitFor(() => expect(clear).toHaveBeenCalled())
})

it('shows Gemini disclosure and saves only the authoritative structured reply', async () => {
  vi.mocked(ai.getAiConfiguration).mockResolvedValue({ configured: true, provider: 'gemini', model: 'gemini-3.5-flash' })
  vi.mocked(ai.startAi).mockImplementation(async intent => { saved = true; return { ...turn(intent), provider: 'gemini', model: 'gemini-3.5-flash' } })
  render(<Root />); await select()
  fireEvent.click(screen.getByRole('button', { name: 'Check AI availability' }))
  await screen.findByText('Gemini · gemini-3.5-flash')
  expect(screen.getByText(/Gemini prototype: use synthetic test data only/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  await screen.findByText(reply.content)
  expect(document.querySelector('script')).toBeNull()
  expect(api.saveMessage).not.toHaveBeenCalled()
  expect(ai.startAi).toHaveBeenCalledWith(expect.objectContaining({ conversationId: alpha.id }), 'owner-a')
})

it('preserves Gemini disclosure after an unconfigured race and recovers historical OpenAI attempts', async () => {
  vi.mocked(ai.getAiConfiguration).mockResolvedValue({ configured: true, provider: 'gemini', model: 'gemini-3.5-flash' })
  vi.mocked(ai.getLatestAiTurn).mockResolvedValueOnce(turn(known, 'PENDING'))
  render(<Root />); await select()
  fireEvent.click(screen.getByRole('button', { name: 'Check AI availability' }))
  await screen.findByText(/AI outcome is pending or uncertain/)
  expect(ai.startAi).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel AI request' }))
  await screen.findByText(/AI request cancelled/)
  expect(ai.cancelAiTurn).toHaveBeenCalledWith(known, 'owner-a')
  vi.mocked(ai.startAi).mockRejectedValueOnce(new ai.AiUnconfigured())
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  await screen.findByText(/Saved messages remain available/)
  expect(screen.getByText(/Gemini prototype: use synthetic test data only/)).toBeInTheDocument()
  expect(screen.queryByText(/OpenAI ·/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ask AI' })).toBeDisabled()
  expect(screen.queryByText(reply.content)).not.toBeInTheDocument()
})

it.each(['AI_RATE_LIMITED', 'AI_PROVIDER_UNAVAILABLE', 'AI_TIMEOUT', 'AI_INVALID_RESPONSE'])('shows Gemini %s without a fake reply', async code => {
  vi.mocked(ai.getAiConfiguration).mockResolvedValue({ configured: true, provider: 'gemini', model: 'gemini-3.5-flash' })
  vi.mocked(ai.startAi).mockImplementation(async intent => ({ ...turn(intent, 'FAILED', code), provider: 'gemini', model: 'gemini-3.5-flash' }))
  render(<Root />); await select()
  fireEvent.click(screen.getByRole('button', { name: 'Check AI availability' }))
  await screen.findByText('Gemini · gemini-3.5-flash')
  fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }))
  await screen.findByText(ai.aiFailure(code))
  expect(screen.queryByText(reply.content)).not.toBeInTheDocument()
})
