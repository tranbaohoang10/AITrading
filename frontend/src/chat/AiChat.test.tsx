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
const alpha: api.Conversation = { id: '11111111-1111-4111-8111-111111111111', title: 'Alpha', version: 2, createdAt: '2026-08-31T00:00:00Z', updatedAt: '2026-08-31T00:00:00Z', lastMessage: 'Existing prompt' }
const beta: api.Conversation = { ...alpha, id: '22222222-2222-4222-8222-222222222222', title: 'Beta' }
const existing: api.Message = { sequence: 1, requestId: '33333333-3333-4333-8333-333333333333', role: 'user', content: 'Existing prompt', createdAt: alpha.createdAt }
const replyFor = (sequence: number): api.Message => ({ sequence: sequence + 1, requestId: '44444444-4444-4444-8444-444444444444', role: 'assistant', content: 'Persisted synthetic reply <script>inert()</script>', createdAt: alpha.createdAt })
const turn = (intent: ai.AiIntent, state: ai.AiTurn['state'] = 'SUCCEEDED', errorCode: string | null = null): ai.AiTurn => ({ ...intent, state, errorCode, provider: 'openai', model: 'configured-test-model', assistantSequence: state === 'SUCCEEDED' ? intent.sourceSequence + 1 : null, contextStart: Math.max(1, intent.sourceSequence - 1), contextEnd: intent.sourceSequence, contextCount: Math.min(2, intent.sourceSequence), contextHash: 'a'.repeat(64), createdAt: alpha.createdAt, expiresAt: '2026-08-31T00:00:45Z', updatedAt: alpha.updatedAt })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { promise, resolve } }
const clear = vi.fn()
let saved: api.Message | null
let completed: ai.AiTurn | null
function Root({ userId = 'owner-a' }: { userId?: string }) {
  return <AuthContext.Provider value={{ user: { id: userId, email: `${userId}@example.test`, displayName: 'Researcher' }, clear, update: vi.fn() }}><ConversationProvider key={userId}><PersistentChat /></ConversationProvider></AuthContext.Provider>
}
async function select() {
  const history = screen.getByRole('button', { name: 'Conversation history' })
  if (history.getAttribute('aria-pressed') === 'false') fireEvent.click(history)
  fireEvent.click(await screen.findByRole('button', { name: /^Alpha/ }))
  await waitFor(() => expect(screen.queryByText('Loading messages…')).not.toBeInTheDocument())
}
async function ready() {
  await screen.findByText(/OpenAI · AI ready/)
  await select()
  await screen.findByText(/OpenAI · AI ready/)
}

beforeEach(() => {
  vi.resetAllMocks(); saved = null; completed = null
  vi.mocked(api.listConversations).mockResolvedValue({ items: [alpha], nextCursor: null })
  vi.mocked(api.createConversation).mockResolvedValue(beta)
  vi.mocked(api.getMessages).mockImplementation(async id => {
    const items = saved ? [existing, saved, ...(completed?.state === 'SUCCEEDED' ? [replyFor(saved.sequence)] : [])] : [existing]
    return { conversation: { ...(id === beta.id ? beta : alpha), version: saved ? 3 : 2 }, items, nextBefore: null }
  })
  vi.mocked(api.saveMessage).mockImplementation(async (_id, requestId, content) => (saved = { sequence: 2, requestId, role: 'user', content, createdAt: alpha.createdAt }))
  vi.mocked(ai.getAiConfiguration).mockResolvedValue({ configured: true, provider: 'openai', model: 'configured-test-model' })
  vi.mocked(ai.getLatestAiTurn).mockResolvedValue(null)
  vi.mocked(ai.startAi).mockImplementation(async intent => (completed = turn(intent)))
  vi.mocked(ai.getAiTurn).mockImplementation(async intent => (completed = turn(intent)))
  vi.mocked(ai.cancelAiTurn).mockImplementation(async intent => (completed = turn(intent, 'CANCELLED', 'AI_CANCELLED')))
})

