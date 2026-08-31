import { useEffect, useRef, useState } from 'react'
import type { Candle } from './api'
import { buttonClass } from '../auth/AuthForm'

export function CandleChart({ page, markers = [], frozen = false }: { page: { dataset: { symbol: string }; items: Candle[] }; markers?: { id: number; barIndex: number; kind: string }[]; frozen?: boolean }) {
  const [index, setIndex] = useState(Math.max(0, page.items.length - 1))
  const svg = useRef<SVGSVGElement>(null), [viewWidth, setViewWidth] = useState(900)
  useEffect(() => {
    if (!svg.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => { const width = entries[0]?.contentRect.width; if (width) setViewWidth(Math.max(240, width)) })
    observer.observe(svg.current)
    return () => observer.disconnect()
  }, [])
  const count = page.items.length, active = page.items[Math.min(index, count - 1)]
  if (!active) return <p className="p-6 text-sm text-slate-400">No candles in this window. Choose an earlier window.</p>
  const lows = page.items.map(c => Number(c.low)), highs = page.items.map(c => Number(c.high))
  const min = Math.min(...lows), max = Math.max(...highs), pad = Math.max((max - min) * .08, Math.abs(max) * .001, 1e-8)
  const lower = Math.max(0, min - pad), upper = max + pad, left = 10, width = viewWidth - 92, top = 18, height = 220
  const y = (value: number) => top + (upper - value) / (upper - lower) * height
  const x = (i: number) => left + (i + .5) * width / count
  const bodyWidth = Math.max(1, Math.min(18, width / count * .65))
  return <div className="flex shrink-0 flex-col gap-3">
    <svg ref={svg} viewBox={`0 0 ${viewWidth} 270`} className="h-[270px] w-full shrink-0 border border-slate-800 bg-slate-950" role="img" aria-label={`${page.dataset.symbol} ${frozen ? 'frozen backtest' : 'imported'} candlesticks, ${count} candles in UTC`}
      onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); setIndex(Math.max(0, Math.min(count - 1, Math.floor(((event.clientX - rect.left) / rect.width * viewWidth - left) / width * count)))) }}>
      {Array.from({ length: 5 }, (_, i) => {
        const price = upper - (upper - lower) * i / 4, screenY = y(price)
        const label = Math.abs(price) >= 1e8 || (price !== 0 && Math.abs(price) < 1e-3) ? price.toExponential(3) : Number(price.toPrecision(6)).toString()
        return <g key={i}><line x1={left} x2={left + width} y1={screenY} y2={screenY} stroke="#263244" /><text x={left + width + 8} y={screenY + 4} fill="#94a3b8" fontSize="11" fontFamily="monospace">{label}</text></g>
      })}
      {markers.filter(m => m.barIndex >= page.items[0].ordinal && m.barIndex <= page.items[count - 1].ordinal).map(m => {
        const at = m.barIndex - page.items[0].ordinal, color = m.kind === 'ENTRY' ? '#34d399' : m.kind === 'EXIT' ? '#fb7185' : '#fbbf24'
        const markerY = m.kind === 'ENTRY' ? 30 : m.kind === 'EXIT' ? 45 : 60
        return <g key={m.id}><title>{`${m.kind} · bar ${m.barIndex} · event ${m.id}`}</title><circle cx={x(at)} cy={markerY} r="4" fill={color} /></g>
      })}
      <rect x={x(index) - width / count / 2} y={top} width={width / count} height={height} fill="#94a3b8" opacity=".12" />
      {page.items.map((candle, i) => {
        const open = Number(candle.open), close = Number(candle.close), color = close >= open ? '#34d399' : '#fb7185'
        return <g key={candle.ordinal}><line x1={x(i)} x2={x(i)} y1={y(Number(candle.high))} y2={y(Number(candle.low))} stroke={color} strokeWidth="1" />
          <rect x={x(i) - bodyWidth / 2} y={Math.min(y(open), y(close))} width={bodyWidth} height={Math.max(1, Math.abs(y(open) - y(close)))} fill={color} /></g>
      })}
      <text x={left} y="260" fill="#94a3b8" fontSize="11">{page.items[0].time.slice(5, 16).replace('T', ' ')}</text>
      <text x={left + width} y="260" fill="#94a3b8" fontSize="11" textAnchor="end">{page.items[count - 1].time.slice(5, 16).replace('T', ' ')}</text>
    </svg>
    <div className="flex flex-wrap items-center gap-2"><button className={buttonClass} disabled={index <= 0} onClick={() => setIndex(i => i - 1)}>Previous candle</button>
      <label className="flex min-w-24 flex-1 items-center gap-2 text-xs text-slate-400">Inspect candle<input aria-label="Candle index" aria-valuetext={active.time} className="min-w-16 flex-1" type="range" min={0} max={count - 1} value={index} onChange={event => setIndex(Number(event.target.value))} onKeyDown={event => {
        const target = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? index - 1 : ['ArrowRight', 'ArrowUp'].includes(event.key) ? index + 1 : null
        if (target === null) return
        event.preventDefault(); setIndex(Math.max(0, Math.min(count - 1, target)))
      }} /></label>
      <button className={buttonClass} disabled={index >= count - 1} onClick={() => setIndex(i => i + 1)}>Next candle</button></div>
    <dl aria-label="Selected candle values" className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-800 pt-3 font-mono text-xs sm:grid-cols-3">
      <div className="col-span-2 sm:col-span-3"><dt className="text-slate-500">Candle open time · UTC</dt><dd className="text-slate-200">{active.time}</dd></div>
      {(['open', 'high', 'low', 'close', 'volume'] as const).map(field => <div key={field}><dt className="capitalize text-slate-500">{field}</dt><dd className="break-all text-slate-200">{active[field]}</dd></div>)}
    </dl>
  </div>
}
