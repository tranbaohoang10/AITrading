import { act, fireEvent, render, screen } from '@testing-library/react'
import { NotificationPanel } from './NotificationPanel'
import * as api from './api'
import { AuthContext } from '../auth/AuthContext'
import { ApiError } from '../auth/api'

const a = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.test', displayName: 'A' }
const b = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'b@example.test', displayName: 'B' }
const notice = (n = 30): api.Notice => ({ id: String(n), jobId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, state: 'SUCCEEDED', errorCode: null, createdAt: '2026-08-31T12:00:00Z', readAt: null })
const page = (items = [notice()], unreadCount = items.filter(x => !x.readAt).length): api.NoticePage => ({ items, nextCursor: null, unreadCount })
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const view = (user = a, clear = vi.fn(), open = vi.fn(), locked = false) => <AuthContext.Provider value={{ user, clear, update: vi.fn() }}><NotificationPanel locked={locked} onOpenJob={open} /></AuthContext.Provider>
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('checks only on demand and renders real response metadata/read count, then opens existing job', async () => {
  const load = vi.spyOn(api, 'listNotices').mockResolvedValue(page())
  const open = vi.fn(); render(view(a, vi.fn(), open)); expect(load).not.toHaveBeenCalled()
  expect(screen.queryByText(/Unread:/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Check notifications' }))
  expect(await screen.findByText('Unread: 1')).toBeInTheDocument()
  expect(screen.getByText('Backtest succeeded · Unread')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: `Open job ${notice().jobId}` }))
  expect(open).toHaveBeenCalledExactlyOnceWith(notice().jobId)
  expect(load).toHaveBeenCalledWith(a.id, undefined)
})

it('marks one notice read once while pending and reloads authoritative count/page', async () => {
  const read = { ...notice(), readAt: '2026-08-31T12:10:00Z' }
  const load = vi.spyOn(api, 'listNotices').mockResolvedValueOnce(page()).mockResolvedValueOnce(page([read], 0))
  let finish!: (value: api.Notice) => void
  const mark = vi.spyOn(api, 'markRead').mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(view()); fireEvent.click(screen.getByRole('button', { name: 'Check notifications' }))
  const button = await screen.findByRole('button', { name: 'Mark notification 30 read' })
  fireEvent.click(button); fireEvent.click(button); expect(mark).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('Loading notifications')
  await act(async () => { finish(read) })
  expect(await screen.findByText('Unread: 0')).toBeInTheDocument(); expect(screen.getByText('Backtest succeeded · Read')).toBeInTheDocument()
  expect(load).toHaveBeenCalledTimes(2); expect(screen.queryByRole('button', { name: 'Mark notification 30 read' })).not.toBeInTheDocument()
})

