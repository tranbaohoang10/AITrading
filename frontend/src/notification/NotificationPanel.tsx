import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../auth/api'
import { buttonClass } from '../auth/AuthForm'
import { listNotices, markRead, type Notice, type NoticePage } from './api'

export function NotificationPanel({ onOpenJob, locked }: { onOpenJob: (id: string) => void; locked: boolean }) {
  const auth = useAuth()
  return auth ? <OwnedNotifications key={auth.user.id} accountId={auth.user.id} clear={auth.clear} onOpenJob={onOpenJob} locked={locked} /> : null
}
function OwnedNotifications({ accountId, clear, onOpenJob, locked }: { accountId: string; clear: () => void; onOpenJob: (id: string) => void; locked: boolean }) {
  const [page, setPage] = useState<NoticePage | null>(null), [before, setBefore] = useState<string>()
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const active = useRef(true), pending = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  async function run(cursor?: string, notice?: Notice) {
    if (pending.current || locked) return
    pending.current = true; setBusy(true); setError(''); setPage(null)
    try {
      if (notice) await markRead(accountId, notice)
      if (!active.current) return
      const result = await listNotices(accountId, cursor)
      if (active.current) { setPage(result); setBefore(cursor) }
    } catch (failure) {
      if (active.current) {
        if (failure instanceof ApiError && failure.status === 401) clear()
        setError((failure instanceof Error ? failure.message : 'Notifications unavailable.') + (notice ? ' Read state may have been saved; refresh to check. Mark-read retries are safe.' : ''))
      }
    } finally { pending.current = false; if (active.current) setBusy(false) }
  }
  return <section aria-label="Backtest notifications" aria-busy={busy} className="mb-5 space-y-3 rounded-lg border border-slate-700 p-4 text-sm">
    <h3 className="font-semibold">Backtest notifications</h3>
    <p className="text-xs leading-5 text-slate-400">Completion, failure and cancellation inbox. Check or refresh to retrieve updates; no realtime or external messages. Metadata is retained for 30 days.</p>
    <button className={buttonClass} type="button" disabled={busy || locked} onClick={() => void run()}>{page ? 'Refresh notifications' : 'Check notifications'}</button>
    {busy && <p role="status">Loading notifications…</p>}
    {error && <p role="alert" className="text-amber-300">{error}</p>}
    {page && <p className="text-slate-300">Unread: {page.unreadCount}</p>}
    {page?.items.length === 0 && <p className="text-slate-400">No backtest notifications in this period.</p>}
    {page && <ol className="space-y-3">{page.items.map(notice => <li key={notice.id} className="min-w-0 space-y-2 border-t border-slate-800 pt-3">
      <p className="font-medium">Backtest {notice.state.toLowerCase()} · {notice.readAt ? 'Read' : 'Unread'}</p>
      <time className="block break-all text-xs text-slate-400" dateTime={notice.createdAt}>{notice.createdAt}</time>
      <p className="break-all text-xs text-slate-400">Job ID: {notice.jobId}</p>
      {notice.errorCode && <p className="break-words text-xs text-amber-300">{notice.errorCode}</p>}
      <div className="flex flex-wrap gap-2">
        {!notice.readAt && <button type="button" className={buttonClass} disabled={busy || locked} aria-label={`Mark notification ${notice.id} read`} onClick={() => void run(before, notice)}>Mark read</button>}
        <button type="button" className={buttonClass} disabled={busy || locked} aria-label={`Open job ${notice.jobId}`} onClick={() => onOpenJob(notice.jobId)}>Open job</button>
      </div>
    </li>)}</ol>}
    {page?.nextCursor && <button type="button" className={buttonClass} disabled={busy || locked} onClick={() => void run(page.nextCursor!)}>Older notifications</button>}
    <p className="text-xs text-slate-500">Jobs completed before notifications were enabled are not backfilled. Deleted jobs may no longer open.</p>
  </section>
}
