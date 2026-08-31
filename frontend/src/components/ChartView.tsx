import { useMarket } from '../market/MarketContext'
import { DatasetChart } from '../market/DatasetChart'

const candles = [
  { x: 45, open: 128, close: 108, high: 94, low: 141, up: true },
  { x: 86, open: 109, close: 120, high: 101, low: 134, up: false },
  { x: 127, open: 121, close: 95, high: 83, low: 129, up: true },
  { x: 168, open: 96, close: 82, high: 70, low: 108, up: true },
  { x: 209, open: 82, close: 101, high: 74, low: 112, up: false },
  { x: 250, open: 100, close: 73, high: 60, low: 108, up: true },
  { x: 291, open: 74, close: 88, high: 65, low: 99, up: false },
  { x: 332, open: 88, close: 61, high: 48, low: 97, up: true },
  { x: 373, open: 62, close: 70, high: 54, low: 81, up: false },
  { x: 414, open: 69, close: 47, high: 35, low: 78, up: true },
  { x: 455, open: 48, close: 57, high: 40, low: 67, up: false },
  { x: 496, open: 56, close: 39, high: 27, low: 64, up: true },
  { x: 537, open: 40, close: 52, high: 32, low: 63, up: false },
  { x: 578, open: 51, close: 31, high: 20, low: 59, up: true },
]

export function ChartView() {
  return useMarket() ? <DatasetChart /> : <DemoChart />
}

function DemoChart() {
  return (
    <section aria-label="Chart" data-testid="chart-view" className="flex h-full min-h-0 flex-col">
      <div data-testid="chart-toolbar" className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-400">
          Symbol
          <select aria-label="Symbol" disabled title="Static demo; dataset selection comes with market-data import" defaultValue="BTCUSDT" className="bg-transparent text-sm font-semibold text-white focus:outline-none">
            <option>BTCUSDT</option><option>ETHUSDT</option><option>EURUSD</option>
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-400">
          Timeframe
          <select aria-label="Timeframe" disabled title="Static demo timeframe" defaultValue="1h" className="bg-transparent text-sm font-semibold text-white focus:outline-none">
            <option>15m</option><option>1h</option><option>4h</option><option>1D</option>
          </select>
        </label>
        <button type="button" disabled title="Fixed illustrative overlays only" className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 focus-visible:ring-2 focus-visible:ring-sky-400">Indicator <span className="ml-1 text-sky-300">EMA · RSI</span></button>
        <button type="button" disabled title="Chart settings available with the connected chart workspace" className="min-h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 focus-visible:ring-2 focus-visible:ring-sky-400">Settings</button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-white">Bitcoin / Tether</h2><span className="rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-slate-400">MOCK</span></div>
            <p className="mt-1 text-sm text-slate-500">BTCUSDT · 1 hour · UTC · closed candles only</p>
          </div>
          <div className="text-right"><p className="font-mono text-xl font-semibold text-emerald-300">$66,842.10</p><p className="text-xs text-emerald-300"><span aria-hidden="true">▲</span> +2.18% sample move</p></div>
        </div>

        <div data-testid="mock-chart" className="relative min-h-[180px] flex-1 overflow-hidden rounded-sm border border-slate-800 bg-slate-950" aria-label="Native mock candlestick chart">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(51,65,85,.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(51,65,85,.22)_1px,transparent_1px)] bg-[size:64px_52px]" />
          <svg viewBox="0 0 640 210" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="Static mock BTCUSDT candlestick series">
            <polyline points="20,145 70,132 120,123 170,104 220,110 270,87 320,91 370,68 420,72 470,54 520,59 620,31" fill="none" stroke="#38bdf8" strokeWidth="2" strokeOpacity=".45" />
            {candles.map((candle) => (
              <g key={candle.x}>
                <line x1={candle.x} x2={candle.x} y1={candle.high} y2={candle.low} stroke={candle.up ? '#34d399' : '#fb7185'} strokeWidth="2" />
                <rect x={candle.x - 6} y={Math.min(candle.open, candle.close)} width="12" height={Math.max(7, Math.abs(candle.close - candle.open))} rx="2" fill={candle.up ? '#34d399' : '#fb7185'} />
              </g>
            ))}
            <line x1="18" x2="622" y1="87" y2="87" stroke="#a1a1aa" strokeWidth="1.5" strokeDasharray="5 5" />
          </svg>
          <div className="absolute left-4 top-4 flex gap-4 rounded-lg bg-slate-950/70 px-3 py-2 text-xs backdrop-blur">
            <span className="text-sky-300">EMA 50&nbsp; 65,104</span><span className="text-slate-300">RSI 14&nbsp; 58.4</span>
          </div>
          <div className="absolute bottom-4 left-4 flex gap-2 text-[11px]"><span className="rounded bg-emerald-400/15 px-2 py-1 text-emerald-300">▲ Entry · mock</span><span className="rounded bg-rose-400/15 px-2 py-1 text-rose-300">SL · mock</span></div>
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><span aria-hidden="true">ⓘ</span> Static UI preview only. No market feed or trading execution is connected.</p>
      </div>
    </section>
  )
}
