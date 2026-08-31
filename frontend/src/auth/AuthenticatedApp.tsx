import { useEffect, useState } from 'react'
import { App } from '../App'
import { ApiError, currentUser, type UserProfile } from './api'
import { AuthContext } from './AuthContext'
import { AuthForm, buttonClass } from './AuthForm'
import { ConversationProvider } from '../chat/ConversationProvider'
import { MarketProvider } from '../market/MarketProvider'

/** The real application entrypoint is gated; App stays a reusable workspace component. */
export function AuthenticatedApp() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [status, setStatus] = useState<'checking' | 'anonymous' | 'ready' | 'failed'>('checking')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    currentUser().then(profile => {
      if (active) { setUser(profile); setStatus('ready') }
    }).catch(failure => {
      if (!active) return
      if (failure instanceof ApiError && failure.status === 401) setStatus('anonymous')
      else { setError(failure instanceof Error ? failure.message : 'Service unavailable.'); setStatus('failed') }
    })
    return () => { active = false }
  }, [attempt])

  if (status === 'checking') return <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-300"><p role="status">Checking your session…</p></main>
  if (status === 'failed') return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100"><div className="max-w-md space-y-5"><h1 className="text-xl font-semibold">Workspace unavailable</h1><p role="alert">{error}</p><button className={buttonClass} onClick={() => { setStatus('checking'); setAttempt(a => a + 1) }}>Retry connection</button></div></main>
  if (!user || status === 'anonymous') return <AuthForm onSignedIn={async () => { const profile = await currentUser(); setUser(profile); setStatus('ready') }} />
  return <AuthContext.Provider value={{ user, update: setUser, clear: () => { setUser(null); setStatus('anonymous') } }}>
    <ConversationProvider key={user.id}><MarketProvider><App /></MarketProvider></ConversationProvider>
  </AuthContext.Provider>
}
