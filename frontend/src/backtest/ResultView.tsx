import { useState } from 'react'
import { buttonClass } from '../auth/AuthForm'
import { CandleChart } from '../market/CandleChart'
import type { Bar, Detail, Result } from './api'
import { useBacktest } from './BacktestContext'

export function Values({ values, label }: { values: Detail; label: string }) {
  const metrics = label === 'Actual backtest metrics'
  return <dl aria-label={label} className={`grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 ${metrics ? 'xl:grid-cols-5' : 'xl:grid-cols-3'}`}>{Object.entries(values).map(([key, value]) => <div key={key} className={`min-w-0 ${metrics ? 'metric-card' : ''}`}><dt className="capitalize text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</dt><dd className={`mt-1 break-all font-mono ${metrics ? 'text-lg font-semibold text-slate-100' : 'text-slate-200'}`}>{value === null ? 'Undefined' : String(value)}</dd></div>)}</dl>
}
export function EquityChart({ bars }: { bars: Bar[] }) {
  const [index, setIndex] = useState(0), active = bars[Math.min(index, bars.length - 1)]
  function curve(field: 'equity' | 'drawdownPct', title: string, color: string) {
    const raw = bars.map(b => Number(b[field])), scale = Math.max(...raw.map(Math.abs), 1)
    const numbers = raw.map(n => n / scale), low = Math.min(...numbers), high = Math.max(...numbers), spread = high - low || .01
    const points = numbers.map((n, i) => `${20 + i / Math.max(1, numbers.length - 1) * 860},${130 - (n - low) / spread * 100}`).join(' ')
    return <div><h4 className="mb-2 text-xs font-semibold text-slate-400">{title} · bar close</h4><svg viewBox="0 0 900 155" className="terminal-gridline h-36 w-full rounded-md border border-slate-800 bg-slate-950" role="img" aria-label={title}>
      <line x1="20" x2="880" y1="130" y2="130" stroke="#334155" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {bars.length === 1 && <circle cx="20" cy="130" r="3" fill={color} />}
      <line x1={20 + index / Math.max(1, bars.length - 1) * 860} x2={20 + index / Math.max(1, bars.length - 1) * 860} y1="20" y2="130" stroke="#94a3b8" />
      <text x="20" y="149" fontSize="11" fill="#94a3b8">{bars[0].openTime.slice(0, 10)}</text><text x="880" y="149" textAnchor="end" fontSize="11" fill="#94a3b8">{bars.at(-1)!.closeTime.slice(0, 10)}</text>
    </svg></div>
  }
  return <section aria-label="Equity and drawdown" className="metric-card space-y-4">{curve('equity', 'Equity', '#34d399')}{curve('drawdownPct', 'Drawdown %', '#fb7185')}
    <label className="flex flex-wrap gap-3 text-xs text-slate-400">Inspect result bar · UTC<input aria-label="Result bar index" aria-valuetext={active.closeTime} type="range" min={0} max={bars.length - 1} value={index} onChange={e => setIndex(Number(e.target.value))} onKeyDown={event => {
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? bars.length - 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? index - 1 : ['ArrowRight', 'ArrowUp'].includes(event.key) ? index + 1 : null
      if (next === null) return
      event.preventDefault(); setIndex(Math.max(0, Math.min(bars.length - 1, next)))
    }} className="min-w-28 flex-1" /></label>
    <Values label="Exact selected result bar" values={{ bar: active.index, closeTime: active.closeTime, balance: active.balance, equity: active.equity, drawdownPct: active.drawdownPct, unrealizedGross: active.unrealizedGross }} />
    <details className="help-details"><summary>Chart details</summary><p>Geometry uses display precision; inspected values retain exact engine decimal strings. Drawdown can exceed 100% under leverage.</p></details>
  </section>
}
export function TradeList({ result }: { result: Result }) {
  const [start, setStart] = useState(0), from = Math.min(start, Math.max(0, result.trades.length - 1))
  return <section aria-label="Actual backtest trades" className="space-y-4">
    <h3 className="text-base font-semibold">Closed trades · {result.trades.length}</h3>
    {!result.trades.length && <p className="text-sm text-slate-400">No closed trades in this run. Ratios without observations are undefined.</p>}
    {result.trades.slice(from, from + 20).map((trade, i) => <details key={from + i} className="rounded-md border border-slate-800 bg-slate-900/30 p-3">
      <summary className="cursor-pointer text-sm">Trade {from + i + 1} · {trade.side} · Net {trade.netPnl} · {trade.exitReason}</summary>
      <div className="mt-4"><Values label={`Trade ${from + i + 1} details`} values={trade} /></div>
      {trade.exitTimePrecision === 'BAR_INTERVAL' && <p className="mt-3 text-xs text-amber-200">Exact exit time unknown. Execution interval: {result.bars[Number(trade.exitBar)].openTime} → {result.bars[Number(trade.exitBar)].closeTime}.</p>}
    </details>)}
    {result.trades.length > 20 && <div className="flex gap-2"><button className={buttonClass} disabled={from === 0} onClick={() => setStart(Math.max(0, from - 20))}>Previous trades</button><button className={buttonClass} disabled={from + 20 >= result.trades.length} onClick={() => setStart(from + 20)}>Next trades</button></div>}
    <h3 className="text-base font-semibold">Open position at dataset end</h3>
    {result.openPosition ? <><Values label="Open position" values={result.openPosition} /><p className="text-xs text-amber-200">Marked at the last candle close; this is not a closed trade. No automatic liquidation.</p></> : <p className="text-sm text-slate-400">No open position.</p>}
  </section>
}
export function ResultView({ tradesOnly = false }: { tradesOnly?: boolean }) {
  const context = useBacktest()!, { selected: job, result, page } = context
  const [exportError, setExportError] = useState('')
  if (!job || !result) return null
  function download() {
    if (!job || !result) return
    setExportError('')
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify({ job, result: result.raw }, null, 2)], { type: 'application/json' }))
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'backtest-result.json'; anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setExportError('Export failed. No file was saved; try again.') }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-semibold">Stored result · {job.symbol} / {job.timeframe}</h3><button className={buttonClass} onClick={download}>Export result JSON</button></div>
    {exportError && <p role="alert">{exportError}</p>}
    <div className="flex flex-wrap gap-2"><span className="status-chip status-chip--success">Completed</span><span className="status-chip">{job.sourceKind}</span></div>
    {!tradesOnly && <><Values label="Actual backtest metrics" values={result.metrics} /><EquityChart key={job.id} bars={result.bars} /></>}
    <TradeList key={job.id} result={result} />
    {!tradesOnly && <section aria-label="Frozen run chart" className="space-y-4 border-t border-slate-800 pt-5">
      <h3 className="font-semibold">Frozen run candles and events</h3>
      <p className="text-xs text-slate-400">Yellow: SIGNAL at close · green: ENTRY · red: EXIT. Markers locate event bars; exact prices/times are below. This chart is independent of the current market selection.</p>
      {context.chartLoading && <p role="status">Loading frozen candles…</p>}
      {context.chartError && <p role="alert">{context.chartError} <button className={buttonClass} onClick={() => void context.window(0)}>Reload frozen chart</button></p>}
      {page && <><CandleChart key={`${job.id}:${page.start}`} frozen page={{ dataset: { symbol: page.symbol }, items: page.items }} markers={result.events.filter(e => e.kind !== 'SKIP')} />
        <div className="flex flex-wrap items-center gap-2 text-xs"><button className={buttonClass} disabled={!page.start} onClick={() => void context.window(Math.max(0, page.start - 100))}>Earlier run candles</button><span>Bars {page.start}–{page.start + page.items.length - 1} / {page.total}</span><button className={buttonClass} disabled={page.start + 100 >= page.total} onClick={() => void context.window(page.start + 100)}>Later run candles</button></div>
        <details><summary className="cursor-pointer text-sm">Events in this candle window</summary><div className="mt-3 space-y-3">{result.events.filter(e => e.barIndex >= page.start && e.barIndex < page.start + page.items.length).map(e => <details key={e.id} className="border-l border-slate-700 pl-3"><summary className="cursor-pointer text-xs">Event {e.id} · {e.kind} · bar {e.barIndex}{e.timePrecision === 'BAR_INTERVAL' ? ' · exact time unknown' : ''}</summary><div className="py-3"><Values values={e} label={`Event ${e.id}`} /></div></details>)}</div></details>
      </>}
    </section>}
    <details className="help-details"><summary>Run details, risk & provenance</summary><div className="mt-2 space-y-5"><p className="text-amber-200">Unverified research data. Historical results do not guarantee future profit.</p>
      <Values label="Run provenance" values={{ jobId: job.id, strategyId: job.strategyId, revision: job.revision, datasetId: job.datasetId, inputHash: job.inputHash, dslHash: job.dslHash, dataHash: job.dataHash, resultHash: job.resultHash, createdAt: job.createdAt, finishedAt: job.finishedAt, engineVersion: result.runCard.engineVersion, minimumBars: result.runCard.minimumBars }} />
      <Values label="Frozen source" values={result.runCard.dataset} /><Values label="Execution policy" values={result.runCard.policy} />
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all border border-slate-800 p-3 text-xs text-slate-400">{result.runCard.canonicalDsl}</pre>
      <ul className="list-inside list-disc text-xs text-slate-400">{result.runCard.limitations.map(text => <li key={text}>{text}</li>)}</ul>
    </div></details>
  </div>
}
