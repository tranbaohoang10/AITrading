import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/AuthContext'
import { ApiError } from '../auth/api'
import { ConversationProvider } from './ConversationProvider'
import { PersistentChat } from './PersistentChat'
import * as api from './api'

vi.mock('./api', () => ({ listConversations: vi.fn(), getMessages: vi.fn(), createConversation: vi.fn(), saveMessage: vi.fn(), renameConversation: vi.fn(), deleteConversation: vi.fn() }))
const alpha: api.Conversation = { id: '11111111-1111-4111-8111-111111111111', title: 'Alpha research', version: 1, createdAt: '2026-08-31T00:00:00Z', updatedAt: '2026-08-31T00:00:00Z', lastMessage: '' }
const beta: api.Conversation = { ...alpha, id: '22222222-2222-4222-8222-222222222222', title: 'Beta research' }
const message = (content: string, sequence = 1): api.Message => ({ sequence, requestId: crypto.randomUUID(), role: 'user', content, createdAt: alpha.createdAt })
const page = (conversation = alpha, items: api.Message[] = [], nextBefore: number | null = null): api.Messages => ({ conversation, items, nextBefore })
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const clear = vi.fn()
function Root({ userId = 'owner-a' }: { userId?: string }) {
  return <AuthContext.Provider value={{ user: { id: userId, email: `${userId}@example.test`, displayName: 'Researcher' }, clear, update: vi.fn() }}><ConversationProvider key={userId}><PersistentChat /></ConversationProvider></AuthContext.Provider>
}
async function select(name = 'Alpha research') {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }))
  await waitFor(() => expect(screen.queryByText('Loading messages…')).not.toBeInTheDocument())
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.listConversations).mockResolvedValue({ items: [alpha, beta], nextCursor: null })
  vi.mocked(api.getMessages).mockImplementation(async id => page(id === alpha.id ? alpha : beta))
  vi.mocked(api.createConversation).mockResolvedValue(alpha)
  vi.mocked(api.renameConversation).mockResolvedValue({ ...alpha, title: 'Renamed', version: 2 })
  vi.mocked(api.saveMessage).mockResolvedValue(message('Saved'))
  vi.mocked(api.deleteConversation).mockResolvedValue(undefined)
})

