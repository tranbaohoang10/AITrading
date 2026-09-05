import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthenticatedApp } from './AuthenticatedApp'
import { AuthForm } from './AuthForm'
import { AccountView } from './AccountView'
import { AuthContext } from './AuthContext'
import { currentUser, mutate } from './api'

const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.test', displayName: 'Researcher A' }
const response = (status: number, body: unknown = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const csrf = () => response(200, { headerName: 'X-CSRF-TOKEN', token: 'synthetic-csrf-token' })

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function signInFields() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@example.test' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Synthetic password 123!' } })
}

describe('PB-003 real entrypoint auth boundary (API contract mocks)', () => {
  it('shows a pending session then renders the workspace only after a valid profile', async () => {
    let finish!: (value: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
    render(<AuthenticatedApp />)
    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
    expect(screen.queryByTestId('chart-view')).not.toBeInTheDocument()
    await act(async () => { finish(response(200, user)) })
    expect(await screen.findByTestId('chart-view')).toBeInTheDocument()
  })

  it('keeps service failure distinct from an anonymous account and can retry', async () => {
    const network = vi.fn().mockResolvedValueOnce(response(503)).mockResolvedValueOnce(response(401))
    vi.stubGlobal('fetch', network)
    render(<AuthenticatedApp />)
    expect(await screen.findByRole('heading', { name: 'Workspace unavailable' })).toBeInTheDocument()
    expect(screen.queryByTestId('chart-view')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry connection' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(network).toHaveBeenCalledTimes(2)
  })

  it('handles registration acknowledgement, login and actual profile contract without local credential storage', async () => {
    let signedIn = false
    const network = vi.fn(async (path: string) => {
      if (path === '/api/auth/me') return response(signedIn ? 200 : 401, user)
      if (path === '/api/auth/csrf') return csrf()
      if (path === '/api/auth/register') return response(202, { status: 'REGISTRATION_RECEIVED' })
      if (path === '/api/auth/login') { signedIn = true; return response(204) }
      throw new Error(`Unexpected endpoint ${path}`)
    })
    vi.stubGlobal('fetch', network)
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    render(<AuthenticatedApp />)
    fireEvent.click(await screen.findByRole('button', { name: 'Create a new account' }))
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Researcher A' } })
    signInFields()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Registration received')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    signInFields()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByTestId('chart-view')).toBeInTheDocument()
    expect(storage).not.toHaveBeenCalled()
    for (const call of network.mock.calls) expect(call[0]).not.toContain('password')
  })

  it('does not accept a malformed profile as an authenticated user', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { email: 'a@example.test' })))
    await expect(currentUser()).rejects.toThrow('invalid account response')
  })
})