it('starts a private conversation from the composer with one Send action', async () => {
  render(<Root />)
  await screen.findByText(/OpenAI · AI ready/)
  expect(screen.getByRole('button', { name: 'Voice input' })).toBeDisabled()

  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Create a breakout plan' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send to Quant' }))

  expect(await screen.findByText(replyFor(2).content)).toBeInTheDocument()
  expect(api.createConversation).toHaveBeenCalledTimes(1)
  expect(api.saveMessage).toHaveBeenCalledWith(beta.id, expect.any(String), 'Create a breakout plan', 'owner-a')
  expect(ai.startAi).toHaveBeenCalledWith(expect.objectContaining({ conversationId: beta.id, expectedVersion: 3, sourceSequence: 2 }), 'owner-a')
})

it('checks provider automatically and never exposes admin provider/save controls', async () => {
  vi.mocked(ai.getAiConfiguration).mockResolvedValue({ configured: false, provider: null, model: null })
  render(<Root />); await select()
  await screen.findByText(/AI · Offline/)
  expect(ai.getAiConfiguration).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Send to Quant' })).toBeDisabled()
  for (const label of ['Check AI availability', 'Save message', 'Ask AI', 'Refresh list', 'Reload messages']) expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
  expect(ai.startAi).not.toHaveBeenCalled()
})

it('uses one Send action to save, confirm and then start AI with authoritative version/sequence', async () => {
  render(<Root />); await ready()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Test the trend rule' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send to Quant' }))
  expect(await screen.findByText(replyFor(2).content)).toBeInTheDocument()
  expect(api.saveMessage).toHaveBeenCalledTimes(1)
  expect(ai.startAi).toHaveBeenCalledTimes(1)
  expect(vi.mocked(api.saveMessage).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(ai.startAi).mock.invocationCallOrder[0])
  expect(ai.startAi).toHaveBeenCalledWith(expect.objectContaining({ conversationId: alpha.id, expectedVersion: 3, sourceSequence: 2 }), 'owner-a')
  expect(document.querySelector('script')).toBeNull()
})

it('freezes the save identity on an uncertain result and does not ask AI before confirmation', async () => {
  vi.mocked(api.saveMessage).mockRejectedValueOnce(new Error('Lost save acknowledgement'))
  render(<Root />); await ready()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Private exact intent' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send to Quant' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Lost save acknowledgement')
  expect(ai.startAi).not.toHaveBeenCalled()
  const original = vi.mocked(api.saveMessage).mock.calls[0]
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText(replyFor(2).content)
  expect(vi.mocked(api.saveMessage).mock.calls[1]).toEqual(original)
  expect(ai.startAi).toHaveBeenCalledTimes(1)
})

it('allows correction after a definite save rejection without starting AI', async () => {
  vi.mocked(api.saveMessage).mockRejectedValueOnce(new ApiError(400))
  render(<Root />); await ready()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Invalid\u0001' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send to Quant' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Research message')).toBeEnabled()
  expect(screen.getByLabelText('Research message')).toHaveValue('Invalid\u0001')
  expect(ai.startAi).not.toHaveBeenCalled()
})

it('retries an uncertain AI request with the same identity and suppresses duplicate sends', async () => {
  vi.mocked(ai.startAi).mockRejectedValueOnce(new Error('Connection lost'))
  render(<Root />); await ready()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'One request' } })
  const send = screen.getByRole('button', { name: 'Send to Quant' })
  fireEvent.click(send); fireEvent.click(send)
  expect(await screen.findByRole('alert')).toHaveTextContent('Connection lost')
  expect(api.saveMessage).toHaveBeenCalledTimes(1)
  const original = vi.mocked(ai.startAi).mock.calls[0][0]
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText(replyFor(2).content)
  expect(vi.mocked(ai.startAi).mock.calls[1][0]).toEqual(original)
})