describe('PB-004 private conversation UI (API contract mocks)', () => {
  it('distinguishes loading, empty and failed lists without inventing conversations', async () => {
    const pending = deferred<api.Page>()
    vi.mocked(api.listConversations).mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error('Offline'))
    render(<Root />)
    expect(screen.getByText('Loading conversations…')).toBeInTheDocument()
    await act(async () => pending.resolve({ items: [], nextCursor: null }))
    expect(screen.getByText(/No conversations yet/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh list' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
    expect(screen.queryByRole('button', { name: 'Save message' })).not.toBeInTheDocument()
  })

  it('ignores a late response from a previously selected conversation', async () => {
    const late = deferred<api.Messages>()
    vi.mocked(api.getMessages).mockImplementation(id => id === alpha.id ? late.promise : Promise.resolve(page(beta, [message('Only Beta')])) )
    render(<Root />)
    fireEvent.click(await screen.findByRole('button', { name: /Alpha research/ }))
    expect(screen.getByText('Loading messages…')).toBeInTheDocument()
    await select('Beta research')
    expect(screen.getByText('Only Beta')).toBeInTheDocument()
    await act(async () => late.resolve(page(alpha, [message('Private Alpha late')])) )
    expect(screen.queryByText('Private Alpha late')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Conversation title')).toHaveValue('Beta research')
  })

  it('keeps separate drafts when selecting conversations and creating a new one', async () => {
    render(<Root />); await select()
    fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Alpha unsent' } })
    await select('Beta research')
    expect(screen.getByLabelText('Research message')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Beta unsent' } })
    await select()
    expect(screen.getByLabelText('Research message')).toHaveValue('Alpha unsent')
    vi.mocked(api.createConversation).mockResolvedValueOnce({ ...beta, id: '33333333-3333-4333-8333-333333333333' })
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))
    await screen.findByText('Conversation created.')
    await select()
    expect(screen.getByLabelText('Research message')).toHaveValue('Alpha unsent')
  })

  it('retains the exact idempotency key and draft on uncertain send, then retries once', async () => {
    vi.mocked(api.saveMessage).mockRejectedValueOnce(new Error('Connection lost after sending'))
    render(<Root />); await select()
    fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Original research' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save message' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('uncertain')
    expect(screen.getByLabelText('Research message')).toHaveValue('Original research')
    expect(screen.getByLabelText('Research message')).toBeDisabled()
    expect(screen.getByRole('button', { name: /Beta research/ })).toBeDisabled()
    const firstCall = vi.mocked(api.saveMessage).mock.calls[0]
    vi.mocked(api.getMessages).mockResolvedValueOnce(page({ ...alpha, version: 2 }, [message('Original research')]))
    fireEvent.click(screen.getByRole('button', { name: 'Retry save' }))
    await screen.findByText('Original research')
    expect(api.saveMessage).toHaveBeenCalledTimes(2)
    expect(vi.mocked(api.saveMessage).mock.calls[1]).toEqual(firstCall)
    expect(screen.getByLabelText('Research message')).toHaveValue('')
    expect(screen.getByText(/Message saved/)).toBeInTheDocument()
  })

  it('does not double-submit while a save is pending', async () => {
    const pending = deferred<api.Message>()
    vi.mocked(api.saveMessage).mockReturnValueOnce(pending.promise)
    render(<Root />); await select()
    fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Once only' } })
    const button = screen.getByRole('button', { name: 'Save message' })
    fireEvent.click(button); fireEvent.click(button)
    expect(api.saveMessage).toHaveBeenCalledTimes(1)
    await act(async () => pending.resolve(message('Once only')))
    expect(await screen.findByText(/Message saved/)).toBeInTheDocument()
  })

  it('permits editing after a definite validation rejection without claiming saved', async () => {
    vi.mocked(api.saveMessage).mockRejectedValueOnce(new ApiError(400))
    render(<Root />); await select()
    fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Invalid\u0001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save message' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Research message')).not.toBeDisabled()
    expect(screen.queryByText(/Message saved/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Research message')).toHaveValue('Invalid\u0001')
  })

  it('retries uncertain creation with its original key even while an old conversation is selected', async () => {
    vi.mocked(api.createConversation).mockRejectedValueOnce(new Error('Unknown create outcome')).mockResolvedValueOnce(beta)
    render(<Root />); await select()
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))
    await screen.findByRole('alert')
    const firstKey = vi.mocked(api.createConversation).mock.calls[0][0]
    fireEvent.click(screen.getByRole('button', { name: 'Retry New Chat' }))
    await screen.findByText('Conversation created.')
    expect(api.createConversation).toHaveBeenNthCalledWith(2, firstKey)
    expect(screen.getByLabelText('Conversation title')).toHaveValue('Beta research')
  })

  it('keeps conflict visible, does not overwrite server metadata, and requires delete confirmation', async () => {
    vi.mocked(api.renameConversation).mockRejectedValueOnce(new ApiError(409))
    render(<Root />); await select()
    fireEvent.change(screen.getByLabelText('Conversation title'), { target: { value: 'Stale rename' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('changed')
    expect(screen.queryByText('Conversation renamed.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(api.deleteConversation).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm delete' }))
    await screen.findByText('Conversation deleted.')
    expect(api.deleteConversation).toHaveBeenCalledWith(alpha)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('loads earlier pages without duplicating messages and keeps content as inert text', async () => {
    const hostile = '<img src=x onerror=alert(1)>'
    vi.mocked(api.getMessages).mockResolvedValueOnce(page(alpha, [message('Third', 3)], 3))
      .mockResolvedValueOnce(page(alpha, [message(hostile, 1), message('Second', 2)]))
    const { container } = render(<Root />); await select()
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier messages' }))
    await screen.findByText(hostile)
    expect(container.querySelector('img')).toBeNull()
    expect([...container.querySelectorAll('article p:last-child')].map(p => p.textContent)).toEqual([hostile, 'Second', 'Third'])
    expect(api.getMessages).toHaveBeenLastCalledWith(alpha.id, 3)
    expect(screen.queryByRole('button', { name: 'Load earlier messages' })).not.toBeInTheDocument()
  })

  it('drops private state and pending responses when authenticated identity changes', async () => {
    const late = deferred<api.Messages>()
    vi.mocked(api.getMessages).mockReturnValueOnce(late.promise)
    const { rerender } = render(<Root />)
    fireEvent.click(await screen.findByRole('button', { name: /Alpha research/ }))
    vi.mocked(api.listConversations).mockResolvedValueOnce({ items: [], nextCursor: null })
    rerender(<Root userId="owner-b" />)
    await act(async () => late.resolve(page(alpha, [message('Private A late')])) )
    expect(await screen.findByText(/No conversations yet/)).toBeInTheDocument()
    expect(screen.queryByText('Private A late')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Research message')).not.toBeInTheDocument()
  })

  it('clears authentication on expired-session API response', async () => {
    vi.mocked(api.listConversations).mockRejectedValueOnce(new ApiError(401))
    render(<Root />)
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Alpha research')).not.toBeInTheDocument()
  })

  it('loads the next list page without duplicating conversation IDs', async () => {
    vi.mocked(api.listConversations).mockResolvedValueOnce({ items: [alpha], nextCursor: 'page-two' })
      .mockResolvedValueOnce({ items: [alpha, beta], nextCursor: null })
    render(<Root />)
    fireEvent.click(await screen.findByRole('button', { name: 'Load more conversations' }))
    await screen.findByRole('button', { name: /Beta research/ })
    expect(screen.getAllByRole('button', { name: /Alpha research/ })).toHaveLength(1)
    expect(api.listConversations).toHaveBeenLastCalledWith('page-two')
    expect(screen.queryByRole('button', { name: 'Load more conversations' })).not.toBeInTheDocument()
  })

  it('keeps failed deletion visible and retains the conversation until acknowledged', async () => {
    vi.mocked(api.deleteConversation).mockRejectedValueOnce(new ApiError(503))
    render(<Root />); await select()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm delete' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('unavailable')
    expect(screen.queryByText('Conversation deleted.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Conversation title')).toHaveValue('Alpha research')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: /Alpha research/ })).toBeInTheDocument()
  })
})