describe('PB-003 auth actions', () => {
  it('shows generic failed login and never calls success', async () => {
    const success = vi.fn()
    const network = vi.fn(async (path: string) => path.endsWith('/csrf') ? csrf() : response(401, { password: 'must not echo server content' }))
    vi.stubGlobal('fetch', network)
    render(<AuthForm onSignedIn={success} />)
    signInFields(); fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to authenticate')
    expect(screen.getByRole('alert')).not.toHaveTextContent('must not echo')
    expect(success).not.toHaveBeenCalled()
  })

  it('suppresses repeated submit while the request is pending', async () => {
    let finish!: (value: Response) => void
    const success = vi.fn().mockResolvedValue(undefined)
    const network = vi.fn((path: string) => path.endsWith('/csrf') ? Promise.resolve(csrf())
      : new Promise<Response>(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', network)
    render(<AuthForm onSignedIn={success} />)
    signInFields()
    const form = screen.getByRole('button', { name: 'Sign in' }).closest('form')!
    fireEvent.submit(form); fireEvent.submit(form)
    await waitFor(() => expect(network).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText('Password')).toBeDisabled()
    await act(async () => { finish(response(204)) })
    expect(success).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('refreshes CSRF per action and does not replay an uncertain mutation', async () => {
    const network = vi.fn(async (path: string) => {
      if (path.endsWith('/csrf')) return csrf()
      throw new TypeError('Synthetic interrupted response')
    })
    vi.stubGlobal('fetch', network)
    await expect(mutate('/auth/logout')).rejects.toThrow('Cannot reach')
    expect(network).toHaveBeenCalledTimes(2)
  })

  it('retries exactly once after a server-confirmed stale CSRF rejection', async () => {
    const network = vi.fn(async (path: string) => {
      if (path.endsWith('/csrf')) return csrf()
      return network.mock.calls.filter(call => !String(call[0]).endsWith('/csrf')).length === 1
        ? response(403, { code: 'CSRF_INVALID' }) : response(204)
    })
    vi.stubGlobal('fetch', network)
    await expect(mutate('/auth/logout')).resolves.toBeUndefined()
    expect(network).toHaveBeenCalledTimes(4)
  })

  it('shows the canonical local URL for a rejected frontend origin', async () => {
    vi.stubGlobal('fetch', vi.fn(async (path: string) => path.endsWith('/csrf') ? csrf() : response(403, { code: 'ORIGIN_FORBIDDEN' })))
    render(<AuthForm onSignedIn={vi.fn()} />)
    signInFields(); fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('127.0.0.1:5173')
  })

  it.each([403, 429, 503])('shows actionable %i failure without success', async status => {
    vi.stubGlobal('fetch', vi.fn(async (path: string) => path.endsWith('/csrf') ? csrf() : response(status)))
    const success = vi.fn()
    render(<AuthForm onSignedIn={success} />)
    signInFields(); fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(success).not.toHaveBeenCalled()
  })
})

describe('PB-003 account rendering and revocation UX', () => {
  it('renders hostile profile text safely and updates only displayName', async () => {
    const update = vi.fn()
    const hostile = { ...user, displayName: '<img src=x onerror=alert(1)>' }
    const network = vi.fn(async (path: string) => path.endsWith('/csrf') ? csrf() : response(200, { ...user, displayName: 'Renamed' }))
    vi.stubGlobal('fetch', network)
    const { container } = render(<AuthContext.Provider value={{ user: hostile, update, clear: vi.fn() }}><AccountView /></AuthContext.Provider>)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText(hostile.displayName)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save display name' }))
    expect(await screen.findByRole('status')).toHaveTextContent('saved')
    expect(update).toHaveBeenCalledWith({ ...user, displayName: 'Renamed' })
  })

  it('clears the local session only after successful password change', async () => {
    const clear = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async (path: string) => path.endsWith('/csrf') ? csrf() : response(204)))
    render(<AuthContext.Provider value={{ user, update: vi.fn(), clear }}><AccountView /></AuthContext.Provider>)
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Synthetic current password!' } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Synthetic changed password!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
    await waitFor(() => expect(clear).toHaveBeenCalledTimes(1))
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.getByLabelText('New password')).toHaveValue('')
  })

  it('does not claim sign-out if server revocation failed', async () => {
    const clear = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async (path: string) => path.endsWith('/csrf') ? csrf() : response(503)))
    render(<AuthContext.Provider value={{ user, update: vi.fn(), clear }}><AccountView /></AuthContext.Provider>)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable')
    expect(clear).not.toHaveBeenCalled()
  })
})

it('PB-027 clears stale account controls on401 and carries the displayed account to logout', async () => {
  const clear = vi.fn(), network = vi.fn(async (path: string) => path.endsWith('/csrf') ? csrf() : response(401))
  vi.stubGlobal('fetch', network)
  render(<AuthContext.Provider value={{ user, clear, update: vi.fn() }}><AccountView /></AuthContext.Provider>)
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await waitFor(() => expect(clear).toHaveBeenCalledTimes(1))
  const options = (network.mock.calls[1] as unknown as [string, RequestInit])[1]
  expect(new Headers(options.headers).get('X-Workspace-User')).toBe(user.id)
})

it('PB-027 ignores a late logout acknowledgement after the account view is remounted', async () => {
  let finish!: (r: Response) => void
  const clear = vi.fn(), network = vi.fn(async (path: string) => path.endsWith('/csrf') ? csrf() : new Promise<Response>(resolve => { finish = resolve }))
  vi.stubGlobal('fetch', network)
  const app = render(<AuthContext.Provider value={{ user, clear, update: vi.fn() }}><AccountView key="a" /></AuthContext.Provider>)
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await waitFor(() => expect(network).toHaveBeenCalledTimes(2))
  app.rerender(<AuthContext.Provider value={{ user: { ...user, id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', displayName: 'B' }, clear, update: vi.fn() }}><AccountView key="b" /></AuthContext.Provider>)
  await act(async () => finish(response(204)))
  expect(clear).not.toHaveBeenCalled(); expect(screen.getByLabelText('Display name')).toHaveValue('B')
})
