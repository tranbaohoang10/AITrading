import { equityPoints } from '../data/mockData'
import { useTrading } from '../context/TradingContext'
import { Icon } from './Icon'

export function BacktestResults() {
  const { metrics, backtestStatus, runBacktest } = useTrading()
  const points = equityPoints.map((value, index) => `${index * (600 / (equityPoints.length - 1))},${120 - value}`).join(' ')

  return (
    <section aria-label="Backtest Results" data-testid="backtest-results" className="h-full overflow-y-auto p-4 sm:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-white">Backtest Results</h2><p className="mt-1 text-sm text-slate-500">Deterministic mock presentation · not a real engine</p></div>
        <button type="button" onClick={runBacktest} disabled={backtestStatus === 'loading'} className="flex min-h-11 items-center gap-2 rounded-sm bg-emerald-400 px-4 text-sm font-bold text-slate-950 hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-white disabled:cursor-wait disabled:opacity-60">
          <Icon name="play" className="h-4 w-4" />{backtestStatus === 'loading' ? 'Running mock…' : 'Run Backtest'}
        </button>
      </div>
      <div role="status" className="mb-4 flex items-center gap-2 text-xs text-slate-400"><span aria-hidden="true">{backtestStatus === 'complete' ? '✓' : '○'}</span>{backtestStatus === 'complete' ? 'Mock run complete' : backtestStatus === 'loading' ? 'Calculating static sample…' : 'Waiting for a separate Backtest action'}</div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-sm border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs font-medium text-slate-500">{metric.label}</p><p className="mt-2 text-xl font-semibold text-white">{metric.value}</p><p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
          </article>
        ))}
      </div>
      <article className="mt-4 rounded-sm border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-white">Equity</h3><p className="text-xs text-slate-500">Starting capital $10,000 · mock USD</p></div><p className="font-mono text-sm text-emerald-300">{backtestStatus === 'complete' ? '$11,842' : '$10,000'}</p></div>
        <div className="mt-4 h-40 overflow-hidden rounded-sm bg-slate-950 p-3">
          <svg viewBox="0 0 600 130" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Mock equity curve">
            <defs><linearGradient id="equity" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d399" stopOpacity=".35" /><stop offset="1" stopColor="#34d399" stopOpacity="0" /></linearGradient></defs>
            <polygon points={`0,130 ${points} 600,130`} fill="url(#equity)" /><polyline points={points} fill="none" stroke="#34d399" strokeWidth="3" />
          </svg>
        </div>
      </article>
      <p className="mt-4 rounded-sm border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200"><span aria-hidden="true">ⓘ</span> Historical mock results are illustrative and do not guarantee future performance.</p>
    </section>
  )
}
