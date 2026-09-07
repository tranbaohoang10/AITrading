import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Modal } from '../components/Modal'
import * as api from './api'
import { useJournal } from './JournalContext'
import { sumDecimals, type Period } from './period'
import { DailyNote } from './ReplayJournalContext'

export const signed = (value: string) => /^-?0(\.0+)?$/.test(value) || value.startsWith('-') ? value : `+${value}`
export function JournalCalendar({ report, mode, onDay }: { report: api.Summary; mode: Period; onDay: (date: string) => void }) {
  const days = report.days.slice(0, mode === 'month' ? 31 : mode === 'week' ? 7 : 1)
  const offset = mode === 'month' ? (new Date(`${days[0]?.date}T00:00:00Z`).getUTCDay() + 6) % 7 : 0
  const cells = [...Array.from({ length: offset }, () => null), ...days]
  while (mode !== 'day' && cells.length % 7) cells.push(null)
  while (mode === 'month' && cells.length < 35) cells.push(null)
  return <div aria-label="Daily realized P&L" className="mt-3">
    {mode !== 'day' && <div className="grid grid-cols-7 text-center text-xs text-slate-400">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div>}
    {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => <div key={row}>
      <div className={`grid ${mode === 'day' ? 'grid-cols-1' : 'grid-cols-7'} gap-px bg-slate-800`}>{cells.slice(row * 7, row * 7 + 7).map((day, index) => day ? <button key={day.date} aria-label={`Open day ${day.date}`} data-trading-activity={day.values.closed > 0 ? Number(day.values.netPnl) === 0 ? 'breakeven' : 'closed' : 'none'} style={day.values.closed > 0 ? { boxShadow: Number(day.values.netPnl) === 0 ? 'inset 0 0 0 1px #705392, inset 0 0 8px #8055aa18' : 'inset 0 0 0 1px #a78bda, inset 0 0 12px #9466d52a' } : undefined} onClick={() => onDay(day.date)} className="min-w-0 bg-slate-950 px-1 py-3 text-left focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white">
        <time className="text-xs text-slate-400">{Number(day.date.slice(-2))}</time><p className={`break-all text-[10px] ${Number(day.values.netPnl) > 0 ? 'text-emerald-300' : Number(day.values.netPnl) < 0 ? 'text-rose-300' : 'text-slate-400'}`}>{signed(day.values.netPnl)}</p><p className="text-[9px] text-slate-500">{day.values.closed} closed · {day.values.open} open</p>
      </button> : <div key={`blank-${index}`} className="bg-slate-950" />)}</div>
      {mode !== 'day' && <p className="py-1 text-right text-xs text-slate-400">Weekly P&L: {signed(sumDecimals(cells.slice(row * 7, row * 7 + 7).flatMap(day => day ? [day.values.netPnl] : [])))} {report.filter.currency}</p>}
    </div>)}
  </div>
}
export function JournalPagedTrades({ onSelect }: { onSelect: (id: string) => void }) {
  const journal = useJournal()!, auth = useAuth(), [page, setPage] = useState(1), [size, setSize] = useState(20)
  const [result, setResult] = useState<api.NumberedPage | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const [filters, setFilters] = useState({ symbol: '', side: '', state: '', source: '', replaySession: '' })
  const { from, to, zone, currency } = journal.filter
  useEffect(() => {
    let active = true
    api.numberedPage({ from, to, zone, currency }, page, size, auth?.user.id, filters).then(value => { if (active) { setResult(value); setPage(value.page); setError('') } }).catch(() => { if (active) setError('Cannot load trade page. Retry.') })
    return () => { active = false }
  }, [from, to, zone, currency, page, size, auth?.user.id, journal.report, retry, filters])
  return <div>
    <div className="mb-3 flex flex-wrap gap-2 text-xs">{(['symbol', 'replaySession'] as const).map(key => <label key={key}>{key === 'symbol' ? 'Symbol' : 'Replay session'}<input className="ml-1 max-w-44 rounded border border-slate-700 bg-slate-950 p-1" aria-label={`Filter ${key}`} value={filters[key]} onChange={event => { setFilters(value => ({ ...value, [key]: event.target.value })); setResult(null); setPage(1) }}/></label>)}{([['side', ['LONG', 'SHORT']], ['state', ['OPEN', 'CLOSED']], ['source', ['MANUAL', 'REPLAY']]] as const).map(([key, values]) => <label key={key}>{key}<select className="ml-1 rounded border border-slate-700 bg-slate-950 p-1" aria-label={`Filter ${key}`} value={filters[key]} onChange={event => { setFilters(value => ({ ...value, [key]: event.target.value })); setResult(null); setPage(1) }}><option value="">All</option>{values.map(value => <option key={value}>{value}</option>)}</select></label>)}</div>
    <label>Page size <select aria-label="Page size" value={size} onChange={event => { setResult(null); setSize(Number(event.target.value)); setPage(1) }}>{[10, 20, 50].map(value => <option key={value}>{value}</option>)}</select></label>
    {error ? <p role="alert">{error}<button onClick={() => setRetry(value => value + 1)}>Retry trade page</button></p> : !result ? <p role="status">Loading trades…</p> : <>
      {result.items.map(item => <button key={item.id} className="flex w-full flex-wrap justify-between gap-2 border-b border-slate-800 py-3 text-left text-xs" aria-label={`Open journal ${item.data.symbol} ${item.id}`} onClick={() => onSelect(item.id)}><span>{item.data.exitTime ?? item.data.entryTime} · {item.data.symbol}</span><span>{item.data.side} · {item.data.timeframe} · {item.data.state}</span><span>Entry {item.data.entryPrice} · Exit {item.data.exitPrice ?? '—'} · {item.netPnl === null ? 'Not realized' : signed(item.netPnl)} {currency}</span></button>)}
      <p>Showing {result.totalItems ? (result.page - 1) * size + 1 : 0}–{Math.min(result.page * size, result.totalItems)} of {result.totalItems}</p>
      <nav aria-label="Trade pages" className="flex flex-wrap gap-2"><button disabled={result.page <= 1} onClick={() => { setResult(null); setPage(page - 1) }}>Previous</button>{Array.from({ length: result.totalPages }, (_, index) => index + 1).filter(value => value === 1 || value === result.totalPages || Math.abs(value - result.page) <= 2).map((value, index, values) => <span key={value}>{index > 0 && value - values[index - 1] > 1 && '… '}<button aria-current={value === result.page ? 'page' : undefined} onClick={() => { setResult(null); setPage(value) }}>{value}</button></span>)}<button disabled={result.page >= result.totalPages} onClick={() => { setResult(null); setPage(page + 1) }}>Next</button></nav>
    </>}
  </div>
}
export function JournalDayDrawer({ date, onClose, onSelect }: { date: string | null; onClose: () => void; onSelect: (id: string) => void }) {
  const journal = useJournal()!, auth = useAuth(), [rows, setRows] = useState<api.Entry[] | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  const { zone, currency } = journal.filter
  useEffect(() => {
    let active = true
    if (!date) return
    const run = async () => {
      const found = new Map<string, api.Entry>(), cursors = new Set<string>(); let cursor: string | undefined
      try {
        for (let page = 0; page < 25; page++) {
          const result = await api.list({ from: date, to: date, zone, currency }, cursor, auth?.user.id)
          if (!active) return
          result.items.forEach(item => found.set(item.id, item))
          if (found.size > 500) throw new Error('Account bound')
          if (!result.nextCursor) { setRows([...found.values()].sort((a, b) => Date.parse(a.data.entryTime) - Date.parse(b.data.entryTime) || a.id.localeCompare(b.id))); return }
          if (cursors.has(result.nextCursor)) throw new Error('Repeated cursor')
          cursors.add(result.nextCursor); cursor = result.nextCursor
        }
        throw new Error('Page bound')
      } catch { if (active) setError('Cannot load the complete day. Retry.') }
    }
    void run(); return () => { active = false }
  }, [date, zone, currency, auth?.user.id, attempt])
  return <Modal open={!!date} label="Journal day" onClose={onClose}><div className="m-auto w-full max-w-3xl overflow-y-auto bg-slate-950 p-4 text-slate-100"><button onClick={onClose}>Close day</button><h2>{date} · {zone} · {currency}</h2>{date && <DailyNote key={`${date}:${zone}:${currency}`} date={date} zone={zone} currency={currency}/>}{error ? <p role="alert">{error}<button onClick={() => { setError(''); setRows(null); setAttempt(value => value + 1) }}>Retry day</button></p> : rows === null ? <p role="status">Loading complete day…</p> : <><p>Net P&L {signed(sumDecimals(rows.flatMap(row => row.netPnl === null ? [] : [row.netPnl])))} {currency} · {rows.length} trades</p>{rows.length === 0 && <p>No trades this day.</p>}{rows.map(row => <button className="block w-full border-b border-slate-800 py-3 text-left" key={row.id} onClick={() => onSelect(row.id)}>{row.data.symbol} · {row.data.side} · {row.data.state} · {row.netPnl ?? 'Not realized'}</button>)}</>}</div></Modal>
}
