import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import { buttonClass } from '../auth/AuthForm'
import { loadActivity, type AuditPage } from './api'

export function AuditPanel() {
  const auth = useAuth()
  return auth ? <OwnedActivity key={auth.user.id} accountId={auth.user.id} clear={auth.clear} /> : null
}
function OwnedActivity({ accountId, clear }: { accountId: string; clear: () => void }) {
  const [page, setPage] = useState<AuditPage | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true), pending = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  async function load(before?: string) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setPage(null)
    try {
      const result = await loadActivity(accountId, before)
      if (active.current) setPage(result)
    } catch (failure) {
      if (active.current) {
        if (failure instanceof ApiError && failure.status === 401) clear()
        setError(failure instanceof Error ? failure.message : 'Activity is unavailable. Please retry.')
      }
    } finally { pending.current = false; if (active.current) setBusy(false) }
  }
  return <section aria-label="Account activity" className="space-y-4 border-t border-slate-800 pt-7" aria-busy={busy}>
    <h3 className="font-semibold">Account activity</h3>
    <p className="text-sm leading-6 text-slate-400">Your recent authentication, changes and backtest events. Metadata only; retained for 30 days. Anonymous attempts and successful reads are not shown. This is not a complete access history.</p>
    <button type="button" disabled={busy} className={buttonClass} onClick={() => void load()}>{page ? 'Refresh activity' : 'Load activity'}</button>
    {busy && <p role="status" className="text-sm text-slate-300">Loading activity…</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {page?.items.length === 0 && <p className="text-sm text-slate-400">No activity in this period.</p>}
    {page && <ol className="space-y-3">{page.items.map(event => <li key={event.id} className="min-w-0 space-y-2 rounded-lg border border-slate-700 p-3 text-sm">
      <p className="break-words font-medium">{event.operation.replaceAll('_', ' ')} · {event.httpStatus === null ? event.category : `HTTP ${event.httpStatus}`}</p>
      <time className="block break-all text-slate-400" dateTime={event.occurredAt}>{event.occurredAt}</time>
      <p className="break-all text-xs text-slate-400">Request ID: {event.requestId}</p>
      {event.resourceId && <p className="break-all text-xs text-slate-400">Job ID: {event.resourceId}</p>}
      {event.errorCode && <p className="break-words text-xs text-amber-300">{event.errorCode}</p>}
    </li>)}</ol>}
    {page?.nextCursor && <button type="button" disabled={busy} className={buttonClass} onClick={() => void load(page.nextCursor!)}>Older activity</button>}
  </section>
}
