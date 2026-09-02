import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../auth/AuthContext'
import { ApiError } from '../auth/api'
import { ConversationProvider } from './ConversationProvider'
import { PersistentChat } from './PersistentChat'
import * as api from './api'
import * as ai from './aiApi'

vi.mock('./api', () => ({ listConversations: vi.fn(), getMessages: vi.fn(), createConversation: vi.fn(), saveMessage: vi.fn(), renameConversation: vi.fn(), deleteConversation: vi.fn() }))
vi.mock('./aiApi', async original => ({ ...await original<typeof import('./aiApi')>(), getAiConfiguration: vi.fn(), getLatestAiTurn: vi.fn(), startAi: vi.fn(), getAiTurn: vi.fn(), cancelAiTurn: vi.fn() }))
const alpha: api.Conversation = { id: '11111111-1111-4111-8111-111111111111', title: 'Alpha research', version: 1, createdAt: '2026-08-31T00:00:00Z', updatedAt: '2026-08-31T00:00:00Z', lastMessage: '' }
const beta: api.Conversation = { ...alpha, id: '22222222-2222-4222-8222-222222222222', title: 'Beta research' }
const message = (content: string, sequence = 1): api.Message => ({ sequence, requestId: crypto.randomUUID(), role: 'user', content, createdAt: alpha.createdAt })
const page = (conversation = alpha, items: api.Message[] = [], nextBefore: number | null = null): api.Messages => ({ conversation, items, nextBefore })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes }); return { promise, resolve } }
const clear = vi.fn()
function Root({ userId = 'owner-a' }: { userId?: string }) {
  return <AuthContext.Provider value={{ user: { id: userId, email: `${userId}@example.test`, displayName: 'Researcher' }, clear, update: vi.fn() }}><ConversationProvider key={userId}><PersistentChat /></ConversationProvider></AuthContext.Provider>
}
async function select(name = 'Alpha research') {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(name) }))
  await waitFor(() => expect(screen.queryByText('Loading messages…')).not.toBeInTheDocument())
}
function openMenu() { fireEvent.click(screen.getByLabelText('Conversation menu')) }

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.listConversations).mockResolvedValue({ items: [alpha, beta], nextCursor: null })
  vi.mocked(api.getMessages).mockImplementation(async id => page(id === alpha.id ? alpha : beta))
  vi.mocked(api.createConversation).mockResolvedValue(alpha)
  vi.mocked(api.renameConversation).mockResolvedValue({ ...alpha, title: 'Renamed', version: 2 })
  vi.mocked(api.deleteConversation).mockResolvedValue(undefined)
  vi.mocked(ai.getAiConfiguration).mockResolvedValue({ configured: false, provider: null, model: null })
  vi.mocked(ai.getLatestAiTurn).mockResolvedValue(null)
})

