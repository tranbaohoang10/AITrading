import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { Icon } from '../components/Icon'
import type { Candle } from './api'
import { ema, rsi, sma } from './chartMath'
import type { ChartSettings, Drawing, DrawingTool, IndicatorConfig, Point } from './chartTypes'
import { defaultChartSettings } from './chartTypes'

type Marker = { id: number; barIndex: number; kind: string }
type Viewport = { start: number; count: number }

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))

export function CandleChart({ page, markers = [], frozen = false, settings = defaultChartSettings, indicators = [], activeTool = 'cursor', drawings = [], selectedDrawingId, onAddDrawing, onSelectDrawing, onToggleIndicator, onRemoveIndicator }: {
  page: { dataset: { symbol: string }; items: Candle[] }
  markers?: Marker[]; frozen?: boolean; settings?: ChartSettings; indicators?: IndicatorConfig[]
  activeTool?: DrawingTool; drawings?: Drawing[]; selectedDrawingId?: string | null
  onAddDrawing?: (drawing: Drawing) => void; onSelectDrawing?: (id: string | null) => void
  onToggleIndicator?: (id: string) => void; onRemoveIndicator?: (id: string) => void
}) {
  const [index, setIndex] = useState(Math.max(0, page.items.length - 1))
  const [draft, setDraft] = useState<Drawing | null>(null), [crosshair, setCrosshair] = useState<Point | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ start: 0, count: page.items.length })
  const svg = useRef<SVGSVGElement>(null), pan = useRef<{ pointerId: number; clientX: number; start: number } | null>(null)
  const [viewWidth, setViewWidth] = useState(900)
  useEffect(() => {
    if (!svg.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => { const width = entries[0]?.contentRect.width; if (width) setViewWidth(Math.max(240, width)) })
    observer.observe(svg.current); return () => observer.disconnect()
  }, [])
  useEffect(() => {
    setIndex(value => clamp(value, 0, Math.max(0, page.items.length - 1)))
    setViewport(value => { const count = clamp(value.count || page.items.length, Math.min(12, page.items.length), page.items.length); return { count, start: clamp(value.start, 0, Math.max(0, page.items.length - count)) } })
  }, [page.items.length])

  const total = page.items.length
  const visibleCount = clamp(viewport.count || total, Math.min(12, total), total)
  const visibleStart = clamp(viewport.start, 0, Math.max(0, total - visibleCount))
  const visibleItems = page.items.slice(visibleStart, visibleStart + visibleCount)
  const active = page.items[Math.min(index, Math.max(0, total - 1))]
  const values = useMemo(() => page.items.map(candle => Number(candle.close)), [page.items])
  const computedIndicators = useMemo(() => indicators.map(indicator => ({ ...indicator, values: indicator.type === 'sma' ? sma(values, indicator.period) : indicator.type === 'ema' ? ema(values, indicator.period) : rsi(values, indicator.period) })), [indicators, values])
  const visibleIndicators = computedIndicators.filter(indicator => indicator.visible).map(indicator => ({ ...indicator, values: indicator.values.slice(visibleStart, visibleStart + visibleCount) }))
  if (!active || !visibleItems.length) return <p className="p-6 text-sm text-slate-400">No candles in this window. Choose an earlier window.</p>

  const lows = visibleItems.map(c => Number(c.low)), highs = visibleItems.map(c => Number(c.high))
  const min = Math.min(...lows), max = Math.max(...highs), pad = Math.max((max - min) * .08, Math.abs(max) * .001, 1e-8)
  const lower = min - pad, upper = max + pad, left = 12, right = 78, width = Math.max(80, viewWidth - left - right), top = 26
  const hasRsi = visibleIndicators.some(indicator => indicator.type === 'rsi')
  const priceHeight = hasRsi ? 224 : 292, chartBottom = top + priceHeight
  const rsiTop = chartBottom + 18, rsiHeight = 62, totalHeight = hasRsi ? 352 : 338
  const y = (value: number) => top + (upper - value) / Math.max(upper - lower, 1e-12) * priceHeight
  const x = (i: number) => left + (i + .5) * width / visibleCount
  const bodyWidth = Math.max(1, Math.min(22, width / visibleCount * (.28 + settings.spacing / 150)))
  const format = (value: number) => Math.abs(value) >= 1e8 || (value !== 0 && Math.abs(value) < 1e-3) ? value.toExponential(3) : Number(value.toPrecision(7)).toString()
  const formatTime = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)).replace(',', '')
  const zoneLabel = settings.timezone === 'Asia/Ho_Chi_Minh' ? 'ICT' : settings.timezone === 'America/New_York' ? 'New York' : settings.timezone === 'Europe/London' ? 'London' : 'UTC'
  const point = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    const clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left
    const clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top
    const px = (clientX - rect.left) / Math.max(rect.width, 1) * viewWidth
    const py = (clientY - rect.top) / Math.max(rect.height, 1) * totalHeight
    return { x: clamp((px - left) / width, 0, 1), y: clamp((py - top) / priceHeight, 0, 1) }
  }
  const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `drawing-${Date.now()}`
  const setInspectedFromPoint = (value: Point) => setIndex(clamp(visibleStart + Math.floor(value.x * visibleCount), visibleStart, visibleStart + visibleCount - 1))
  const zoom = (nextCount: number, anchor = .5) => setViewport(current => {
    const currentCount = clamp(current.count || total, Math.min(12, total), total)
    const count = clamp(Math.round(nextCount), Math.min(12, total), total)
    const start = clamp(Math.round(current.start + anchor * currentCount - anchor * count), 0, Math.max(0, total - count))
    return { start, count }
  })
  const resetView = () => { setViewport({ start: 0, count: total }); setIndex(total - 1) }
  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = point(event); setCrosshair(start)
    if (activeTool === 'cursor') {
      setInspectedFromPoint(start); onSelectDrawing?.(null)
      pan.current = { pointerId: event.pointerId, clientX: Number.isFinite(event.clientX) ? event.clientX : 0, start: visibleStart }
      event.currentTarget.setPointerCapture?.(event.pointerId); return
    }
    if (activeTool === 'horizontal' || activeTool === 'vertical' || activeTool === 'text') {
      onAddDrawing?.({ id: id(), type: activeTool, points: [start], ...(activeTool === 'text' ? { text: 'Note' } : {}) }); return
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDraft({ id: id(), type: activeTool, points: activeTool === 'brush' ? [start] : [start, start] })
  }
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const next = point(event); setCrosshair(next)
    if (pan.current && activeTool === 'cursor') {
      const clientX = Number.isFinite(event.clientX) ? event.clientX : pan.current.clientX
      const pixelsPerBar = width / visibleCount, delta = Math.round((pan.current.clientX - clientX) / Math.max(pixelsPerBar, 1))
      setViewport(current => ({ ...current, start: clamp(pan.current!.start + delta, 0, Math.max(0, total - visibleCount)) }))
      return
    }
    if (activeTool === 'cursor') setInspectedFromPoint(next)
    if (!draft) return
    setDraft(current => !current ? current : current.type === 'brush' ? { ...current, points: [...current.points, next] } : { ...current, points: [current.points[0], next] })
  }
  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pan.current) { event.currentTarget.releasePointerCapture?.(pan.current.pointerId); pan.current = null }
    if (!draft) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (draft.points.length > 1) onAddDrawing?.(draft)
    setDraft(null)
  }
  const wheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect(), clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2, anchor = clamp((clientX - rect.left) / Math.max(rect.width, 1), 0, 1)
    zoom(visibleCount * (event.deltaY > 0 ? 1.2 : .82), anchor)
  }
  const keyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(visibleCount * .82); return }
    if (event.key === '-') { event.preventDefault(); zoom(visibleCount * 1.2); return }
    if (event.key === '0') { event.preventDefault(); resetView(); return }
    if (event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault(); const delta = event.key === 'ArrowLeft' ? -Math.max(1, Math.round(visibleCount / 8)) : Math.max(1, Math.round(visibleCount / 8))
      setViewport(current => ({ ...current, start: clamp(current.start + delta, 0, Math.max(0, total - visibleCount)) })); return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setIndex(value => clamp(value + (event.key === 'ArrowLeft' ? -1 : 1), 0, total - 1)) }
  }
  const drawingShape = (drawing: Drawing) => {
    const points = drawing.points.map(value => ({ x: left + value.x * width, y: top + value.y * priceHeight }))
    const selected = selectedDrawingId === drawing.id, color = selected ? '#f8fafc' : '#94a3b8', strokeWidth = selected ? 2 : 1.5
    const select = (event: ReactPointerEvent<SVGElement>) => { event.stopPropagation(); onSelectDrawing?.(drawing.id) }
    if (drawing.type === 'horizontal') return <g key={drawing.id} data-drawing-type="horizontal" onPointerDown={select} className="cursor-pointer"><line x1={left} x2={left + width} y1={points[0].y} y2={points[0].y} stroke={color} strokeWidth={strokeWidth} strokeDasharray="5 4" /><circle cx={points[0].x} cy={points[0].y} r={selected ? 4 : 2.5} fill={color} /></g>
    if (drawing.type === 'vertical') return <g key={drawing.id} data-drawing-type="vertical" onPointerDown={select} className="cursor-pointer"><line x1={points[0].x} x2={points[0].x} y1={top} y2={chartBottom} stroke={color} strokeWidth={strokeWidth} strokeDasharray="5 4" /><circle cx={points[0].x} cy={points[0].y} r={selected ? 4 : 2.5} fill={color} /></g>
    if (drawing.type === 'text') return <g key={drawing.id} data-drawing-type="text" onPointerDown={select} className="cursor-pointer"><circle cx={points[0].x} cy={points[0].y} r="3" fill={color} /><text x={points[0].x + 7} y={points[0].y - 6} fill={color} fontSize="12" fontWeight="600">{drawing.text || 'Note'}</text></g>
    if (drawing.type === 'brush') return <polyline key={drawing.id} data-drawing-type="brush" onPointerDown={select} className="cursor-pointer" points={points.map(value => `${value.x},${value.y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeWidth + .5} strokeLinecap="round" strokeLinejoin="round" />
    const [start, end = start] = points
    if (drawing.type === 'rectangle') return <g key={drawing.id} data-drawing-type="rectangle" onPointerDown={select} className="cursor-pointer"><rect x={Math.min(start.x, end.x)} y={Math.min(start.y, end.y)} width={Math.abs(end.x - start.x)} height={Math.abs(end.y - start.y)} fill="#94a3b8" fillOpacity=".1" stroke={color} strokeWidth={strokeWidth}/>{selected && <><circle cx={start.x} cy={start.y} r="4" fill={color}/><circle cx={end.x} cy={end.y} r="4" fill={color}/></>}</g>
    const rayEnd = drawing.type === 'ray' ? (() => { const dx = end.x - start.x, dy = end.y - start.y; if (Math.abs(dx) < 1) return { x: start.x, y: dy >= 0 ? chartBottom : top }; const targetX = dx >= 0 ? left + width : left; const scale = (targetX - start.x) / dx; return { x: targetX, y: start.y + dy * scale } })() : end
    return <g key={drawing.id} data-drawing-type={drawing.type} onPointerDown={select} className="cursor-pointer"><line x1={start.x} y1={start.y} x2={rayEnd.x} y2={rayEnd.y} stroke={color} strokeWidth={strokeWidth} strokeDasharray={drawing.type === 'ruler' ? '4 3' : undefined} markerEnd={drawing.type === 'arrow' ? 'url(#quant-arrow)' : undefined} />{selected && <><circle cx={start.x} cy={start.y} r="4" fill={color} /><circle cx={end.x} cy={end.y} r="4" fill={color} /></>}{drawing.type === 'ruler' && <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 7} textAnchor="middle" fill={color} fontSize="11">{`${Math.abs((end.y - start.y) * 100).toFixed(1)}% · ${Math.round(Math.abs(end.x - start.x) * visibleCount)} bars`}</text>}</g>
  }
  const linePoints = visibleItems.map((candle, i) => `${x(i)},${y(Number(candle.close))}`).join(' ')
  const areaPath = `${linePoints.split(' ').map((value, i) => `${i ? 'L' : 'M'}${value}`).join(' ')} L${x(visibleCount - 1)},${chartBottom} L${x(0)},${chartBottom} Z`
  const lastClose = Number(visibleItems[visibleCount - 1].close)
  const crossPrice = crosshair ? upper - crosshair.y * (upper - lower) : null
  const crossIndex = crosshair ? clamp(Math.floor(crosshair.x * visibleCount), 0, visibleCount - 1) : null

  return <div className="flex shrink-0 flex-col gap-2">
    <div className="relative">
      {indicators.length > 0 && <div aria-label="Active indicators" className="pointer-events-auto absolute left-4 top-9 z-10 flex max-w-[calc(100%-6rem)] flex-col gap-0.5 rounded-md bg-[#080a0d]/80 p-1 backdrop-blur-sm">{indicators.map(indicator => <div key={indicator.id} className="flex h-6 items-center gap-1.5 px-1 text-[10px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: indicator.color }}/><span className={`w-16 font-mono font-semibold uppercase ${indicator.visible ? 'text-slate-300' : 'text-slate-600'}`}>{indicator.type} {indicator.period}</span><button type="button" aria-label={`${indicator.visible ? 'Hide' : 'Show'} ${indicator.type.toUpperCase()} ${indicator.period}`} title={indicator.visible ? 'Hide indicator' : 'Show indicator'} onClick={() => onToggleIndicator?.(indicator.id)} className="grid h-5 w-5 place-items-center rounded text-slate-600 hover:bg-slate-800 hover:text-slate-200"><Icon name={indicator.visible ? 'eye' : 'eyeOff'} className="h-3 w-3"/></button><button type="button" aria-label={`Remove ${indicator.type.toUpperCase()} ${indicator.period}`} title="Remove indicator" onClick={() => onRemoveIndicator?.(indicator.id)} className="grid h-5 w-5 place-items-center rounded text-slate-600 hover:bg-slate-800 hover:text-red-300"><Icon name="close" className="h-3 w-3"/></button></div>)}</div>}
      <svg ref={svg} viewBox={`0 0 ${viewWidth} ${totalHeight}`} style={{ background: settings.background, touchAction: 'none' }} className={`h-[340px] w-full shrink-0 border border-slate-800 outline-none focus-visible:border-slate-600 sm:h-[52vh] sm:min-h-[360px] sm:max-h-[520px] ${activeTool === 'cursor' ? 'cursor-crosshair' : 'cursor-cell'}`} role="img" tabIndex={0} aria-label={`${page.dataset.symbol} ${frozen ? 'frozen backtest' : 'imported'} ${settings.chartType === 'candles' ? 'candlesticks' : settings.chartType}, ${visibleCount} candles in ${settings.timezone} (${visibleCount} of ${total} loaded). Wheel to zoom, drag to pan.`}
        onWheel={wheel} onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerLeave={() => { setCrosshair(null); pan.current = null }} onPointerCancel={() => { setDraft(null); pan.current = null }}>
        <defs><linearGradient id="quant-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#94a3b8" stopOpacity=".28"/><stop offset="1" stopColor="#94a3b8" stopOpacity=".02"/></linearGradient><marker id="quant-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 8 4 0 8Z" fill="#94a3b8"/></marker></defs>
        <rect x="0" y="0" width={viewWidth} height={totalHeight} fill={settings.background} />
        {settings.showGrid && Array.from({ length: 5 }, (_, i) => { const price = upper - (upper - lower) * i / 4, screenY = y(price); return <g key={i}><line x1={left} x2={left + width} y1={screenY} y2={screenY} stroke={settings.gridColor} /><text x={left + width + 8} y={screenY + 4} fill="#737b88" fontSize="10" fontFamily="monospace">{format(price)}</text></g> })}
        {settings.showGrid && Array.from({ length: 6 }, (_, i) => <line key={`v-${i}`} x1={left + width * i / 5} x2={left + width * i / 5} y1={top} y2={chartBottom} stroke={settings.gridColor} opacity=".55" />)}
        {settings.showVolume && (() => { const maximum = Math.max(...visibleItems.map(item => Number(item.volume)), 1); return visibleItems.map((candle, i) => { const value = Number(candle.volume), height = value / maximum * Math.min(42, priceHeight * .18); return <rect key={`volume-${candle.ordinal}`} x={x(i) - bodyWidth / 2} y={chartBottom - height} width={Math.max(1, bodyWidth)} height={height} fill={Number(candle.close) >= Number(candle.open) ? settings.bullColor : settings.bearColor} opacity=".16" /> }) })()}
        {settings.chartType === 'area' && <path d={areaPath} fill="url(#quant-area)" stroke="#cbd5e1" strokeWidth="1.5" />}
        {settings.chartType === 'line' && <polyline points={linePoints} fill="none" stroke="#cbd5e1" strokeWidth="1.7" />}
        {(settings.chartType === 'candles' || settings.chartType === 'bars') && visibleItems.map((candle, i) => {
          const open = Number(candle.open), close = Number(candle.close), color = close >= open ? settings.bullColor : settings.bearColor
          if (settings.chartType === 'bars') return <g key={candle.ordinal}><line x1={x(i)} x2={x(i)} y1={y(Number(candle.high))} y2={y(Number(candle.low))} stroke={color} strokeWidth="1.2"/><line x1={x(i) - bodyWidth / 2} x2={x(i)} y1={y(open)} y2={y(open)} stroke={color}/><line x1={x(i)} x2={x(i) + bodyWidth / 2} y1={y(close)} y2={y(close)} stroke={color}/></g>
          return <g key={candle.ordinal}>{settings.candleWicks && <line x1={x(i)} x2={x(i)} y1={y(Number(candle.high))} y2={y(Number(candle.low))} stroke={color} strokeWidth="1" />}<rect x={x(i) - bodyWidth / 2} y={Math.min(y(open), y(close))} width={bodyWidth} height={Math.max(1, Math.abs(y(open) - y(close)))} fill={color} stroke={settings.candleBorders ? settings.background : color} strokeWidth={settings.candleBorders ? .6 : 0} /></g>
        })}
        {visibleIndicators.filter(item => item.type !== 'rsi').map(indicator => <polyline key={indicator.id} points={indicator.values.map((value, i) => value === null ? null : `${x(i)},${y(value)}`).filter(Boolean).join(' ')} fill="none" stroke={indicator.color} strokeWidth="1.5"><title>{`${indicator.type.toUpperCase()} ${indicator.period}`}</title></polyline>)}
        {(settings.showPriceLine || settings.showLastValue) && <g>{settings.showPriceLine && <line x1={left} x2={left + width} y1={y(lastClose)} y2={y(lastClose)} stroke="#94a3b8" strokeDasharray="3 3" opacity=".7"/>}{settings.showLastValue && <><rect x={left + width + 3} y={y(lastClose) - 8} width={right - 8} height="16" rx="2" fill="#475569"/><text x={left + width + 7} y={y(lastClose) + 4} fill="#f8fafc" fontSize="10" fontFamily="monospace">{format(lastClose)}</text></>}</g>}
        {markers.filter(marker => marker.barIndex >= visibleItems[0].ordinal && marker.barIndex <= visibleItems[visibleCount - 1].ordinal).map(marker => { const at = Math.max(0, visibleItems.findIndex(item => item.ordinal >= marker.barIndex)), color = marker.kind === 'ENTRY' ? '#22c55e' : marker.kind === 'EXIT' ? '#ef4444' : '#eab308'; return <circle key={marker.id} cx={x(at)} cy={top + 12} r="4" fill={color}><title>{`${marker.kind} · bar ${marker.barIndex} · event ${marker.id}`}</title></circle> })}
        {(drawings.concat(draft ? [draft] : [])).map(drawingShape)}
        {settings.showSymbol && <text x={left + 4} y="18" fill="#e5e7eb" fontSize="11" fontWeight="600">{page.dataset.symbol} · {zoneLabel}</text>}
        {settings.showOhlc && viewWidth >= 520 && <text x={left + 132} y="18" fill="#8b93a1" fontSize="10" fontFamily="monospace">O {active.open}  H {active.high}  L {active.low}  C {active.close}</text>}
        {hasRsi && <g><rect x={left} y={rsiTop} width={width} height={rsiHeight} fill="#0b0e12"/><line x1={left} x2={left + width} y1={rsiTop + rsiHeight * .3} y2={rsiTop + rsiHeight * .3} stroke={settings.gridColor} strokeDasharray="3 4"/><line x1={left} x2={left + width} y1={rsiTop + rsiHeight * .7} y2={rsiTop + rsiHeight * .7} stroke={settings.gridColor} strokeDasharray="3 4"/>{visibleIndicators.filter(item => item.type === 'rsi').map(indicator => <polyline key={indicator.id} points={indicator.values.map((value, i) => value === null ? null : `${x(i)},${rsiTop + (100 - value) / 100 * rsiHeight}`).filter(Boolean).join(' ')} fill="none" stroke={indicator.color} strokeWidth="1.4"/>)}<text x={left + 4} y={rsiTop + 12} fill="#8b93a1" fontSize="10">RSI</text><text x={left + width + 8} y={rsiTop + 5} fill="#737b88" fontSize="9">100</text><text x={left + width + 8} y={rsiTop + rsiHeight} fill="#737b88" fontSize="9">0</text></g>}
        {crosshair && activeTool === 'cursor' && <g pointerEvents="none"><line x1={left + crosshair.x * width} x2={left + crosshair.x * width} y1={top} y2={chartBottom} stroke="#7d8490" strokeDasharray="3 3" opacity=".55"/><line x1={left} x2={left + width} y1={top + crosshair.y * priceHeight} y2={top + crosshair.y * priceHeight} stroke="#7d8490" strokeDasharray="3 3" opacity=".55"/><rect x={left + width + 3} y={top + crosshair.y * priceHeight - 8} width={right - 8} height="16" rx="2" fill="#262b32"/><text x={left + width + 7} y={top + crosshair.y * priceHeight + 4} fill="#d7dbe0" fontSize="10" fontFamily="monospace">{format(crossPrice!)}</text><text x={left + crosshair.x * width} y={chartBottom + 14} textAnchor="middle" fill="#8b93a1" fontSize="9">{formatTime(visibleItems[crossIndex!].time)}</text></g>}
        <text x={left} y={totalHeight - 5} fill="#737b88" fontSize="10">{formatTime(visibleItems[0].time)}</text><text x={left + width} y={totalHeight - 5} fill="#737b88" fontSize="10" textAnchor="end">{formatTime(visibleItems[visibleCount - 1].time)}</text>
      </svg>
      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950/85 p-0.5 text-[9px] text-slate-500"><span className="px-1.5">{visibleStart + 1}–{visibleStart + visibleCount} / {total}</span><button type="button" aria-label="Reset chart view" title="Reset zoom and pan" onClick={resetView} disabled={visibleStart === 0 && visibleCount === total} className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-35"><Icon name="reset" className="h-3.5 w-3.5"/></button></div>
    </div>
    <div className="flex flex-wrap items-center gap-2"><button className="h-8 rounded-md border border-slate-800 bg-slate-900 px-2 text-[11px] font-medium text-slate-400 hover:text-white disabled:opacity-35" disabled={index <= 0} onClick={() => setIndex(i => i - 1)}>Previous candle</button><label className="flex min-w-24 flex-1 items-center gap-2 text-[10px] text-slate-500">Inspect candle<input aria-label="Candle index" aria-valuetext={active.time} className="min-w-16 flex-1" type="range" min={0} max={total - 1} value={index} onChange={event => setIndex(Number(event.target.value))} onKeyDown={event => { const target = event.key === 'Home' ? 0 : event.key === 'End' ? total - 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? index - 1 : ['ArrowRight', 'ArrowUp'].includes(event.key) ? index + 1 : null; if (target === null) return; event.preventDefault(); setIndex(clamp(target, 0, total - 1)) }} /></label><button className="h-8 rounded-md border border-slate-800 bg-slate-900 px-2 text-[11px] font-medium text-slate-400 hover:text-white disabled:opacity-35" disabled={index >= total - 1} onClick={() => setIndex(i => i + 1)}>Next candle</button></div>
    <dl aria-label="Selected candle values" className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-800 pt-2 font-mono text-[11px] sm:grid-cols-3"><div className="col-span-2 sm:col-span-3"><dt className="text-slate-600">Candle open · UTC</dt><dd className="text-slate-300">{active.time}</dd></div>{(['open', 'high', 'low', 'close', 'volume'] as const).map(field => <div key={field}><dt className="capitalize text-slate-600">{field}</dt><dd className="break-all text-slate-300">{active[field]}</dd></div>)}</dl>
  </div>
}
