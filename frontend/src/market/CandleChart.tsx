import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Candle } from './api'
import { ema, rsi, sma } from './chartMath'
import type { ChartSettings, Drawing, DrawingTool, IndicatorConfig, Point } from './chartTypes'
import { defaultChartSettings } from './chartTypes'

type Marker = { id: number; barIndex: number; kind: string }

export function CandleChart({ page, markers = [], frozen = false, settings = defaultChartSettings, indicators = [], activeTool = 'cursor', drawings = [], selectedDrawingId, onAddDrawing, onSelectDrawing }: {
  page: { dataset: { symbol: string }; items: Candle[] }
  markers?: Marker[]; frozen?: boolean; settings?: ChartSettings; indicators?: IndicatorConfig[]
  activeTool?: DrawingTool; drawings?: Drawing[]; selectedDrawingId?: string | null
  onAddDrawing?: (drawing: Drawing) => void; onSelectDrawing?: (id: string | null) => void
}) {
  const [index, setIndex] = useState(Math.max(0, page.items.length - 1))
  const [draft, setDraft] = useState<Drawing | null>(null)
  const svg = useRef<SVGSVGElement>(null), [viewWidth, setViewWidth] = useState(900)
  useEffect(() => {
    if (!svg.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => { const width = entries[0]?.contentRect.width; if (width) setViewWidth(Math.max(240, width)) })
    observer.observe(svg.current); return () => observer.disconnect()
  }, [])
  useEffect(() => setIndex(value => Math.max(0, Math.min(page.items.length - 1, value))), [page.items.length])

  const count = page.items.length, active = page.items[Math.min(index, count - 1)]
  const values = useMemo(() => page.items.map(candle => Number(candle.close)), [page.items])
  const computedIndicators = useMemo(() => indicators.map(indicator => ({ ...indicator, values: indicator.type === 'sma' ? sma(values, indicator.period) : indicator.type === 'ema' ? ema(values, indicator.period) : rsi(values, indicator.period) })), [indicators, values])
  if (!active) return <p className="p-6 text-sm text-slate-400">No candles in this window. Choose an earlier window.</p>

  const lows = page.items.map(c => Number(c.low)), highs = page.items.map(c => Number(c.high))
  const min = Math.min(...lows), max = Math.max(...highs), pad = Math.max((max - min) * .08, Math.abs(max) * .001, 1e-8)
  const lower = min - pad, upper = max + pad, left = 12, right = 78, width = Math.max(80, viewWidth - left - right), top = 26
  const hasRsi = computedIndicators.some(indicator => indicator.type === 'rsi')
  const priceHeight = hasRsi ? 224 : 292, chartBottom = top + priceHeight
  const rsiTop = chartBottom + 18, rsiHeight = 62, totalHeight = hasRsi ? 352 : 338
  const y = (value: number) => top + (upper - value) / Math.max(upper - lower, 1e-12) * priceHeight
  const x = (i: number) => left + (i + .5) * width / count
  const bodyWidth = Math.max(1, Math.min(22, width / count * (.28 + settings.spacing / 150)))
  const format = (value: number) => Math.abs(value) >= 1e8 || (value !== 0 && Math.abs(value) < 1e-3) ? value.toExponential(3) : Number(value.toPrecision(7)).toString()
  const point = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    const clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left
    const clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top
    const px = (clientX - rect.left) / Math.max(rect.width, 1) * viewWidth
    const py = (clientY - rect.top) / Math.max(rect.height, 1) * totalHeight
    return { x: Math.max(0, Math.min(1, (px - left) / width)), y: Math.max(0, Math.min(1, (py - top) / priceHeight)) }
  }
  const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `drawing-${Date.now()}`
  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (activeTool === 'cursor') {
      const rect = event.currentTarget.getBoundingClientRect()
      setIndex(Math.max(0, Math.min(count - 1, Math.floor(((event.clientX - rect.left) / Math.max(rect.width, 1) * viewWidth - left) / width * count))))
      onSelectDrawing?.(null); return
    }
    const start = point(event)
    if (activeTool === 'horizontal' || activeTool === 'text') {
      onAddDrawing?.({ id: id(), type: activeTool, points: [start], ...(activeTool === 'text' ? { text: 'Note' } : {}) }); return
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDraft({ id: id(), type: activeTool, points: activeTool === 'brush' ? [start] : [start, start] })
  }
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draft) return
    const next = point(event)
    setDraft(current => !current ? current : current.type === 'brush' ? { ...current, points: [...current.points, next] } : { ...current, points: [current.points[0], next] })
  }
  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draft) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (draft.points.length > 1) onAddDrawing?.(draft)
    setDraft(null)
  }
  const drawingShape = (drawing: Drawing) => {
    const points = drawing.points.map(value => ({ x: left + value.x * width, y: top + value.y * priceHeight }))
    const selected = selectedDrawingId === drawing.id, color = selected ? '#f8fafc' : '#94a3b8', strokeWidth = selected ? 2 : 1.5
    const select = (event: ReactPointerEvent<SVGElement>) => { event.stopPropagation(); onSelectDrawing?.(drawing.id) }
    if (drawing.type === 'horizontal') return <g key={drawing.id} onPointerDown={select} className="cursor-pointer"><line x1={left} x2={left + width} y1={points[0].y} y2={points[0].y} stroke={color} strokeWidth={strokeWidth} strokeDasharray="5 4" /><circle cx={points[0].x} cy={points[0].y} r={selected ? 4 : 2.5} fill={color} /></g>
    if (drawing.type === 'text') return <g key={drawing.id} onPointerDown={select} className="cursor-pointer"><circle cx={points[0].x} cy={points[0].y} r="3" fill={color} /><text x={points[0].x + 7} y={points[0].y - 6} fill={color} fontSize="12" fontWeight="600">{drawing.text || 'Note'}</text></g>
    if (drawing.type === 'brush') return <polyline key={drawing.id} onPointerDown={select} className="cursor-pointer" points={points.map(value => `${value.x},${value.y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeWidth + .5} strokeLinecap="round" strokeLinejoin="round" />
    const [start, end = start] = points
    return <g key={drawing.id} onPointerDown={select} className="cursor-pointer"><line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={color} strokeWidth={strokeWidth} strokeDasharray={drawing.type === 'ruler' ? '4 3' : undefined} />{selected && <><circle cx={start.x} cy={start.y} r="4" fill={color} /><circle cx={end.x} cy={end.y} r="4" fill={color} /></>}{drawing.type === 'ruler' && <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 7} textAnchor="middle" fill={color} fontSize="11">{`${Math.abs((end.y - start.y) * 100).toFixed(1)}% · ${Math.round(Math.abs(end.x - start.x) * count)} bars`}</text>}</g>
  }
  const linePoints = page.items.map((candle, i) => `${x(i)},${y(Number(candle.close))}`).join(' ')
  const areaPath = `${linePoints.split(' ').map((value, i) => `${i ? 'L' : 'M'}${value}`).join(' ')} L${x(count - 1)},${chartBottom} L${x(0)},${chartBottom} Z`
  const lastClose = Number(page.items[count - 1].close)

  return <div className="flex shrink-0 flex-col gap-2">
    <svg ref={svg} viewBox={`0 0 ${viewWidth} ${totalHeight}`} style={{ background: settings.background, touchAction: 'none' }} className={`h-[340px] w-full shrink-0 border border-slate-800 sm:h-[52vh] sm:min-h-[360px] sm:max-h-[520px] ${activeTool === 'cursor' ? 'cursor-crosshair' : 'cursor-cell'}`} role="img" aria-label={`${page.dataset.symbol} ${frozen ? 'frozen backtest' : 'imported'} ${settings.chartType === 'candles' ? 'candlesticks' : settings.chartType}, ${count} candles in UTC`}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => setDraft(null)}>
      <defs><linearGradient id="quant-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#94a3b8" stopOpacity=".28"/><stop offset="1" stopColor="#94a3b8" stopOpacity=".02"/></linearGradient></defs>
      <rect x="0" y="0" width={viewWidth} height={totalHeight} fill={settings.background} />
      {settings.showGrid && Array.from({ length: 5 }, (_, i) => { const price = upper - (upper - lower) * i / 4, screenY = y(price); return <g key={i}><line x1={left} x2={left + width} y1={screenY} y2={screenY} stroke={settings.gridColor} /><text x={left + width + 8} y={screenY + 4} fill="#737b88" fontSize="10" fontFamily="monospace">{format(price)}</text></g> })}
      {settings.showGrid && Array.from({ length: 6 }, (_, i) => <line key={`v-${i}`} x1={left + width * i / 5} x2={left + width * i / 5} y1={top} y2={chartBottom} stroke={settings.gridColor} opacity=".55" />)}
      {settings.showVolume && (() => { const maximum = Math.max(...page.items.map(item => Number(item.volume)), 1); return page.items.map((candle, i) => { const value = Number(candle.volume), height = value / maximum * Math.min(42, priceHeight * .18); return <rect key={`volume-${candle.ordinal}`} x={x(i) - bodyWidth / 2} y={chartBottom - height} width={Math.max(1, bodyWidth)} height={height} fill={Number(candle.close) >= Number(candle.open) ? settings.bullColor : settings.bearColor} opacity=".16" /> }) })()}
      {settings.chartType === 'area' && <path d={areaPath} fill="url(#quant-area)" stroke="#cbd5e1" strokeWidth="1.5" />}
      {settings.chartType === 'line' && <polyline points={linePoints} fill="none" stroke="#cbd5e1" strokeWidth="1.7" />}
      {(settings.chartType === 'candles' || settings.chartType === 'bars') && page.items.map((candle, i) => {
        const open = Number(candle.open), close = Number(candle.close), color = close >= open ? settings.bullColor : settings.bearColor
        if (settings.chartType === 'bars') return <g key={candle.ordinal}><line x1={x(i)} x2={x(i)} y1={y(Number(candle.high))} y2={y(Number(candle.low))} stroke={color} strokeWidth="1.2"/><line x1={x(i) - bodyWidth / 2} x2={x(i)} y1={y(open)} y2={y(open)} stroke={color}/><line x1={x(i)} x2={x(i) + bodyWidth / 2} y1={y(close)} y2={y(close)} stroke={color}/></g>
        return <g key={candle.ordinal}>{settings.candleWicks && <line x1={x(i)} x2={x(i)} y1={y(Number(candle.high))} y2={y(Number(candle.low))} stroke={color} strokeWidth="1" />}<rect x={x(i) - bodyWidth / 2} y={Math.min(y(open), y(close))} width={bodyWidth} height={Math.max(1, Math.abs(y(open) - y(close)))} fill={color} stroke={settings.candleBorders ? settings.background : color} strokeWidth={settings.candleBorders ? .6 : 0} /></g>
      })}
      {computedIndicators.filter(item => item.type !== 'rsi').map(indicator => <polyline key={indicator.id} points={indicator.values.map((value, i) => value === null ? null : `${x(i)},${y(value)}`).filter(Boolean).join(' ')} fill="none" stroke={indicator.color} strokeWidth="1.5"><title>{`${indicator.type.toUpperCase()} ${indicator.period}`}</title></polyline>)}
      {settings.showPriceLine && <g><line x1={left} x2={left + width} y1={y(lastClose)} y2={y(lastClose)} stroke="#94a3b8" strokeDasharray="3 3" opacity=".7"/><rect x={left + width + 3} y={y(lastClose) - 8} width={right - 8} height="16" rx="2" fill="#475569"/><text x={left + width + 7} y={y(lastClose) + 4} fill="#f8fafc" fontSize="10" fontFamily="monospace">{format(lastClose)}</text></g>}
      {markers.filter(marker => marker.barIndex >= page.items[0].ordinal && marker.barIndex <= page.items[count - 1].ordinal).map(marker => { const at = Math.max(0, page.items.findIndex(item => item.ordinal >= marker.barIndex)), color = marker.kind === 'ENTRY' ? '#22c55e' : marker.kind === 'EXIT' ? '#ef4444' : '#eab308'; return <circle key={marker.id} cx={x(at)} cy={top + 12} r="4" fill={color}><title>{`${marker.kind} · bar ${marker.barIndex} · event ${marker.id}`}</title></circle> })}
      {(drawings.concat(draft ? [draft] : [])).map(drawingShape)}
      {settings.showSymbol && <text x={left + 4} y="18" fill="#e5e7eb" fontSize="11" fontWeight="600">{page.dataset.symbol} · UTC</text>}
      {settings.showOhlc && <text x={Math.min(viewWidth - 300, left + 120)} y="18" fill="#8b93a1" fontSize="10" fontFamily="monospace">O {active.open}  H {active.high}  L {active.low}  C {active.close}</text>}
      {hasRsi && <g><rect x={left} y={rsiTop} width={width} height={rsiHeight} fill="#0b0e12"/><line x1={left} x2={left + width} y1={rsiTop + rsiHeight * .3} y2={rsiTop + rsiHeight * .3} stroke={settings.gridColor} strokeDasharray="3 4"/><line x1={left} x2={left + width} y1={rsiTop + rsiHeight * .7} y2={rsiTop + rsiHeight * .7} stroke={settings.gridColor} strokeDasharray="3 4"/>{computedIndicators.filter(item => item.type === 'rsi').map(indicator => <polyline key={indicator.id} points={indicator.values.map((value, i) => value === null ? null : `${x(i)},${rsiTop + (100 - value) / 100 * rsiHeight}`).filter(Boolean).join(' ')} fill="none" stroke={indicator.color} strokeWidth="1.4"/>)}<text x={left + 4} y={rsiTop + 12} fill="#8b93a1" fontSize="10">RSI</text><text x={left + width + 8} y={rsiTop + 5} fill="#737b88" fontSize="9">100</text><text x={left + width + 8} y={rsiTop + rsiHeight} fill="#737b88" fontSize="9">0</text></g>}
      <text x={left} y={totalHeight - 5} fill="#737b88" fontSize="10">{page.items[0].time.slice(5, 16).replace('T', ' ')}</text><text x={left + width} y={totalHeight - 5} fill="#737b88" fontSize="10" textAnchor="end">{page.items[count - 1].time.slice(5, 16).replace('T', ' ')}</text>
    </svg>
    <div className="flex flex-wrap items-center gap-2"><button className="h-8 rounded-md border border-slate-800 bg-slate-900 px-2 text-[11px] font-medium text-slate-400 hover:text-white disabled:opacity-35" disabled={index <= 0} onClick={() => setIndex(i => i - 1)}>Previous candle</button><label className="flex min-w-24 flex-1 items-center gap-2 text-[10px] text-slate-500">Inspect candle<input aria-label="Candle index" aria-valuetext={active.time} className="min-w-16 flex-1" type="range" min={0} max={count - 1} value={index} onChange={event => setIndex(Number(event.target.value))} onKeyDown={event => { const target = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? index - 1 : ['ArrowRight', 'ArrowUp'].includes(event.key) ? index + 1 : null; if (target === null) return; event.preventDefault(); setIndex(Math.max(0, Math.min(count - 1, target))) }} /></label><button className="h-8 rounded-md border border-slate-800 bg-slate-900 px-2 text-[11px] font-medium text-slate-400 hover:text-white disabled:opacity-35" disabled={index >= count - 1} onClick={() => setIndex(i => i + 1)}>Next candle</button></div>
    <dl aria-label="Selected candle values" className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-800 pt-2 font-mono text-[11px] sm:grid-cols-3"><div className="col-span-2 sm:col-span-3"><dt className="text-slate-600">Candle open · UTC</dt><dd className="text-slate-300">{active.time}</dd></div>{(['open', 'high', 'low', 'close', 'volume'] as const).map(field => <div key={field}><dt className="capitalize text-slate-600">{field}</dt><dd className="break-all text-slate-300">{active[field]}</dd></div>)}</dl>
  </div>
}
