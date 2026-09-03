import { useTrading } from '../context/TradingContext'
import type { ViewportMode, WorkspaceTab } from '../types'
import { BacktestResults } from './BacktestResults'
import { ChartView } from './ChartView'
import { CodeViewer } from './CodeViewer'
import { TradesView } from './TradesView'
import { useMarket } from '../market/MarketContext'
import { useStrategy } from '../strategy/StrategyContext'
import { StrategyEditor } from '../strategy/StrategyEditor'
import { PineWorkspace } from '../pine/PineWorkspace'
import { Mql5Workspace } from '../mql5/Mql5Workspace'
import { useAuth } from '../auth/AuthContext'

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'chart', label: 'Chart' },
  { id: 'strategy-dsl', label: 'Strategy DSL' },
  { id: 'pine-script', label: 'Pine Script' },
  { id: 'mql5', label: 'MQL5' },
  { id: 'backtest-results', label: 'Backtest Results' },
  { id: 'trades', label: 'Trades' },
]

export function TradingWorkspace({ mode, onNavigate }: { mode: ViewportMode; onNavigate?: (action: string) => void }) {
  const market = useMarket()
  const strategy = useStrategy()
  const auth = useAuth()
  const { activeTab, setActiveTab, strategyDsl, pineScript, mql5 } = useTrading()
  const initials = auth?.user.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'Q'

  const content = (() => {
    switch (activeTab) {
      case 'chart': return <ChartView />
      case 'strategy-dsl': return strategy ? <StrategyEditor /> : <CodeViewer title="Strategy DSL" language="JSON · validated mock structure" code={strategyDsl} />
      case 'pine-script': return strategy ? <PineWorkspace /> : <CodeViewer title="Pine Script" language="Pine Script · read-only mock" code={pineScript} />
      case 'mql5': return strategy ? <Mql5Workspace /> : <CodeViewer title="MQL5" language="MQL5 · read-only mock" code={mql5} />
      case 'backtest-results': return <BacktestResults />
      case 'trades': return <TradesView mode={mode} />
    }
  })()

  return (
    <main aria-label="Trading Workspace" data-testid="trading-workspace" className="flex h-full min-w-0 flex-1 flex-col bg-slate-950">
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-slate-800 px-3">
        <div className="flex min-w-0 items-center gap-2.5"><span className="hidden text-sm font-bold tracking-tight text-slate-100 sm:inline">Quant</span><span className="hidden h-3.5 w-px bg-slate-800 sm:block"/><p className="truncate text-[11px] font-medium text-slate-500">{market ? market.selected?.symbol ?? 'Market data' : 'BTCUSDT'} <span className="text-slate-700">/ Workspace</span></p><h1 className="sr-only">Quant trading workspace</h1></div>
        <div className="flex items-center gap-1.5">
          <span className="status-chip status-chip--quiet hidden sm:inline-flex">Private</span>
          <button type="button" aria-label="Open account" title={auth?.user.displayName ?? 'Account'} onClick={() => onNavigate?.('account')} className="grid h-7 w-7 place-items-center rounded-full border border-slate-700 bg-slate-800 text-[10px] font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-slate-300">{initials}</button>
        </div>
      </header>
      <div role="tablist" aria-label="Workspace views" className="flex h-10 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-slate-800 bg-slate-950 px-2">
        {tabs.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1} aria-controls={`panel-${tab.id}`} id={`tab-${tab.id}`} type="button" onClick={() => setActiveTab(tab.id)} onKeyDown={(event) => {
            const index = tabs.findIndex((item) => item.id === tab.id)
            const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (next < 0) return
            event.preventDefault()
            setActiveTab(tabs[next].id)
            document.getElementById(`tab-${tabs[next].id}`)?.focus()
          }} className={`mb-1 min-h-8 shrink-0 rounded-md px-2.5 text-[11px] font-medium transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300 ${activeTab === tab.id ? 'bg-slate-800 text-slate-100' : 'text-slate-600 hover:bg-slate-900 hover:text-slate-300'}`}>
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