describe('PB-029 compact private conversation history and menu', () => {
  it('distinguishes loading, empty and failed lists and retries only after an error', async () => {
    const pending = deferred<api.Page>()
    vi.mocked(api.listConversations).mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ items: [], nextCursor: null })
    const root = render(<Root />)
    expect(screen.getByText('Loading history…')).toBeInTheDocument()
    await act(async () => pending.resolve({ items: [], nextCursor: null }))
    expect(screen.getByText('No conversations')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    root.unmount()
    vi.mocked(api.listConversations).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ items: [], nextCursor: null })
    render(<Root />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Offline')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('No conversations')
    expect(screen.queryByText('Refresh list')).not.toBeInTheDocument()
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
    openMenu(); expect(screen.getByLabelText('Conversation title')).toHaveValue('Beta research')
  })

  it('keeps separate drafts and creates a new conversation with a frozen request ID', async () => {
    render(<Root />); await select()
    fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Alpha unsent' } })
    await select('Beta research'); expect(screen.getByLabelText('Research message')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Research message'), { target: { value: 'Beta unsent' } })
    await select(); expect(screen.getByLabelText('Research message')).toHaveValue('Alpha unsent')
    vi.mocked(api.createConversation).mockRejectedValueOnce(new Error('Unknown create outcome')).mockResolvedValueOnce(beta)
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }))
    await screen.findByRole('alert')
    const requestId = vi.mocked(api.createConversation).mock.calls[0][0]
    fireEvent.click(screen.getByRole('button', { name: 'Retry new chat' }))
    await screen.findByText('Conversation created.')
    expect(api.createConversation).toHaveBeenNthCalledWith(2, requestId, 'owner-a')
  })

  it('keeps rename/delete inside the menu and requires delete confirmation', async () => {
    vi.mocked(api.renameConversation).mockRejectedValueOnce(new ApiError(409))
    render(<Root />); await select(); openMenu()
    fireEvent.change(screen.getByLabelText('Conversation title'), { target: { value: 'Stale rename' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename conversation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('changed')
    fireEvent.click(screen.getByRole('button', { name: 'Delete conversation' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
    expect(api.deleteConversation).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete conversation' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm delete' }))
    await screen.findByText('Conversation deleted.')
    expect(api.deleteConversation).toHaveBeenCalledWith(alpha, 'owner-a')
  })

  it('loads earlier pages without duplicates and renders hostile content as inert text', async () => {
    const hostile = '<img src=x onerror=alert(1)>'
    vi.mocked(api.getMessages).mockResolvedValueOnce(page(alpha, [message('Third', 3)], 3)).mockResolvedValueOnce(page(alpha, [message(hostile, 1), message('Second', 2)]))
    const { container } = render(<Root />); await select()
    fireEvent.click(screen.getByRole('button', { name: 'Load earlier' }))
    await screen.findByText(hostile)
    expect(container.querySelector('img')).toBeNull()
    expect([...container.querySelectorAll('article p:last-child')].map(p => p.textContent)).toEqual([hostile, 'Second', 'Third'])
    expect(api.getMessages).toHaveBeenLastCalledWith(alpha.id, 3, 'owner-a')
  })

  it('drops private state after identity change and clears expired authentication', async () => {
    const late = deferred<api.Messages>()
    vi.mocked(api.getMessages).mockReturnValueOnce(late.promise)
    const { rerender } = render(<Root />)
    fireEvent.click(await screen.findByRole('button', { name: /Alpha research/ }))
    vi.mocked(api.listConversations).mockResolvedValueOnce({ items: [], nextCursor: null })
    rerender(<Root userId="owner-b" />)
    await act(async () => late.resolve(page(alpha, [message('Private A late')])) )
    expect(await screen.findByText('No conversations')).toBeInTheDocument()
    expect(screen.queryByText('Private A late')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Research message')).toBeDisabled()
    vi.mocked(api.listConversations).mockRejectedValueOnce(new ApiError(401))
    rerender(<Root userId="owner-c" />)
    await waitFor(() => expect(clear).toHaveBeenCalled())
  })

  it('loads the next list page without duplicating conversation IDs', async () => {
    vi.mocked(api.listConversations).mockResolvedValueOnce({ items: [alpha], nextCursor: 'page-two' }).mockResolvedValueOnce({ items: [alpha, beta], nextCursor: null })
    render(<Root />)
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    await screen.findByRole('button', { name: /Beta research/ })
    expect(screen.getAllByRole('button', { name: /Alpha research/ })).toHaveLength(1)
    expect(api.listConversations).toHaveBeenLastCalledWith('page-two', 'owner-a')
  })

  it('keeps failed deletion visible until acknowledged', async () => {
    vi.mocked(api.deleteConversation).mockRejectedValueOnce(new ApiError(503))
    render(<Root />); await select(); openMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Delete conversation' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm delete' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('unavailable')
    expect(screen.queryByText('Conversation deleted.')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: /Alpha research/ })).toBeInTheDocument()
  })
})
