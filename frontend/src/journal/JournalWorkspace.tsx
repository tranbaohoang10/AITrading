import { useEffect, useRef, useState, type FormEvent } from 'react'
import { buttonClass, inputClass } from '../auth/AuthForm'
import { Modal } from '../components/Modal'
import { CandleChart } from '../market/CandleChart'
import { useJournal } from './JournalContext'
import { JournalCalendar, JournalDayDrawer, JournalPagedTrades } from './JournalViews'
import { periodFilter, shiftPeriod, todayInZone, type Period } from './period'
import { monthFilter } from './JournalProvider'
import { JournalEvaluationPanel } from './JournalEvaluationPanel'
import { timeframes, type Filter, type Input, type Values } from './api'
import { ReplayJournalContext } from './ReplayJournalContext'

const pnlClass = (value: string | null) => value === null || /^-?0(\.0+)?$/.test(value) ? 'text-slate-300' : value.startsWith('-') ? 'text-rose-300' : 'text-emerald-300'
function Metrics({ values, currency }: { values: Values; currency: string }) {
  return <dl aria-label="Realized journal totals" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {[['Net P&L', values.netPnl], ['Gross P&L', values.grossPnl], ['Realized fees', values.fees], ['Closed / open in range', `${values.closed} / ${values.open}`]].map(([label, value]) => <div className="metric-card" key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-1 break-all font-mono text-lg font-semibold ${label === 'Net P&L' ? pnlClass(value) : 'text-slate-100'}`}>{value}{label.includes('P&L') || label.includes('fees') ? ` ${currency}` : ''}</dd></div>)}
    <div className="col-span-2 text-xs text-slate-400 sm:col-span-4"><dt className="inline">Wins / losses / breakeven: </dt><dd className="inline">{values.wins} / {values.losses} / {values.breakeven}</dd></div>
  </dl>
}
export function JournalWorkspace() {
  const journal = useJournal(), initial = useRef(journal?.load)
  const [range, setRange] = useState<Filter>(() => journal?.filter ?? monthFilter())
  const [section, setSection] = useState<'overview' | 'trades' | 'review'>('overview')
  const [mode, setMode] = useState<Period>('month'), [anchor, setAnchor] = useState(() => todayInZone(journal?.filter.zone ?? 'UTC'))
  const [editor, setEditor] = useState(false), [closeConfirm, setCloseConfirm] = useState(false), [day, setDay] = useState<string | null>(null)
  const [source, setSource] = useState<{ id: string; replay: boolean } | null>(null)
  useEffect(() => { void initial.current?.() }, [])
  if (!journal) return null
  const { draft, selected } = journal, locked = journal.busy || journal.uncertain || journal.loading || !!journal.confirmation
  const replaySource = !!selected && source?.id === selected.id && source.replay
  const apply = (next: Filter) => { setRange(next); void journal.applyFilter(next) }
  const openEntry = (id: string) => { setSource(null); journal.select(id); setEditor(true) }
  const closeEditor = () => { if (journal.busy || journal.uncertain || journal.confirmation) return; if (journal.dirty) setCloseConfirm(true); else setEditor(false) }
  const changePeriod = (date: string, nextMode = mode) => { setAnchor(date); setMode(nextMode); apply(periodFilter(date, nextMode, range)) }
  const month = (delta: number) => {
    const reference = /^\d{4}-\d{2}-\d{2}$/.test(range.from) && Number.isFinite(Date.parse(range.from)) ? new Date(range.from) : new Date()
    apply({ ...monthFilter(new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + delta, 1))), zone: range.zone, currency: range.currency })
  }
  const field = (name: keyof Input, label: string, required = true, placeholder?: string) => <label className="grid gap-1.5 text-xs text-slate-400">{label}<input readOnly={replaySource} className={inputClass} aria-label={label} value={draft[name] ?? ''} required={required} maxLength={name === 'symbol' ? 32 : name === 'settlementCurrency' ? 12 : 32} placeholder={placeholder} onChange={event => journal.edit(name, event.target.value)} /></label>
  const moment = (name: 'entryTime' | 'exitTime', label: string) => <label className="grid gap-1.5 text-xs text-slate-400">{label}<input readOnly={replaySource} className={`${inputClass} min-w-0 font-mono`} aria-label={label} required maxLength={24} placeholder="2024-01-01T01:00:00Z" value={draft[name] ?? ''} onChange={event => journal.edit(name, event.target.value)} /><span>ISO UTC with Z, including seconds; optional 1–3 fractional second digits. No local timezone conversion.</span></label>
  const submit = (event: FormEvent) => { event.preventDefault(); void journal.save() }
  const matching = journal.datasets.filter(dataset => dataset.symbol === draft.symbol && dataset.timeframe === draft.timeframe)
  const savedContext = <aside id="journal-panel-review" role="region" aria-label="AI Review and saved journal chart context" className="min-w-0 space-y-4 border-t border-slate-800 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        <h2 className="text-sm font-semibold">Saved trade · chart context</h2>
        {!selected ? <p className="text-sm text-slate-400">Save or open an entry to inspect its linked chart.</p> : <><p className="break-all text-xs text-slate-500">Entry {selected.id} · v{selected.version}</p><dl aria-label="Saved journal P&L" className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-400">Gross P&L</dt><dd className="mt-1 break-all font-mono">{selected.grossPnl ?? 'Not realized'}</dd></div><div><dt className="text-slate-400">Net P&L · {selected.data.settlementCurrency}</dt><dd className={`mt-1 break-all font-mono ${pnlClass(selected.netPnl)}`}>{selected.netPnl ?? 'Not realized'}</dd></div></dl>
          {journal.dirty && <p className="text-xs text-amber-200">Chart and P&L show the saved version; your unsaved draft has not changed them.</p>}
          <ReplayJournalContext key={selected.id} id={selected.id} onSource={replay => setSource({ id: selected.id, replay })}/>
          {!selected.data.datasetId && !replaySource && <p className="text-sm text-slate-400">No chart linked to this saved entry.</p>}
          {journal.chartLoading && <p role="status" className="text-sm text-slate-400">Loading owned chart…</p>}
          {journal.chartError && <div className="space-y-3"><p role="alert" className="text-sm text-amber-200">Linked chart unavailable. {journal.chartError} Journal values are unchanged.</p><button className={buttonClass} onClick={() => { void journal.loadChart() }}>Retry linked chart</button></div>}
          {journal.chart && <><p className="text-xs text-slate-400">{journal.chart.dataset.name} · {journal.chart.dataset.sourceKind} · {journal.chart.dataset.timeframe} · gaps {journal.chart.dataset.gapCount}</p><CandleChart key={`${selected.id}:${journal.chart.start}`} page={journal.chart} /><div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={journal.chartLoading || journal.chart.start === 0} onClick={() => { void journal.loadChart(Math.max(0, (journal.chart?.start ?? 0) - 100)) }}>Earlier chart window</button><button className={buttonClass} disabled={journal.chartLoading || journal.chart.start + journal.chart.items.length >= journal.chart.total} onClick={() => { void journal.loadChart((journal.chart?.start ?? 0) + 100) }}>Later chart window</button></div></>}
          {journal.chartWarning && <p className="text-xs leading-5 text-slate-400">{journal.chartWarning}</p>}
          <div className="border-t border-slate-800 pt-4"><h3 className="mb-2 text-sm font-semibold">AI Review</h3><JournalEvaluationPanel entry={selected} dirty={journal.dirty} /></div>
        </>}
</aside>
  return <section className="h-full overflow-y-auto bg-slate-950 p-3 text-slate-100 sm:p-5" aria-label="Private Trading Journal">
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow">Performance log</p><h1 className="text-xl font-semibold">Journal</h1><p className="mt-1 max-w-2xl text-xs text-slate-500">A private record of realized trades, context and optional AI review. Saved entries remain the source of truth.</p></div>
      <div className="flex flex-wrap gap-2">{journal.dirty && <button onClick={() => setEditor(true)}>Resume draft</button>}<button className={`${buttonClass} primary-button`} disabled={locked} onClick={() => { journal.newEntry(); setEditor(true) }}>New journal entry</button><button className={buttonClass} disabled={locked} onClick={journal.refresh}>Refresh journal</button></div></header>
    <div role="tablist" aria-label="Journal sections" className="mb-4 flex w-full max-w-xl gap-1 overflow-x-auto border-b border-slate-800">
      {([['overview', 'Overview'], ['trades', 'Trades'], ['review', 'AI Review']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={section === id} aria-controls={`journal-panel-${id}`} onClick={() => setSection(id)} className={`min-h-9 shrink-0 border-b-2 px-3 text-xs font-semibold transition ${section === id ? 'border-slate-200 text-slate-100' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>{label}</button>)}
    </div>
    <p role="status" className="mb-4 text-xs text-slate-500">{section === 'overview' ? 'Overview shows the selected reporting range and realized totals.' : section === 'trades' ? 'Trades keeps manual entry editing and the saved chart context together.' : 'AI Review evaluates saved text only; unsaved drafts never leave this browser.'}</p>
    <div aria-label="Journal period" className="mb-4 flex flex-wrap gap-3 text-xs">
      {(['day', 'week', 'month'] as const).map(value => <button key={value} aria-pressed={mode === value} onClick={() => changePeriod(anchor, value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
      <button onClick={() => changePeriod(shiftPeriod(anchor, mode, -1))}>Previous period</button><button onClick={() => changePeriod(todayInZone(range.zone))}>Today</button><button onClick={() => changePeriod(shiftPeriod(anchor, mode, 1))}>Next period</button>
      <input aria-label="Period date" type="date" min="2000-01-01" max="2100-12-31" value={anchor} onChange={event => { if (event.target.value) changePeriod(event.target.value) }} /><span>{journal.filter.from} → {journal.filter.to} · {journal.filter.zone} · {journal.filter.currency}</span>
    </div>
    <details className="help-details mb-4"><summary>Journal safety</summary><p>Private manual records with optional AI review. No broker orders are created.</p></details>
    {!editor && journal.error && <p role="alert" className="mb-4 border border-rose-900 bg-rose-950/20 p-3 text-sm text-rose-200">{journal.error}</p>}
    {journal.notice && <p role="status" className="mb-4 text-sm text-emerald-300">{journal.notice}</p>}
    {!editor && journal.uncertain && <div role="status" className="mb-4 border border-amber-800 p-3 text-sm text-amber-200"><p>Save outcome is uncertain. Keep this draft unchanged; retry the exact same request to avoid duplicates.</p><button className={`${buttonClass} mt-3`} disabled={journal.busy} onClick={() => { void journal.retry() }}>Retry same journal save</button></div>}
    <details className="mb-4 rounded-md border border-slate-800 bg-slate-900 px-3"><summary className="cursor-pointer py-3 text-sm font-semibold">Report filters</summary><form aria-label="Journal report filters" className="space-y-3 pb-3" onSubmit={event => { event.preventDefault(); apply(range) }}>
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => month(-1)}>Previous month</button><button type="button" className={buttonClass} onClick={() => apply({ ...monthFilter(), zone: range.zone, currency: range.currency })}>Current month</button><button type="button" className={buttonClass} onClick={() => month(1)}>Next month</button></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(['from', 'to'] as const).map(key => <label key={key} className="grid min-w-0 gap-1 text-xs text-slate-400">{key === 'from' ? 'From date' : 'Through date'}<input className={`${inputClass} min-w-0 font-mono`} aria-label={key === 'from' ? 'From date' : 'Through date'} required pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" maxLength={10} placeholder="YYYY-MM-DD" value={range[key]} onChange={event => setRange({ ...range, [key]: event.target.value })} /></label>)}
        <label className="grid gap-1 text-xs text-slate-400">Settlement unit<input className={inputClass} aria-label="Report settlement unit" value={range.currency} required pattern="[A-Z0-9]{2,12}" maxLength={12} onChange={event => setRange({ ...range, currency: event.target.value })} /></label>
        <label className="grid gap-1 text-xs text-slate-400">Report timezone<input className={inputClass} aria-label="Report timezone" value={range.zone} required maxLength={64} list="journal-timezones" onChange={event => setRange({ ...range, zone: event.target.value })} /><datalist id="journal-timezones"><option value="UTC" /><option value="Asia/Ho_Chi_Minh" /><option value="America/New_York" /><option value="Europe/London" /></datalist></label>
        <button type="submit" className={`${buttonClass} self-end`} disabled={journal.reportLoading}>Apply range</button>
      </div>
      <p className="text-xs text-slate-500">Dates use YYYY-MM-DD, inclusive, within 2000–2100; maximum 366 days per report.</p>
    </form></details>
    <details className="help-details mb-3"><summary>P&amp;L calculation</summary><p>Realized P&amp;L and both fees are recognized when a CLOSED trade exits, in the selected timezone. OPEN records and their fees are excluded until close. One settlement unit at a time; no FX conversion, unrealized P&amp;L or account-equity claim.</p></details>
    {journal.reportLoading && <p role="status" className="py-3 text-sm text-slate-400">Loading journal report…</p>}
    {section === 'overview' && journal.report && <div id="journal-panel-overview" role="tabpanel" aria-label="Journal Overview" className="mb-6"><p className="mb-2 text-xs text-slate-400">Report: {journal.report.filter.from} → {journal.report.filter.to} · {journal.report.filter.zone} · {journal.report.filter.currency}</p>
      <Metrics values={journal.report.totals} currency={journal.report.filter.currency} />
      <JournalCalendar report={journal.report} mode={mode} onDay={setDay} />
      <h2>Recent trades</h2>{journal.items.slice(0, 8).map(item => <button className="block py-2 text-xs" key={item.id} aria-label={`Open journal ${item.data.symbol} ${item.id}`} onClick={() => openEntry(item.id)}>{item.data.symbol} · {item.data.side} · {item.data.state} · {item.netPnl ?? 'Not realized'}</button>)}
      <button onClick={() => setSection('trades')}>View all trades</button>
    </div>}
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        {section === 'trades' && <section id="journal-panel-trades" role="tabpanel" aria-label="Journal Trades"><h2>Trades in report range</h2><JournalPagedTrades key={JSON.stringify(journal.filter)} onSelect={openEntry} /></section>}
        {section === 'review' && <div>{journal.items.map(item => <button key={item.id} onClick={() => journal.select(item.id)}>{item.data.symbol} · {item.id}</button>)}</div>}
        <Modal open={editor} label="Journal trade" onClose={closeEditor}><div className="m-auto w-full max-w-4xl overflow-y-auto bg-slate-950 p-4 text-slate-100"><button type="button" onClick={closeEditor}>Close trade</button>{journal.error && <p role="alert">{journal.error}</p>}{journal.uncertain && <button disabled={journal.busy} onClick={() => { void journal.retry() }}>Retry same journal save</button>}
        <form aria-label="Manual journal entry" onSubmit={submit} className="space-y-4">
          <h2 className="text-sm font-semibold">{selected ? `${replaySource ? 'Review Replay trade' : 'Edit manual entry'} · v${selected.version}` : 'New manual entry'}{journal.dirty ? ' · Unsaved' : ''}</h2>
          {journal.loading && <p role="status">Loading journal entry…</p>}
          {locked && <p role="status">Timeframe and fields are locked: {journal.uncertain ? 'resolve the uncertain save using Retry same journal save' : journal.busy ? 'saving trade' : journal.loading ? 'loading saved trade' : 'answer the pending confirmation'}.</p>}
          <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
            <div className="grid grid-cols-2 gap-3">{field('symbol', 'Symbol', true, 'TEST_USD')}
              <label className="grid gap-1.5 text-xs text-slate-400">Timeframe<select className={inputClass} aria-label="Journal timeframe" disabled={replaySource} value={draft.timeframe} onChange={event => journal.edit('timeframe', event.target.value)}>{timeframes.map(tf => <option key={tf} value={tf}>{tf === '1d' ? '1D' : tf}</option>)}</select></label>
              {field('settlementCurrency', 'Trade settlement unit', true, 'USD')}
              <label className="grid gap-1.5 text-xs text-slate-400">Direction<select className={inputClass} aria-label="Trade direction" disabled={replaySource} value={draft.side} onChange={event => journal.edit('side', event.target.value)}><option>LONG</option><option>SHORT</option></select></label>
              <label className="grid gap-1.5 text-xs text-slate-400">State<select className={inputClass} aria-label="Trade state" disabled={replaySource} value={draft.state} onChange={event => journal.edit('state', event.target.value)}><option>OPEN</option><option>CLOSED</option></select></label>
              {field('quantity', 'Quantity', true, 'Actual exposure')}{field('entryPrice', 'Entry price')}{field('entryFee', 'Entry fee')}
            </div>
            {moment('entryTime', 'Entry time · UTC')}
            {draft.state === 'CLOSED' && <><div className="grid grid-cols-2 gap-3">{field('exitPrice', 'Exit price')}{field('exitFee', 'Exit fee')}</div>{moment('exitTime', 'Exit time · UTC')}</>}
            <p className="text-xs leading-5 text-slate-500">Linear trades: gross=(exit−entry) × quantity × direction; net=gross−fees. Amounts use up to 8 decimal places, maximum 1e12. No leverage multiplier or inverse-contract calculation.</p>
            <label className="grid gap-1.5 text-xs text-slate-400">Entry reason<textarea className={`${inputClass} min-h-24 resize-y`} aria-label="Entry reason" required maxLength={2000} value={draft.entryReason} onChange={event => journal.edit('entryReason', event.target.value)} /><span>Required · up to 2000 UTF-8 bytes. Quality is not scored in this feature.</span></label>
            <label className="grid gap-1.5 text-xs text-slate-400">Notes<textarea className={`${inputClass} min-h-20 resize-y`} aria-label="Journal notes" maxLength={4000} value={draft.notes} onChange={event => journal.edit('notes', event.target.value)} /><span>Optional · up to 4000 UTF-8 bytes.</span></label>
            <label className="grid gap-1.5 text-xs text-slate-400">Linked owned chart<select className={inputClass} aria-label="Linked owned chart" disabled={replaySource} value={draft.datasetId ?? ''} onChange={event => journal.edit('datasetId', event.target.value)}><option value="">No chart link</option>{draft.datasetId && !matching.some(dataset => dataset.id === draft.datasetId) && <option value={draft.datasetId}>Unavailable or no longer matching — unlink to save</option>}{matching.map(dataset => <option key={dataset.id} value={dataset.id}>{dataset.name} · {dataset.sourceKind}</option>)}</select></label>
            <div className="flex flex-wrap gap-2"><button type="submit" className={buttonClass} disabled={!journal.dirty}>Save journal entry</button>{selected && <button type="button" className={buttonClass} onClick={journal.remove}>Delete journal entry</button>}</div>
          </fieldset>
          {journal.busy && <p role="status" className="text-sm">Saving journal change…</p>}
        </form>{savedContext}</div></Modal>
      </div>
      {section === 'review' && <div role="tabpanel" aria-label="AI Review and saved journal chart context">{savedContext}</div>}
    </div>
    {day && <JournalDayDrawer key={`${day}:${journal.filter.zone}:${journal.filter.currency}`} date={day} onClose={() => setDay(null)} onSelect={openEntry} />}
    <Modal open={closeConfirm} label="Close unsaved trade" onClose={() => setCloseConfirm(false)}><div className="m-auto bg-slate-950 p-5 text-slate-100"><p>Close editor and keep your unsaved draft?</p><button onClick={() => setCloseConfirm(false)}>Continue editing</button><button onClick={() => { setCloseConfirm(false); setEditor(false) }}>Keep draft and close</button></div></Modal>
    <Modal open={!!journal.confirmation} label="Confirm journal action" onClose={journal.cancel}><div className="m-auto max-w-md border border-slate-700 bg-slate-950 p-6 text-slate-100"><h2 className="text-lg font-semibold">Confirm journal action</h2><p className="my-4 text-sm">{journal.confirmation}</p><div className="flex gap-3"><button className={buttonClass} onClick={journal.cancel}>Keep journal draft</button><button className={buttonClass} onClick={journal.confirm}>Confirm journal action</button></div></div></Modal>
  </section>
}
