import { useEffect, useRef, useState, type FormEvent } from 'react'
import { buttonClass, inputClass } from '../auth/AuthForm'
import { Modal } from '../components/Modal'
import { CandleChart } from '../market/CandleChart'
import { useJournal } from './JournalContext'
import { monthFilter } from './JournalProvider'
import { timeframes, type Filter, type Input, type Values } from './api'

const pnlClass = (value: string | null) => value === null || /^-?0(\.0+)?$/.test(value) ? 'text-slate-300' : value.startsWith('-') ? 'text-rose-300' : 'text-emerald-300'
function Metrics({ values, currency }: { values: Values; currency: string }) {
  return <dl aria-label="Realized journal totals" className="grid grid-cols-2 gap-4 border-y border-slate-800 py-4 sm:grid-cols-4">
    {[['Net P&L', values.netPnl], ['Gross P&L', values.grossPnl], ['Realized fees', values.fees], ['Closed / open in range', `${values.closed} / ${values.open}`]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className={`mt-1 break-all font-mono text-base ${label === 'Net P&L' ? pnlClass(value) : 'text-slate-100'}`}>{value}{label.includes('P&L') || label.includes('fees') ? ` ${currency}` : ''}</dd></div>)}
    <div className="col-span-2 text-xs text-slate-400 sm:col-span-4"><dt className="inline">Wins / losses / breakeven: </dt><dd className="inline">{values.wins} / {values.losses} / {values.breakeven}</dd></div>
  </dl>
}
export function JournalWorkspace() {
  const journal = useJournal(), initial = useRef(journal?.load)
  const [range, setRange] = useState<Filter>(() => journal?.filter ?? monthFilter())
  useEffect(() => { void initial.current?.() }, [])
  if (!journal) return null
  const { draft, selected } = journal, locked = journal.busy || journal.uncertain || journal.loading || !!journal.confirmation
  const apply = (next: Filter) => { setRange(next); void journal.applyFilter(next) }
  const month = (delta: number) => {
    const reference = /^\d{4}-\d{2}-\d{2}$/.test(range.from) && Number.isFinite(Date.parse(range.from)) ? new Date(range.from) : new Date()
    apply({ ...monthFilter(new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + delta, 1))), zone: range.zone, currency: range.currency })
  }
  const field = (name: keyof Input, label: string, required = true, placeholder?: string) => <label className="grid gap-1.5 text-xs text-slate-400">{label}<input className={inputClass} aria-label={label} value={draft[name] ?? ''} required={required} maxLength={name === 'symbol' ? 32 : name === 'settlementCurrency' ? 12 : 32} placeholder={placeholder} onChange={event => journal.edit(name, event.target.value)} /></label>
  const moment = (name: 'entryTime' | 'exitTime', label: string) => <label className="grid gap-1.5 text-xs text-slate-400">{label}<input className={`${inputClass} min-w-0 font-mono`} aria-label={label} required maxLength={24} placeholder="2024-01-01T01:00:00Z" value={draft[name] ?? ''} onChange={event => journal.edit(name, event.target.value)} /><span>ISO UTC with Z, including seconds; optional 1–3 fractional second digits. No local timezone conversion.</span></label>
  const submit = (event: FormEvent) => { event.preventDefault(); void journal.save() }
  const matching = journal.datasets.filter(dataset => dataset.symbol === draft.symbol && dataset.timeframe === draft.timeframe)
  return <section className="h-full overflow-y-auto bg-slate-950 p-4 text-slate-100 sm:p-6" aria-label="Private Trading Journal">
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-xl font-semibold">Trading Journal</h1><p className="mt-1 text-xs text-slate-400">Private manual trade records · no broker orders or AI scoring</p></div>
      <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={locked} onClick={journal.newEntry}>New journal entry</button><button className={buttonClass} disabled={locked} onClick={journal.refresh}>Refresh journal</button></div></header>
    {journal.error && <p role="alert" className="mb-4 border border-rose-900 bg-rose-950/20 p-3 text-sm text-rose-200">{journal.error}</p>}
    {journal.notice && <p role="status" className="mb-4 text-sm text-emerald-300">{journal.notice}</p>}
    {journal.uncertain && <div role="status" className="mb-4 border border-amber-800 p-3 text-sm text-amber-200"><p>Save outcome is uncertain. Keep this draft unchanged; retry the exact same request to avoid duplicates.</p><button className={`${buttonClass} mt-3`} disabled={journal.busy} onClick={() => { void journal.retry() }}>Retry same journal save</button></div>}
    <form aria-label="Journal report filters" className="mb-4 space-y-3" onSubmit={event => { event.preventDefault(); apply(range) }}>
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => month(-1)}>Previous month</button><button type="button" className={buttonClass} onClick={() => apply({ ...monthFilter(), zone: range.zone, currency: range.currency })}>Current month</button><button type="button" className={buttonClass} onClick={() => month(1)}>Next month</button></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {(['from', 'to'] as const).map(key => <label key={key} className="grid min-w-0 gap-1 text-xs text-slate-400">{key === 'from' ? 'From date' : 'Through date'}<input className={`${inputClass} min-w-0 font-mono`} aria-label={key === 'from' ? 'From date' : 'Through date'} required pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" maxLength={10} placeholder="YYYY-MM-DD" value={range[key]} onChange={event => setRange({ ...range, [key]: event.target.value })} /></label>)}
        <label className="grid gap-1 text-xs text-slate-400">Settlement unit<input className={inputClass} aria-label="Report settlement unit" value={range.currency} required pattern="[A-Z0-9]{2,12}" maxLength={12} onChange={event => setRange({ ...range, currency: event.target.value })} /></label>
        <label className="grid gap-1 text-xs text-slate-400">Report timezone<input className={inputClass} aria-label="Report timezone" value={range.zone} required maxLength={64} list="journal-timezones" onChange={event => setRange({ ...range, zone: event.target.value })} /><datalist id="journal-timezones"><option value="UTC" /><option value="Asia/Ho_Chi_Minh" /><option value="America/New_York" /><option value="Europe/London" /></datalist></label>
        <button type="submit" className={`${buttonClass} self-end`} disabled={journal.reportLoading}>Apply range</button>
      </div>
      <p className="text-xs text-slate-500">Dates use YYYY-MM-DD, inclusive, within 2000–2100; maximum 366 days per report.</p>
    </form>
    <p className="mb-3 text-xs leading-5 text-slate-400">Realized P&L and both fees are recognized when a CLOSED trade exits, in the selected timezone. OPEN records and their fees are excluded until close. One settlement unit at a time; no FX conversion, unrealized P&L or account-equity claim.</p>
    {journal.reportLoading && <p role="status" className="py-3 text-sm text-slate-400">Loading journal report…</p>}
    {journal.report && <div className="mb-6"><p className="mb-2 text-xs text-slate-400">Report: {journal.report.filter.from} → {journal.report.filter.to} · {journal.report.filter.zone} · {journal.report.filter.currency}</p>
      <Metrics values={journal.report.totals} currency={journal.report.filter.currency} />
      <details className="mt-4" open><summary className="cursor-pointer text-sm font-medium">Daily P&L calendar</summary>
        <div aria-label="Daily realized P&L" className="mt-3 grid grid-cols-2 gap-px border border-slate-800 bg-slate-950 sm:grid-cols-4 xl:grid-cols-7">
          {journal.report.days.map(day => <div key={day.date} className="min-w-0 bg-slate-950 p-2.5"><time className="block text-xs text-slate-400" dateTime={day.date}>{day.date}</time><p className={`mt-2 break-all font-mono text-xs ${pnlClass(day.values.netPnl)}`}>{day.values.netPnl} {journal.report?.filter.currency}</p><p className="mt-1 text-[10px] text-slate-500">{day.values.closed ? `${day.values.closed} closed` : 'No closed trades'}{day.values.open ? ` · ${day.values.open} open` : ''}</p></div>)}
        </div>
      </details>
    </div>}
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        <section aria-label="Journal entries in report"><h2 className="mb-2 text-sm font-semibold">Entries in report range</h2><p className="mb-3 text-xs text-slate-500">Closed: exit date · Open: entry date. Refresh after concurrent edits to update this paged view.</p>
          {!journal.items.length && !journal.reportLoading && journal.report && <p className="border border-slate-800 p-4 text-sm text-slate-400">No journal entries in this range and settlement unit.</p>}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-800 border-y border-slate-800">{journal.items.map(item => <button key={item.id} type="button" disabled={locked} aria-label={`Open journal ${item.data.symbol} ${item.id}`} aria-pressed={item.id === selected?.id} className={`flex w-full items-center justify-between gap-3 px-2 py-3 text-left text-xs disabled:opacity-50 ${item.id === selected?.id ? 'bg-slate-800' : 'hover:bg-slate-900'}`} onClick={() => journal.select(item.id)}>
            <span className="min-w-0"><span className="block font-medium">{item.data.symbol} · {item.data.side} · {item.data.state}</span><span className="mt-1 block break-all text-slate-500">{item.data.exitTime ?? item.data.entryTime} · v{item.version}</span></span><span className={`shrink-0 font-mono ${pnlClass(item.netPnl)}`}>{item.netPnl ?? 'Not realized'} {item.netPnl === null ? '' : item.data.settlementCurrency}</span>
          </button>)}</div>
          {journal.nextCursor && <button className={`${buttonClass} mt-3`} disabled={journal.reportLoading} onClick={() => { void journal.more() }}>More journal entries</button>}
        </section>
        <form aria-label="Manual journal entry" onSubmit={submit} className="space-y-4">
          <h2 className="text-sm font-semibold">{selected ? `Edit manual entry · v${selected.version}` : 'New manual entry'}{journal.dirty ? ' · Unsaved' : ''}</h2>
          {journal.loading && <p role="status">Loading journal entry…</p>}
          <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
            <div className="grid grid-cols-2 gap-3">{field('symbol', 'Symbol', true, 'TEST_USD')}
              <label className="grid gap-1.5 text-xs text-slate-400">Timeframe<select className={inputClass} aria-label="Journal timeframe" value={draft.timeframe} onChange={event => journal.edit('timeframe', event.target.value)}>{timeframes.map(tf => <option key={tf}>{tf}</option>)}</select></label>
              {field('settlementCurrency', 'Trade settlement unit', true, 'USD')}
              <label className="grid gap-1.5 text-xs text-slate-400">Direction<select className={inputClass} aria-label="Trade direction" value={draft.side} onChange={event => journal.edit('side', event.target.value)}><option>LONG</option><option>SHORT</option></select></label>
              <label className="grid gap-1.5 text-xs text-slate-400">State<select className={inputClass} aria-label="Trade state" value={draft.state} onChange={event => journal.edit('state', event.target.value)}><option>OPEN</option><option>CLOSED</option></select></label>
              {field('quantity', 'Quantity', true, 'Actual exposure')}{field('entryPrice', 'Entry price')}{field('entryFee', 'Entry fee')}
            </div>
            {moment('entryTime', 'Entry time · UTC')}
            {draft.state === 'CLOSED' && <><div className="grid grid-cols-2 gap-3">{field('exitPrice', 'Exit price')}{field('exitFee', 'Exit fee')}</div>{moment('exitTime', 'Exit time · UTC')}</>}
            <p className="text-xs leading-5 text-slate-500">Linear trades: gross=(exit−entry) × quantity × direction; net=gross−fees. Amounts use up to 8 decimal places, maximum 1e12. No leverage multiplier or inverse-contract calculation.</p>
            <label className="grid gap-1.5 text-xs text-slate-400">Entry reason<textarea className={`${inputClass} min-h-24 resize-y`} aria-label="Entry reason" required maxLength={2000} value={draft.entryReason} onChange={event => journal.edit('entryReason', event.target.value)} /><span>Required · up to 2000 UTF-8 bytes. Quality is not scored in this feature.</span></label>
            <label className="grid gap-1.5 text-xs text-slate-400">Notes<textarea className={`${inputClass} min-h-20 resize-y`} aria-label="Journal notes" maxLength={4000} value={draft.notes} onChange={event => journal.edit('notes', event.target.value)} /><span>Optional · up to 4000 UTF-8 bytes.</span></label>
            <label className="grid gap-1.5 text-xs text-slate-400">Linked owned chart<select className={inputClass} aria-label="Linked owned chart" value={draft.datasetId ?? ''} onChange={event => journal.edit('datasetId', event.target.value)}><option value="">No chart link</option>{draft.datasetId && !matching.some(dataset => dataset.id === draft.datasetId) && <option value={draft.datasetId}>Unavailable or no longer matching — unlink to save</option>}{matching.map(dataset => <option key={dataset.id} value={dataset.id}>{dataset.name} · {dataset.sourceKind}</option>)}</select></label>
            <div className="flex flex-wrap gap-2"><button type="submit" className={buttonClass} disabled={!journal.dirty}>Save journal entry</button>{selected && <button type="button" className={buttonClass} onClick={journal.remove}>Delete journal entry</button>}</div>
          </fieldset>
          {journal.busy && <p role="status" className="text-sm">Saving journal change…</p>}
        </form>
      </div>
      <aside aria-label="Saved journal chart context" className="min-w-0 space-y-4 border-t border-slate-800 pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
        <h2 className="text-sm font-semibold">Saved trade · chart context</h2>
        {!selected ? <p className="text-sm text-slate-400">Save or open an entry to inspect its linked chart.</p> : <><p className="break-all text-xs text-slate-500">Entry {selected.id} · v{selected.version}</p><dl aria-label="Saved journal P&L" className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-400">Gross P&L</dt><dd className="mt-1 break-all font-mono">{selected.grossPnl ?? 'Not realized'}</dd></div><div><dt className="text-slate-400">Net P&L · {selected.data.settlementCurrency}</dt><dd className={`mt-1 break-all font-mono ${pnlClass(selected.netPnl)}`}>{selected.netPnl ?? 'Not realized'}</dd></div></dl>
          {journal.dirty && <p className="text-xs text-amber-200">Chart and P&L show the saved version; your unsaved draft has not changed them.</p>}
          {!selected.data.datasetId && <p className="text-sm text-slate-400">No chart linked to this saved entry.</p>}
          {journal.chartLoading && <p role="status" className="text-sm text-slate-400">Loading owned chart…</p>}
          {journal.chartError && <div className="space-y-3"><p role="alert" className="text-sm text-amber-200">Linked chart unavailable. {journal.chartError} Journal values are unchanged.</p><button className={buttonClass} onClick={() => { void journal.loadChart() }}>Retry linked chart</button></div>}
          {journal.chart && <><p className="text-xs text-slate-400">{journal.chart.dataset.name} · {journal.chart.dataset.sourceKind} · {journal.chart.dataset.timeframe} · gaps {journal.chart.dataset.gapCount}</p><CandleChart key={`${selected.id}:${journal.chart.start}`} page={journal.chart} /><div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={journal.chartLoading || journal.chart.start === 0} onClick={() => { void journal.loadChart(Math.max(0, (journal.chart?.start ?? 0) - 100)) }}>Earlier chart window</button><button className={buttonClass} disabled={journal.chartLoading || journal.chart.start + journal.chart.items.length >= journal.chart.total} onClick={() => { void journal.loadChart((journal.chart?.start ?? 0) + 100) }}>Later chart window</button></div></>}
          {journal.chartWarning && <p className="text-xs leading-5 text-slate-400">{journal.chartWarning}</p>}
        </>}
      </aside>
    </div>
    <Modal open={!!journal.confirmation} label="Confirm journal action" onClose={journal.cancel}><div className="m-auto max-w-md border border-slate-700 bg-slate-950 p-6 text-slate-100"><h2 className="text-lg font-semibold">Confirm journal action</h2><p className="my-4 text-sm">{journal.confirmation}</p><div className="flex gap-3"><button className={buttonClass} onClick={journal.cancel}>Keep journal draft</button><button className={buttonClass} onClick={journal.confirm}>Confirm journal action</button></div></div></Modal>
  </section>
}
