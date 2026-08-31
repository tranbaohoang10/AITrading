import { useEffect, useRef, useState } from 'react'
import { buttonClass, inputClass } from '../auth/AuthForm'
import { useBacktest } from './BacktestContext'
import { activeJob } from './api'
import { ResultView } from './ResultView'
import { NotificationPanel } from '../notification/NotificationPanel'

export function BacktestWorkspace({ tradesOnly = false }: { tradesOnly?: boolean }) {
  const context = useBacktest()!, initial = useRef(context.load)
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null)
  useEffect(() => { void initial.current() }, [])
  const job = context.selected, locked = context.busy || context.uncertain
  const dataset = context.datasets.find(x => x.id === context.datasetId), revision = context.revision
  const matching = !!dataset && !!revision && dataset.symbol === revision.symbol && dataset.timeframe === revision.timeframe && dataset.gapCount === 0 && dataset.candleCount >= (revision.minimumBars ?? Infinity)
  return <section aria-label={tradesOnly ? 'Backtest Trades' : 'Backtest Results'} className="h-full overflow-y-auto p-4 text-slate-200 sm:p-5">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{tradesOnly ? 'Backtest trades' : 'Backtesting'}</h2><p className="mt-1 text-xs text-slate-500">Owned saved snapshots · Python engine · explicit execution</p></div><button className={buttonClass} disabled={locked} onClick={() => void context.load()}>Refresh jobs and inputs</button></div>
    {!tradesOnly && <NotificationPanel locked={locked} onOpenJob={id => void context.select(id)} />}
    {context.error && <p role="alert" className="mb-4 border-l-2 border-amber-400 p-3 text-sm text-amber-200">{context.error}</p>}
    {context.uncertain && <div role="status" className="mb-4 space-y-3 border border-amber-800 p-3 text-sm"><p>Request outcome is uncertain. Keep this page open; retry uses the same request ID and cannot create a duplicate job.</p><button className={buttonClass} disabled={context.busy} onClick={() => void context.retryIntent()}>Retry same job request</button></div>}
    {!tradesOnly && <details open className="mb-5 border border-slate-800 p-4"><summary className="cursor-pointer text-sm font-semibold">New backtest</summary>
      <p className="my-3 text-xs text-slate-400">Runs a saved VALIDATED revision only. Unsaved editor changes are not included. Select each input explicitly.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="text-xs text-slate-400">Saved strategy<select aria-label="Backtest strategy" className={inputClass} disabled={locked} value={context.strategyId} onChange={e => void context.chooseStrategy(e.target.value)}><option value="">Choose strategy</option>{context.strategies.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <label className="text-xs text-slate-400">Validated revision<select aria-label="Backtest revision" className={inputClass} disabled={locked || !context.strategyId} value={revision?.revision ?? ''} onChange={e => void context.chooseRevision(Number(e.target.value))}><option value="">Choose saved revision</option>{context.versions.map(v => <option key={v.revision} value={v.revision}>r{v.revision} · {v.symbol} / {v.timeframe}</option>)}</select></label>
        <label className="text-xs text-slate-400 lg:col-span-2">Owned dataset<select aria-label="Backtest dataset" className={inputClass} disabled={locked} value={context.datasetId} onChange={e => context.chooseDataset(e.target.value)}><option value="">Choose dataset</option>{context.datasets.map(d => <option key={d.id} value={d.id}>{d.name} · {d.symbol} / {d.timeframe} · {d.candleCount} bars · {d.sourceKind}</option>)}</select></label>
      </div>
      {revision && <details className="mt-3"><summary className="cursor-pointer text-xs">Inspect saved DSL, costs and sizing before running · r{revision.revision}</summary><pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-400">{revision.canonicalJson}</pre></details>}
      {dataset && <p className="mt-3 break-all text-xs text-slate-400">UTC {dataset.firstTime} → {dataset.lastTime} · gaps {dataset.gapCount} · {dataset.sourceKind}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3"><button className={buttonClass} disabled={locked || !matching || context.configured !== true} onClick={() => { setConfirm(null); void context.start() }}>Start saved backtest</button><p className="text-xs text-slate-500">{context.configured === null ? 'Load inputs to check worker availability.' : !context.configured ? 'Python worker is not configured on this server.' : !matching ? 'Choose a validated revision and matching gap-free dataset.' : 'Ready for explicit execution. No live orders.'}</p></div>
    </details>}
    <div className="mb-5 space-y-3"><label className="block text-xs text-slate-400">Saved job history<select aria-label="Backtest job" className={inputClass} disabled={locked} value={job?.id ?? ''} onChange={e => { setConfirm(null); if (e.target.value) void context.select(e.target.value) }}><option value="">Choose a job</option>{context.items.map(j => <option key={j.id} value={j.id}>{j.createdAt} · {j.strategyTitle} r{j.revision} · {j.state}</option>)}</select></label>
      {!context.items.length && <p className="text-sm text-slate-500">No saved jobs loaded. Refresh to retrieve your history, or create a new backtest.</p>}
      {context.loading && <p role="status" className="text-sm text-slate-400">Loading selected job…</p>}
      {context.busy && <p role="status" className="text-sm text-slate-400">Submitting job action…</p>}
      {job && <div className="space-y-3 border-b border-slate-800 pb-4"><p role="status" className="break-all text-sm">{job.state} · {job.strategyTitle} r{job.revision} · {job.datasetName}{job.errorCode ? ` · ${job.errorCode}` : ''}</p><p className="break-all font-mono text-xs text-slate-500">Job {job.id}</p>
        <div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={locked} onClick={() => { setConfirm(null); void context.select(job.id) }}>Refresh selected job</button>
          {activeJob(job) ? <button className={buttonClass} disabled={locked} onClick={() => setConfirm('cancel')}>Cancel job…</button> : <><button className={buttonClass} disabled={locked} onClick={() => setConfirm('delete')}>Delete job…</button>{job.state !== 'SUCCEEDED' && <button className={buttonClass} disabled={locked || !context.configured} onClick={() => { setConfirm(null); void context.retry() }}>Retry frozen snapshot</button>}</>}
        </div>
        {confirm && <div className="space-y-2 border border-amber-800 p-3 text-xs"><p>{confirm === 'delete' ? 'Delete this stored job and its result permanently?' : 'Cancel this queued/running job? Completed results will remain unchanged.'}</p><button className={buttonClass} disabled={locked} onClick={() => { const action = confirm; setConfirm(null); void (action === 'delete' ? context.remove() : context.cancel()) }}>Confirm {confirm}</button> <button className={buttonClass} onClick={() => setConfirm(null)}>Keep job</button></div>}
        {activeJob(job) && <p className="text-xs text-slate-400">Refresh to observe the actual state. No estimated progress or placeholder results.</p>}
      </div>}
    </div>
    {context.result && job && <ResultView key={job.id} tradesOnly={tradesOnly} />}
  </section>
}
