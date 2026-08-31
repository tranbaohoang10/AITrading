import { useTrading } from '../context/TradingContext'
import type { ViewportMode } from '../types'
import { useBacktest } from '../backtest/BacktestContext'
import { BacktestWorkspace } from '../backtest/BacktestWorkspace'

export function TradesView({ mode }: { mode: ViewportMode }) {
  const actual = useBacktest()
  return actual ? <BacktestWorkspace tradesOnly /> : <MockTradesView mode={mode} />
}
function MockTradesView({ mode }: { mode: ViewportMode }) {
  const { trades } = useTrading()

  return (
    <section aria-label="Trades" data-testid="trades-view" className="h-full overflow-y-auto p-4 sm:p-5">
      <div className="mb-5"><h2 className="text-lg font-semibold text-white">Trades</h2><p className="mt-1 text-sm text-slate-500">Mock executions appear after you run Backtest.</p></div>
      {trades.length === 0 ? (
        <div className="grid min-h-56 place-items-center rounded-sm border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center"><div><p className="text-2xl" aria-hidden="true">◎</p><p className="mt-2 font-medium text-slate-300">No mock trades yet</p><p className="mt-1 text-sm text-slate-500">Run Backtest as a separate action to populate this view.</p></div></div>
      ) : mode === 'mobile' ? (
        <div data-testid="trades-cards" className="space-y-3">
          {trades.map((trade) => <TradeCard key={trade.id} trade={trade} />)}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-slate-800">
          <table data-testid="trades-table" className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-500"><tr>{['Trade', 'Symbol', 'Side', 'Entry', 'Exit', 'SL', 'TP', 'PnL', 'Time'].map((item) => <th key={item} scope="col" className="px-4 py-3 font-semibold">{item}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/40">{trades.map((trade) => <tr key={trade.id} className="text-slate-300"><td className="px-4 py-4 font-mono text-xs text-slate-500">{trade.id}</td><td className="px-4 py-4 font-semibold text-white">{trade.symbol}</td><td className="px-4 py-4">{trade.side}</td><td className="px-4 py-4 font-mono">{trade.entry}</td><td className="px-4 py-4 font-mono">{trade.exit}</td><td className="px-4 py-4 font-mono">{trade.stopLoss}</td><td className="px-4 py-4 font-mono">{trade.takeProfit}</td><td className={`px-4 py-4 font-mono font-semibold ${trade.result === 'Win' ? 'text-emerald-300' : 'text-rose-300'}`}>{trade.result === 'Win' ? '▲' : '▼'} {trade.pnl}</td><td className="px-4 py-4 text-xs text-slate-500">{trade.time}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function TradeCard({ trade }: { trade: ReturnType<typeof useTrading>['trades'][number] }) {
  return (
    <article className="rounded-sm border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-start justify-between"><div><p className="font-semibold text-white">{trade.symbol} · {trade.side}</p><p className="mt-1 text-xs text-slate-500">{trade.id} · {trade.time}</p></div><p className={`font-mono font-semibold ${trade.result === 'Win' ? 'text-emerald-300' : 'text-rose-300'}`}>{trade.result === 'Win' ? '▲' : '▼'} {trade.pnl}</p></div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-slate-500">Entry → Exit</dt><dd className="mt-1 font-mono text-slate-200">{trade.entry} → {trade.exit}</dd></div><div><dt className="text-slate-500">SL / TP</dt><dd className="mt-1 font-mono text-slate-200">{trade.stopLoss} / {trade.takeProfit}</dd></div></dl>
    </article>
  )
}