it('checks a pending result without invoking the provider twice and can cancel it', async () => {
  vi.mocked(ai.startAi).mockImplementation(async intent => (completed = turn(intent, 'PENDING')))
  render(<Root />); await ready()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Long analysis' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send to Quant' }))
  await screen.findByRole('button', { name: 'Check status' })
  fireEvent.click(screen.getByRole('button', { name: 'Check status' }))
  await screen.findByText(replyFor(2).content)
  expect(ai.startAi).toHaveBeenCalledTimes(1)
  expect(ai.getAiTurn).toHaveBeenCalledTimes(1)

  vi.mocked(ai.startAi).mockImplementation(async intent => (completed = turn(intent, 'PENDING')))
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Second analysis' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send to Quant' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel request' }))
  await screen.findByText(/AI request cancelled/)
  expect(ai.cancelAiTurn).toHaveBeenCalled()
})

it('recovers a durable pending request automatically and preserves the draft', async () => {
  const known: ai.AiIntent = { conversationId: alpha.id, requestId: '55555555-5555-4555-8555-555555555555', expectedVersion: 2, sourceSequence: 1 }
  vi.mocked(api.listConversations).mockResolvedValue({ items: [alpha, beta], nextCursor: null })
  vi.mocked(ai.getLatestAiTurn).mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(turn(known, 'PENDING'))
  render(<Root />); await select()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Do not lose this draft' } })
  fireEvent.click(screen.getByRole('button', { name: /^Beta/ }))
  await waitFor(() => expect(screen.queryByText('Loading messages…')).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /^Alpha/ }))
  await screen.findByRole('button', { name: 'Cancel request' })
  expect(screen.getByLabelText('Research message')).toHaveValue('Do not lose this draft')
  expect(screen.getByLabelText('Research message')).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
  await screen.findByText(/AI request cancelled/)
  expect(screen.getByLabelText('Research message')).toHaveValue('Do not lose this draft')
})

it('ignores a late AI response after cancellation and conversation lifetime changes', async () => {
  const pending = deferred<ai.AiTurn>()
  vi.mocked(ai.startAi).mockReturnValueOnce(pending.promise)
  render(<Root />); await ready()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Cancel me' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send to Quant' }))
  await waitFor(() => expect(ai.startAi).toHaveBeenCalled())
  const intent = vi.mocked(ai.startAi).mock.calls[0][0]
  fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
  await screen.findByText(/AI request cancelled/)
  await act(async () => pending.resolve(turn(intent)))
  expect(screen.queryByText(replyFor(2).content)).not.toBeInTheDocument()
})

it.each(['AI_REFUSED', 'AI_TIMEOUT', 'AI_STALE_CONTEXT', 'AI_INVALID_RESPONSE'])('shows %s with no fake assistant and offers Retry only after failure', async code => {
  vi.mocked(ai.startAi).mockImplementation(async intent => (completed = turn(intent, 'FAILED', code)))
  render(<Root />); await ready()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Potentially rejected' } })
  expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Send to Quant' }))
  await screen.findByText(ai.aiFailure(code))
  expect(screen.queryByText(replyFor(2).content)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
})

it('shows compact Gemini state and keeps disclosure behind the information control', async () => {
  vi.mocked(ai.getAiConfiguration).mockResolvedValue({ configured: true, provider: 'gemini', model: 'gemini-3.5-flash' })
  render(<Root />); await screen.findByText(/Gemini · AI ready/); await select()
  expect(screen.getByText(/Gemini · AI ready/)).toBeInTheDocument()
  expect(screen.queryByText(/Use synthetic data only/)).not.toBeVisible()
  fireEvent.click(screen.getByLabelText('AI provider details'))
  expect(screen.getByText('Gemini · gemini-3.5-flash')).toBeInTheDocument()
  expect(screen.getByText(/Use synthetic data only/)).toBeInTheDocument()
})

it('drops late provider state and private replies after identity changes', async () => {
  const late = deferred<ai.AiTurn>()
  vi.mocked(ai.startAi).mockReturnValueOnce(late.promise)
  const root = render(<Root />); await ready()
  fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Private owner A' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send to Quant' }))
  await waitFor(() => expect(ai.startAi).toHaveBeenCalled())
  const intent = vi.mocked(ai.startAi).mock.calls[0][0]
  root.rerender(<Root userId="owner-b" />)
  await act(async () => late.resolve(turn(intent)))
  expect(screen.queryByText(replyFor(2).content)).not.toBeInTheDocument()
})
