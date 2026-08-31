import { useTrading } from '../context/TradingContext'
import type { ViewportMode, WorkspaceTab } from '../types'
import { BacktestResults } from './BacktestResults'
import { ChartView } from './ChartView'
import { CodeViewer } from './CodeViewer'
import { Icon } from './Icon'
import { TradesView } from './TradesView'
import { useMarket } from '../market/MarketContext'
import { useStrategy } from '../strategy/StrategyContext'
import { StrategyEditor } from '../strategy/StrategyEditor'
import { useBacktest } from '../backtest/BacktestContext'

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'chart', label: 'Chart' },
  { id: 'strategy-dsl', label: 'Strategy DSL' },
  { id: 'pine-script', label: 'Pine Script' },
  { id: 'mql5', label: 'MQL5' },
  { id: 'backtest-results', label: 'Backtest Results' },
  { id: 'trades', label: 'Trades' },
]

export function TradingWorkspace({ mode }: { mode: ViewportMode }) {
  const market = useMarket()
  const strategy = useStrategy()
  const backtest = useBacktest()
  const { activeTab, setActiveTab, strategyDsl, pineScript, mql5, backtestStatus, runBacktest } = useTrading()

  const content = (() => {
    switch (activeTab) {
      case 'chart': return <ChartView />
      case 'strategy-dsl': return strategy ? <StrategyEditor /> : <CodeViewer title="Strategy DSL" language="JSON · validated mock structure" code={strategyDsl} />
      case 'pine-script': return <CodeViewer title="Pine Script" language="Pine Script · read-only mock" code={pineScript} />
      case 'mql5': return <CodeViewer title="MQL5" language="MQL5 · read-only mock" code={mql5} />
      case 'backtest-results': return <BacktestResults />
      case 'trades': return <TradesView mode={mode} />
    }
  })()

  return (
    <main aria-label="Trading Workspace" data-testid="trading-workspace" className="flex h-full min-w-0 flex-1 flex-col bg-slate-950">
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-slate-800 px-4">
        <div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">Workspace / {market ? market.selected?.symbol ?? 'Market data' : 'BTCUSDT'}</p><h1 className="sr-only">AI Trading Platform</h1></div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><span className="h-2 w-2 rounded-sm bg-slate-400" aria-hidden="true" />{market ? 'Private research' : 'Mock data ready'}</span>
          <button type="button" onClick={backtest ? () => setActiveTab('backtest-results') : runBacktest} disabled={!backtest && (!!market || backtestStatus === 'loading')} title={backtest ? 'Open saved backtest setup and results' : market ? 'Backtest engine is not connected yet' : undefined} className="flex min-h-10 items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/20 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60">
            <Icon name="play" className="h-4 w-4" />{!backtest && backtestStatus === 'loading' ? 'Running…' : 'Backtest'}
          </button>
        </div>
      </header>
      <div role="tablist" aria-label="Workspace views" className="flex shrink-0 overflow-x-auto border-b border-slate-800 bg-slate-950 px-2 pt-2">
        {tabs.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1} aria-controls={`panel-${tab.id}`} id={`tab-${tab.id}`} type="button" onClick={() => setActiveTab(tab.id)} onKeyDown={(event) => {
            const index = tabs.findIndex((item) => item.id === tab.id)
            const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (next < 0) return
            event.preventDefault()
            setActiveTab(tabs[next].id)
            document.getElementById(`tab-${tabs[next].id}`)?.focus()
          }} className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 ${activeTab === tab.id ? 'border-sky-400 text-white' : 'border-transparent text-slate-500 hover:text-slate-200'}`}>
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" tabIndex={0} id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} data-active-tab={activeTab} className="min-h-0 flex-1">
        {content}
      </div>
    </main>
  )
}
