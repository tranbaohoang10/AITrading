import { act, fireEvent, render, screen } from '@testing-library/react'
import { AuditPanel } from './AuditPanel'
import { loadActivity, parsePage, type AuditEvent } from './api'
import { AuthContext } from '../auth/AuthContext'

const a = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.test', displayName: 'A' }
const b = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'b@example.test', displayName: 'B' }
const event = (id = '30'): AuditEvent => ({ id, occurredAt: '2026-08-31T12:00:00Z', requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', category: 'AUTH', operation: 'LOGIN', method: 'POST', httpStatus: 204, resourceId: null, errorCode: null })
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const view = (user = a, clear = vi.fn()) => <AuthContext.Provider value={{ user, clear, update: vi.fn() }}><AuditPanel /></AuthContext.Provider>
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('loads only explicitly with captured owner, verifies account and renders safe metadata', async () => {
  const network = vi.fn(async (path: string) => response(path === '/api/auth/me' ? a : { items: [event()], nextCursor: null }))
  vi.stubGlobal('fetch', network); render(view())
  expect(network).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Load activity' }))
  expect(await screen.findByText('LOGIN · HTTP 204')).toBeInTheDocument()
  expect(screen.getByText(`Request ID: ${event().requestId}`)).toBeInTheDocument()
  expect(network.mock.calls[0][0]).toBe('/api/audit?limit=25')
  const options = (network.mock.calls as unknown as [string, RequestInit][])[0][1]
  expect(new Headers(options.headers).get('X-Workspace-User')).toBe(a.id)
  expect(screen.queryByText(a.email)).not.toBeInTheDocument()
})

it('paginates with a bounded cursor, replaces page and can refresh', async () => {
  let pages = 0
  const network = vi.fn(async (path: string) => {
    if (path === '/api/auth/me') return response(a)
    pages++
    return response(pages === 1 ? { items: Array.from({ length: 25 }, (_, i) => event(String(30 - i))), nextCursor: '6' }
      : { items: pages === 2 ? [event('5')] : [], nextCursor: null })
  })
  vi.stubGlobal('fetch', network); render(view()); fireEvent.click(screen.getByRole('button', { name: 'Load activity' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Older activity' }))
  expect(await screen.findByRole('button', { name: 'Refresh activity' })).toBeInTheDocument()
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  expect(network.mock.calls.map(c => c[0])).toContain('/api/audit?limit=25&before=6')
  fireEvent.click(screen.getByRole('button', { name: 'Refresh activity' }))
  expect(await screen.findByText('No activity in this period.')).toBeInTheDocument()
})

it('handles loading, network failure, retry and401 without leaking server payload', async () => {
  const clear = vi.fn()
  const network = vi.fn().mockResolvedValueOnce(response({ secret: 'must-not-render' }, 503)).mockResolvedValueOnce(response({}, 401))
  vi.stubGlobal('fetch', network); render(view(a, clear)); fireEvent.click(screen.getByRole('button', { name: 'Load activity' }))
  expect(screen.getByRole('status')).toHaveTextContent('Loading activity')
  expect(await screen.findByRole('alert')).not.toHaveTextContent('must-not-render')
  fireEvent.click(screen.getByRole('button', { name: 'Load activity' }))
  await screen.findByText(/Unable to authenticate/); expect(clear).toHaveBeenCalledOnce()
})

it('ignores delayed data from a previous account after keyed replacement', async () => {
  let finish!: (r: Response) => void
  const network = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve })).mockResolvedValue(response(a))
  vi.stubGlobal('fetch', network); const rendered = render(view(a))
  fireEvent.click(screen.getByRole('button', { name: 'Load activity' })); rendered.rerender(view(b))
  await act(async () => { finish(response({ items: [event()], nextCursor: null })) })
  expect(screen.queryByText('LOGIN · HTTP 204')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Load activity' })).toBeEnabled()
})

it('rejects malformed, injected, duplicate, unsorted, oversized and inconsistent pages', () => {
  const valid = { items: [event()], nextCursor: null }
  expect(parsePage(valid)).toEqual(valid)
  for (const patch of [{ id: '01' }, { id: '9223372036854775808' }, { operation: '<img onerror=alert(1)>' }, { category: 'ADMIN' }, { method: 'TRACE' }, { httpStatus: 999 }, { requestId: '<script>' }, { occurredAt: 'not-a-date' }, { errorCode: 'private SQL' }, { resourceId: a.id }, { category: 'JOB' }])
    expect(() => parsePage({ ...valid, items: [{ ...event(), ...patch }] })).toThrow('Invalid activity')
  for (const value of [null, [], { items: Array.from({ length: 26 }, () => event()), nextCursor: null }, { items: [event(), event()], nextCursor: null }, { items: [event('1'), event('2')], nextCursor: null }, { ...valid, nextCursor: '30' }])
    expect(() => parsePage(value)).toThrow('Invalid activity')
  expect(() => parsePage(valid, '30')).toThrow('Invalid activity')
  expect(parsePage({ items: [{ ...event(), category: 'JOB', operation: 'JOB_FAILED', method: 'JOB', httpStatus: null, resourceId: a.id, errorCode: 'WORKER_FAILED' }], nextCursor: null }).items[0].errorCode).toBe('WORKER_FAILED')
})

it('bounds wire bytes, rejects bad cursors before network and rechecks owner after response', async () => {
  const network = vi.fn().mockResolvedValueOnce(new Response(' '.repeat(65537))).mockResolvedValueOnce(response({ items: [event()], nextCursor: null })).mockResolvedValueOnce(response(b))
  vi.stubGlobal('fetch', network)
  await expect(loadActivity(a.id, '1&owner=other')).rejects.toThrow('Invalid activity'); expect(network).not.toHaveBeenCalled()
  await expect(loadActivity(a.id)).rejects.toThrow('Invalid activity')
  await expect(loadActivity(a.id)).rejects.toThrow('Invalid activity')
})

it('never exposes malformed success-body contents through native JSON error messages', async () => {
  const network = vi.fn().mockResolvedValueOnce(new Response('<private-response-secret>'))
    .mockResolvedValueOnce(response({ items: [event()], nextCursor: null }))
    .mockResolvedValueOnce(new Response('<private-account-secret>'))
  vi.stubGlobal('fetch', network)
  for (let i = 0; i < 2; i++) await expect(loadActivity(a.id)).rejects.toThrow('Invalid activity response. Please reload.')
})