it('replaces older pages, handles empty refresh and shows honest uncertain read failures', async () => {
  const load = vi.spyOn(api, 'listNotices').mockResolvedValueOnce({ items: Array.from({ length: 25 }, (_, i) => notice(30 - i)), nextCursor: '6', unreadCount: 30 })
    .mockResolvedValueOnce(page([notice(5)])).mockResolvedValueOnce(page([], 0))
  vi.spyOn(api, 'markRead').mockRejectedValue(new ApiError(503))
  render(view()); fireEvent.click(screen.getByRole('button', { name: 'Check notifications' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Older notifications' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Mark notification 5 read' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Read state may have been saved')
  expect(load).toHaveBeenNthCalledWith(2, a.id, '6')
  fireEvent.click(screen.getByRole('button', { name: 'Check notifications' }))
  expect(await screen.findByText('No backtest notifications in this period.')).toBeInTheDocument()
})

it('ignores late old-account pages and clears only the active workspace on401', async () => {
  let finish!: (value: api.NoticePage) => void
  vi.spyOn(api, 'listNotices').mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockRejectedValueOnce(new ApiError(401))
  const clearA = vi.fn(), clearB = vi.fn(); const rendered = render(view(a, clearA))
  fireEvent.click(screen.getByRole('button', { name: 'Check notifications' })); rendered.rerender(view(b, clearB))
  await act(async () => { finish(page()) })
  expect(screen.queryByText('Backtest succeeded · Unread')).not.toBeInTheDocument(); expect(clearA).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Check notifications' }))
  await screen.findByRole('alert'); expect(clearB).toHaveBeenCalledOnce()
})

it('ignores late mark-read across accounts and honors existing backtest lock', async () => {
  const load = vi.spyOn(api, 'listNotices').mockResolvedValue(page())
  let finish!: (value: api.Notice) => void
  vi.spyOn(api, 'markRead').mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const rendered = render(view(a, vi.fn(), vi.fn(), true)); expect(screen.getByRole('button', { name: 'Check notifications' })).toBeDisabled()
  rendered.rerender(view(a)); fireEvent.click(screen.getByRole('button', { name: 'Check notifications' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Mark notification 30 read' })); rendered.rerender(view(b))
  await act(async () => { finish({ ...notice(), readAt: '2026-08-31T12:10:00Z' }) })
  expect(screen.queryByText(/Backtest succeeded/)).not.toBeInTheDocument()
  expect(load).toHaveBeenCalledExactlyOnceWith(a.id, undefined)
})

it('rejects malformed metadata, negative/unsafe counts, duplicates, ordering and cursor mismatch', () => {
  expect(api.parsePage(page())).toEqual(page())
  for (const patch of [{ id: '01' }, { id: '9223372036854775808' }, { jobId: 'other-user' }, { state: '<script>' }, { errorCode: 'secret' }, { readAt: 'bad-time' }, { createdAt: 'bad-time' }])
    expect(() => api.parseNotice({ ...notice(), ...patch })).toThrow('Invalid notification')
  expect(api.parseNotice({ ...notice(), state: 'FAILED', errorCode: 'WORKER_FAILED' }).state).toBe('FAILED')
  for (const value of [null, { ...page(), unreadCount: -1 }, { ...page(), unreadCount: Number.MAX_SAFE_INTEGER + 1 }, { ...page(), unreadCount: 0 }, { ...page(), nextCursor: '30' }, page([notice(), notice()]), page([notice(1), notice(2)]), page(Array.from({ length: 26 }, (_, i) => notice(30 - i)))])
    expect(() => api.parsePage(value)).toThrow('Invalid notification')
  expect(() => api.parsePage(page(), '30')).toThrow('Invalid notification')
})

it('HTTP contract captures owner and fresh CSRF, validates stable read identity and verifies session', async () => {
  const read = { ...notice(), readAt: '2026-08-31T12:10:00Z' }
  const network = vi.fn().mockResolvedValueOnce(response(page())).mockResolvedValueOnce(response(a))
    .mockResolvedValueOnce(response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf' })).mockResolvedValueOnce(response(read)).mockResolvedValueOnce(response(a))
  vi.stubGlobal('fetch', network)
  expect(await api.listNotices(a.id)).toEqual(page()); expect(await api.markRead(a.id, notice())).toEqual(read)
  const [url, options] = network.mock.calls[3] as [string, RequestInit]
  expect(url).toBe('/api/backtests/notifications/30/read'); expect(options.body).toBe('{}')
  const headers = new Headers(options.headers); expect(headers.get('X-Workspace-User')).toBe(a.id); expect(headers.get('X-CSRF-TOKEN')).toBe('synthetic-csrf')
  expect(options.credentials).toBe('same-origin')
})

it('wire bounds and malformed notification/account/token errors are redacted; mismatched read responses rejected', async () => {
  const network = vi.fn().mockResolvedValueOnce(new Response(' '.repeat(65537))).mockResolvedValueOnce(new Response('<private-notification-secret>'))
    .mockResolvedValueOnce(response(page())).mockResolvedValueOnce(new Response('<private-account-secret>'))
    .mockResolvedValueOnce(response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })).mockResolvedValueOnce(response({ ...notice(2), readAt: '2026-08-31T12:10:00Z' }))
    .mockResolvedValueOnce(new Response('<private-token-secret>'))
  vi.stubGlobal('fetch', network)
  await expect(api.listNotices(a.id, '1&owner=other')).rejects.toThrow('Invalid notification'); expect(network).not.toHaveBeenCalled()
  for (let i = 0; i < 3; i++) await expect(api.listNotices(a.id)).rejects.toThrow('Invalid notification response. Please refresh.')
  await expect(api.markRead(a.id, notice())).rejects.toThrow('Invalid notification')
  await expect(api.markRead(a.id, notice())).rejects.toThrow('Invalid notification response. Please refresh.')
})
