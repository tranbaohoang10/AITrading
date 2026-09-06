import { useEffect, useState } from 'react'
import { buttonClass, inputClass } from '../auth/AuthForm'
import { useAuth } from '../auth/AuthContext'
import { chartTimezoneOptions } from './chartTimezone'
import * as api from './marketIntelligenceApi'

const today = new Date().toISOString().slice(0, 10)
const after = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

export function MarketIntelligenceWorkspace() {
  const auth = useAuth(), accountId = auth?.user.id
  const [tab, setTab] = useState<'news' | 'calendar'>('news')
  const [query, setQuery] = useState('EUR USD')
  const [timezone, setTimezone] = useState('UTC')
  const [from, setFrom] = useState(today), [to, setTo] = useState(after)
  const [status, setStatus] = useState<api.IntelligenceStatus | null>(null)
  const [news, setNews] = useState<api.NewsResponse | null>(null), [calendar, setCalendar] = useState<api.CalendarResponse | null>(null)
  const [loading, setLoading] = useState(false), [error, setError] = useState('')
  useEffect(() => { if (!accountId) return; let alive = true; void api.getStatus(accountId).then(value => { if (alive) setStatus(value) }).catch(cause => { if (alive) setError(cause instanceof Error ? cause.message : 'Unable to load provider status.') }); return () => { alive = false } }, [accountId])
  const loadNews = async () => { if (!accountId) return; setLoading(true); setError(''); try { setNews(await api.getNews(accountId, query, timezone)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load market news.') } finally { setLoading(false) } }
  const loadCalendar = async () => { if (!accountId) return; setLoading(true); setError(''); try { setCalendar(await api.getCalendar(accountId, from, to, timezone)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load the economic calendar.') } finally { setLoading(false) } }
  const feed = tab === 'news' ? status?.news : status?.calendar
  return <section aria-label="Market Intelligence" className="h-full overflow-y-auto bg-slate-950 p-3 text-slate-100 sm:p-5">
    <header className="mb-4"><p className="eyebrow">External evidence boundary</p><h1 className="text-xl font-semibold">Market Intelligence</h1><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">News and economic events are provider data, shown with source/timezone metadata. The workspace never fills missing provider data with synthetic headlines or calendar events.</p></header>
    <div role="tablist" aria-label="Market intelligence sections" className="mb-4 flex gap-1 border-b border-slate-800"><button role="tab" aria-selected={tab === 'news'} type="button" className={`min-h-9 border-b-2 px-3 text-xs font-semibold ${tab === 'news' ? 'border-slate-200 text-slate-100' : 'border-transparent text-slate-500'}`} onClick={() => setTab('news')}>Market News</button><button role="tab" aria-selected={tab === 'calendar'} type="button" className={`min-h-9 border-b-2 px-3 text-xs font-semibold ${tab === 'calendar' ? 'border-slate-200 text-slate-100' : 'border-transparent text-slate-500'}`} onClick={() => setTab('calendar')}>Economic Calendar</button></div>
    {error && <p role="alert" className="mb-4 border border-amber-800 bg-amber-950/20 p-3 text-sm text-amber-200">{error}</p>}
    <div className="mb-4 grid gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
      {tab === 'news' ? <label className="grid gap-1 text-xs text-slate-400">Symbols or topic<input className={inputClass} value={query} maxLength={80} onChange={event => setQuery(event.target.value)} placeholder="EUR USD, central bank…" /></label> : <div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs text-slate-400">From<input className={`${inputClass} font-mono`} type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="grid gap-1 text-xs text-slate-400">To<input className={`${inputClass} font-mono`} type="date" value={to} onChange={event => setTo(event.target.value)} /></label></div>}
      <label className="grid gap-1 text-xs text-slate-400">Display timezone<select className={inputClass} value={timezone} onChange={event => setTimezone(event.target.value)}>{chartTimezoneOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <button type="button" className={`${buttonClass} primary-button sm:col-span-2 sm:justify-self-start`} disabled={loading || !accountId} onClick={() => void (tab === 'news' ? loadNews() : loadCalendar())}>{loading ? 'Loading…' : `Load ${tab === 'news' ? 'news' : 'calendar'}`}</button>
    </div>
    {feed && <div className="mb-4 rounded-lg border border-slate-800 p-3 text-xs"><p className="font-semibold text-slate-200">Provider: {feed.provider} · {feed.status}</p><p className="mt-1 text-slate-500">{feed.limitation}</p>{!feed.configured && <p className="mt-2 text-amber-200">Unavailable until the server administrator configures the provider key. No placeholder events are shown.</p>}</div>}
    {tab === 'news' ? <div role="tabpanel" aria-label="Market News">{news?.items.length ? <div className="space-y-2">{news.items.map(item => <article key={item.id} className="rounded-lg border border-slate-800 p-3"><h2 className="text-sm font-semibold">{item.title}</h2><p className="mt-1 text-xs text-slate-500">{item.source} · {item.publishedAt} · {item.symbols}</p></article>)}</div> : <p className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">{news ? 'No provider articles matched this query.' : 'News is empty until a configured provider returns source-backed articles.'}</p>}</div> : <div role="tabpanel" aria-label="Economic Calendar">{calendar?.items.length ? <div className="space-y-2">{calendar.items.map(item => <article key={item.id} className="rounded-lg border border-slate-800 p-3"><h2 className="text-sm font-semibold">{item.event}</h2><p className="mt-1 text-xs text-slate-500">{item.country} · {item.importance} · {item.scheduledAt} {item.timezone}</p></article>)}</div> : <p className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">{calendar ? 'No provider events matched this range.' : 'Economic calendar is unavailable until a configured provider returns source-backed events.'}</p>}</div>}
  </section>
}
