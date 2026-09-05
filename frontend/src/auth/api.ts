export type UserProfile = { id: string; email: string; displayName: string }

export class ApiError extends Error {
  constructor(public status: number, public response?: Response, public code?: string) {
    super(code === 'ORIGIN_FORBIDDEN' ? 'This frontend origin is not allowed by the local API. Open http://127.0.0.1:5173.'
      : code === 'CSRF_INVALID' ? 'Your security state expired. It was refreshed safely; please retry.'
      : status === 429 ? 'Too many attempts. Please wait 15 minutes before trying again.'
      : status === 401 ? 'Unable to authenticate. Check your credentials or sign in again.'
        : status === 404 ? 'This resource no longer exists or is not available to your account.'
          : status === 409 ? 'The resource changed or a prototype limit was reached. Reload before trying again.'
        : status === 403 ? 'Your security token expired or the request was denied. Please retry.'
          : status === 400 ? 'Check the required fields and their length limits.'
            : status === 413 ? 'The request is too large.'
              : 'The service is unavailable. Please try again.')
  }
}

async function errorCode(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.clone().json()
    if (body && typeof body === 'object' && 'code' in body && typeof body.code === 'string'
      && /^(UNAUTHORIZED|FORBIDDEN|ORIGIN_FORBIDDEN|CSRF_INVALID|INVALID_REQUEST|UNAVAILABLE|RATE_LIMITED|NOT_FOUND|CONFLICT)$/.test(body.code)) return body.code
  } catch { /* Public error bodies are optional. */ }
  return undefined
}

export async function request(path: string, options: RequestInit = {}): Promise<Response> {
  let result: Response
  try {
    result = await fetch(`/api${path}`, { ...options, credentials: 'same-origin', cache: 'no-store', signal: options.signal ?? AbortSignal.timeout(15_000) })
  } catch {
    throw new Error('Cannot reach the service. Check your connection and retry.')
  }
  if (!result.ok) throw new ApiError(result.status, result, await errorCode(result))
  return result
}

export function workspaceHeaders(accountId: string | undefined): Headers {
  if (!accountId || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(accountId)) throw new ApiError(401)
  return new Headers({ 'X-Workspace-User': accountId })
}

export function privateRequest(accountId: string | undefined, path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers)
  // Capture from the calling workspace, never from a mutable global or a new session.
  headers.set('X-Workspace-User', workspaceHeaders(accountId).get('X-Workspace-User')!)
  return request(path, { ...options, headers: Object.fromEntries(headers) })
}

export async function currentUser(accountId?: string): Promise<UserProfile> {
  const body: unknown = await (await (accountId === undefined ? request('/auth/me') : privateRequest(accountId, '/auth/me'))).json()
  if (!body || typeof body !== 'object' || !('id' in body) || !('email' in body) || !('displayName' in body)
    || typeof body.id !== 'string' || typeof body.email !== 'string' || typeof body.displayName !== 'string') {
    throw new Error('The service returned an invalid account response. Please retry.')
  }
  return { id: body.id, email: body.email, displayName: body.displayName }
}

async function csrfToken(): Promise<{ headerName: string; token: string }> {
  const token: { headerName: string; token: string } = await (await request('/auth/csrf')).json()
  if (token.headerName !== 'X-CSRF-TOKEN' || typeof token.token !== 'string') throw new Error('Invalid security token response.')
  return token
}

export async function mutate(path: string, fields?: Record<string, string | number>, method = 'POST', form = false, accountId?: string) {
  // Fresh masked token for each user action; never persisted in browser storage.
  // Only a server-confirmed CSRF pre-handler rejection is retried once below.
  const headers = accountId === undefined ? new Headers() : workspaceHeaders(accountId)
  const body = form ? new URLSearchParams(Object.entries(fields ?? {}).map(([key, value]) => [key, String(value)])).toString() : JSON.stringify(fields ?? {})
  const send = async () => {
    const token = await csrfToken()
    headers.set('Content-Type', form ? 'application/x-www-form-urlencoded' : 'application/json')
    headers.set(token.headerName, token.token)
    return request(path, { method, headers, body })
  }
  let response: Response
  try { response = await send() }
  catch (failure) {
    // Spring rejects CSRF before invoking a mutation handler, so one fresh-token retry
    // is safe after a disposable local database has discarded an old SESSION record.
    if (!(failure instanceof ApiError) || failure.code !== 'CSRF_INVALID') throw failure
    response = await send()
  }
  return response.status === 204 ? undefined : response.json()
}

export function privateMutate(accountId: string | undefined, path: string, fields?: Record<string, string | number>, method = 'POST') {
  workspaceHeaders(accountId)
  return mutate(path, fields, method, false, accountId)
}
