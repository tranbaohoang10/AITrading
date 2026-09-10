import { useCallback, useEffect, useState } from 'react'
import { App } from '../App'
import { ApiError, currentUser, type UserProfile } from './api'
import { AuthContext } from './AuthContext'
import { AuthForm, buttonClass } from './AuthForm'
import { ConversationProvider } from '../chat/ConversationProvider'
import { MarketProvider } from '../market/MarketProvider'
import { StrategyProvider } from '../strategy/StrategyProvider'
import { BacktestProvider } from '../backtest/BacktestProvider'
import { JournalProvider } from '../journal/JournalProvider'

export const SESSION_REVALIDATE_MS = 10 * 60_000

/** The real application entrypoint is gated; App stays a reusable workspace component. */
export function AuthenticatedApp() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [status, setStatus] = useState<'checking' | 'anonymous' | 'ready' | 'failed'>('checking')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const clearSession = useCallback(() => { setUser(null); setStatus('anonymous') }, [])
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

  useEffect(() => {
    if (!user || status !== 'ready') return
    let active = true, checking = false
    const accountId = user.id
    let lastValidation = Date.now()
    const revalidate = async (force = false) => {
      if (!active || checking || document.visibilityState !== 'visible') return
      if (!force && Date.now() - lastValidation < SESSION_REVALIDATE_MS) return
      checking = true
      lastValidation = Date.now()
      try {
        const profile = await currentUser(accountId)
        if (active && profile.id === accountId) setUser(profile)
      } catch (failure) {
        if (!active) return
        if (failure instanceof ApiError && failure.status === 401) clearSession()
      } finally { checking = false }
    }
    const resume = () => { if (document.visibilityState === 'visible') void revalidate(true) }
    const activity = () => { void revalidate() }
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    window.addEventListener('pointerdown', activity, true)
    window.addEventListener('keydown', activity, true)
    document.addEventListener('visibilitychange', resume)
    return () => {
      active = false
      window.removeEventListener('focus', resume)
      window.removeEventListener('online', resume)
      window.removeEventListener('pointerdown', activity, true)
      window.removeEventListener('keydown', activity, true)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [clearSession, status, user?.id])

  if (status === 'checking') return <main className="grid min-h-screen place-items-center bg-slate-950 text-slate-300"><p role="status">Checking your session…</p></main>
  if (status === 'failed') return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-slate-100"><div className="max-w-md space-y-5"><h1 className="text-xl font-semibold">Workspace unavailable</h1><p role="alert">{error}</p><button className={buttonClass} onClick={() => { setStatus('checking'); setAttempt(a => a + 1) }}>Retry connection</button></div></main>
  if (!user || status === 'anonymous') return <AuthForm onSignedIn={async () => { const profile = await currentUser(); setUser(profile); setStatus('ready') }} />
  return <AuthContext.Provider value={{ user, update: setUser, clear: clearSession }}>
    <ConversationProvider key={user.id}><MarketProvider><StrategyProvider><BacktestProvider><JournalProvider><App /></JournalProvider></BacktestProvider></StrategyProvider></MarketProvider></ConversationProvider>
  </AuthContext.Provider>
}
