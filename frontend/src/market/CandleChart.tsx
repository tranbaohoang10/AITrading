import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { Icon } from '../components/Icon'
import type { Candle } from './api'
import { ema, rsi, sma } from './chartMath'
import { defaultChartSettings, drawingLabels, type ChartPoint, type ChartSettings, type Drawing, type DrawingTool, type IndicatorConfig, type MagnetMode } from './chartTypes'

type Marker = { id: number; barIndex: number; kind: string }
type Viewport = { start: number; count: number }
type PriceRange = { lower: number; upper: number }
type ScreenPoint = { x: number; y: number }
type PanState = { pointerId: number; x: number; y: number; viewport: Viewport; prices: PriceRange }
type EditState = { pointerId: number; drawing: Drawing; point: ChartPoint; handle: number | 'move'; last: Drawing }

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const minimumBars = (total: number) => Math.min(8, total)
const multiPointTools = new Set<DrawingTool>(['parallelChannel', 'fibExtension', 'polyline', 'longPosition', 'shortPosition'])
const singlePointTools = new Set<DrawingTool>(['horizontal', 'horizontalRay', 'vertical', 'cross', 'text', 'note', 'callout'])
const editableTarget = (target: EventTarget | null) => target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)

export function CandleChart({ page, markers = [], frozen = false, settings = defaultChartSettings, indicators = [], activeTool = 'cursor', drawings = [], selectedDrawingId, magnet = 'off', stayInMode = false, onAddDrawing, onUpdateDrawing, onCommitDrawingEdit, onSelectDrawing, onDeleteSelected, onUndo, onRedo, onCancelTool, onToggleIndicator, onRemoveIndicator }: {
  page: { dataset: { symbol: string }; items: Candle[] }
  markers?: Marker[]; frozen?: boolean; settings?: ChartSettings; indicators?: IndicatorConfig[]
  activeTool?: DrawingTool; drawings?: Drawing[]; selectedDrawingId?: string | null; magnet?: MagnetMode; stayInMode?: boolean
  onAddDrawing?: (drawing: Drawing) => void; onUpdateDrawing?: (drawing: Drawing) => void; onCommitDrawingEdit?: (before: Drawing, after: Drawing) => void
  onSelectDrawing?: (id: string | null) => void; onDeleteSelected?: () => void; onUndo?: () => void; onRedo?: () => void; onCancelTool?: () => void
  onToggleIndicator?: (id: string) => void; onRemoveIndicator?: (id: string) => void
}) {
  const total = page.items.length
  const [index, setIndex] = useState(Math.max(0, total - 1))
  const [crosshair, setCrosshair] = useState<ScreenPoint | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ start: 0, count: total })
  const [manualPrices, setManualPrices] = useState<PriceRange | null>(null)
  const [draft, setDraft] = useState<Drawing | null>(null)
  const [rsiHeight, setRsiHeight] = useState(92)
  const [viewWidth, setViewWidth] = useState(900)
  const svg = useRef<SVGSVGElement>(null)
  const pan = useRef<PanState | null>(null), edit = useRef<EditState | null>(null)
  const multi = useRef<{ drawing: Drawing; fixed: number } | null>(null)
  const wheelQueue = useRef<{ delta: number; anchor: number }>({ delta: 0, anchor: .5 })
  const wheelFrame = useRef<number | null>(null), panFrame = useRef<number | null>(null)
  const completedOnPointerDown = useRef(false)

  useEffect(() => {
    if (!svg.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => { const width = entries[0]?.contentRect.width; if (width) setViewWidth(Math.max(240, width)) })
    observer.observe(svg.current); return () => observer.disconnect()
  }, [])
  useEffect(() => {
    setIndex(value => clamp(value, 0, Math.max(0, total - 1)))
    setViewport(value => ({ count: clamp(value.count || total, minimumBars(total), total), start: clamp(value.start, 0, Math.max(0, total - clamp(value.count || total, minimumBars(total), total))) }))
    setManualPrices(null); setDraft(null); multi.current = null
  }, [total, page.dataset.symbol])
  useEffect(() => { setDraft(null); multi.current = null; completedOnPointerDown.current = false }, [activeTool])
  useEffect(() => () => { if (wheelFrame.current) cancelAnimationFrame(wheelFrame.current); if (panFrame.current) cancelAnimationFrame(panFrame.current) }, [])

  const visibleStart = clamp(viewport.start, 0, Math.max(0, total - viewport.count))
  const visibleCount = clamp(viewport.count, minimumBars(total), total)
  const renderStart = clamp(Math.floor(visibleStart), 0, Math.max(0, total - 1))
  const renderEnd = clamp(Math.ceil(visibleStart + visibleCount), renderStart + 1, total)
  const visibleItems = page.items.slice(renderStart, renderEnd)
  const values = useMemo(() => page.items.map(candle => Number(candle.close)), [page.items])
  const computedIndicators = useMemo(() => indicators.map(indicator => ({ ...indicator, values: indicator.type === 'sma' ? sma(values, indicator.period) : indicator.type === 'ema' ? ema(values, indicator.period) : rsi(values, indicator.period) })), [indicators, values])
  const visibleIndicators = computedIndicators.filter(indicator => indicator.visible)
  if (!visibleItems.length) return <p className="p-6 text-sm text-slate-400">No candles in this window. Choose an earlier window.</p>

  const autoPrices = (() => {
    const lows = visibleItems.map(candle => Number(candle.low)), highs = visibleItems.map(candle => Number(candle.high))
    const minimum = Math.min(...lows), maximum = Math.max(...highs), padding = Math.max((maximum - minimum) * .08, Math.abs(maximum) * .001, 1e-8)
    return { lower: minimum - padding, upper: maximum + padding }
  })()
  const prices = manualPrices ?? autoPrices
  const priceSpan = Math.max(prices.upper - prices.lower, 1e-12)
  const left = 12, right = 78, width = Math.max(80, viewWidth - left - right), top = 42, totalHeight = 420
  const hasRsi = visibleIndicators.some(indicator => indicator.type === 'rsi')
  const axisBottom = totalHeight - 22, paneGap = hasRsi ? 18 : 0
  const boundedRsi = hasRsi ? clamp(rsiHeight, 64, 180) : 0
  const priceHeight = Math.max(145, axisBottom - top - boundedRsi - paneGap), chartBottom = top + priceHeight
  const rsiTop = chartBottom + paneGap, rsiBottom = rsiTop + boundedRsi
  const itemIndex = new Map(page.items.map((candle, position) => [candle.time, position]))
  const timeIndex = (time: string) => {
    const exact = itemIndex.get(time); if (exact !== undefined) return exact
    const target = Date.parse(time); let low = 0, high = total - 1
    while (low < high) { const middle = Math.floor((low + high) / 2); if (Date.parse(page.items[middle].time) < target) low = middle + 1; else high = middle }
    if (low > 0 && Math.abs(Date.parse(page.items[low - 1].time) - target) < Math.abs(Date.parse(page.items[low].time) - target)) return low - 1
    return low
  }
  const xIndex = (position: number) => left + (position + .5 - visibleStart) / visibleCount * width
  const timeTicks = useMemo(() => {
    const ticks: { time: string, label: string }[] = []
    if (visibleItems.length < 2) return ticks
    const count = 5
    for (let i = 0; i <= count; i++) {
      const idx = Math.floor(i * (visibleItems.length - 1) / count)
      const item = visibleItems[idx]
      if (item) {
        ticks.push({ 
          time: item.time,
          label: new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(item.time)).replace(',', '')
        })
      }
    }
    return Array.from(new Map(ticks.map(t => [t.time, t])).values())
  }, [visibleItems, settings.timezone])
  const xTime = (time: string) => xIndex(timeIndex(time))
  const yPrice = (value: number) => top + (prices.upper - value) / priceSpan * priceHeight
  const format = (value: number) => Math.abs(value) >= 1e8 || (value !== 0 && Math.abs(value) < 1e-3) ? value.toExponential(3) : Number(value.toPrecision(7)).toString()
  const formatTime = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)).replace(',', '')
  const zoneLabel = settings.timezone === 'Asia/Ho_Chi_Minh' ? 'ICT' : settings.timezone === 'America/New_York' ? 'New York' : settings.timezone === 'Europe/London' ? 'London' : 'UTC'
  const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `drawing-${Date.now()}`
  const selectedCandle = page.items[clamp(index, 0, total - 1)]

  const chartPoint = (event: ReactPointerEvent<SVGSVGElement>): ChartPoint => {
    const rect = event.currentTarget.getBoundingClientRect(), clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2, clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2
    const px = (clientX - rect.left) / Math.max(rect.width, 1) * viewWidth, py = (clientY - rect.top) / Math.max(rect.height, 1) * totalHeight
    const position = clamp(Math.round(visibleStart + (px - left) / width * visibleCount - .5), 0, total - 1)
    let price = prices.upper - (py - top) / Math.max(priceHeight, 1) * priceSpan
    if (magnet !== 'off') {
      const candle = page.items[position], candidates = [candle.open, candle.high, candle.low, candle.close].map(Number), nearest = candidates.reduce((best, value) => Math.abs(value - price) < Math.abs(best - price) ? value : best, candidates[0])
      const threshold = priceSpan * (magnet === 'strong' ? .06 : .018); if (Math.abs(nearest - price) <= threshold) price = nearest
    }
    return { time: page.items[position].time, price }
  }
  const screenPoint = (event: ReactPointerEvent<SVGSVGElement>): ScreenPoint => {
    const rect = event.currentTarget.getBoundingClientRect(), clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2, clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2
    const px = (clientX - rect.left) / Math.max(rect.width, 1) * viewWidth, py = (clientY - rect.top) / Math.max(rect.height, 1) * totalHeight
    return { x: clamp(px, left, left + width), y: clamp(py, top, chartBottom) }
  }
  const updateInspected = (point: ScreenPoint) => setIndex(clamp(Math.floor(visibleStart + (point.x - left) / width * visibleCount), 0, total - 1))
  const resetView = () => { setViewport({ start: 0, count: total }); setManualPrices(null); setIndex(total - 1) }
  const schedulePan = (nextViewport: Viewport, nextPrices: PriceRange) => {
    if (panFrame.current) cancelAnimationFrame(panFrame.current)
    panFrame.current = requestAnimationFrame(() => { setViewport(nextViewport); setManualPrices(nextPrices); panFrame.current = null })
  }
  const completeDrawing = (drawing: Drawing) => { onAddDrawing?.(drawing); setDraft(null); multi.current = null; if (!stayInMode) onCancelTool?.() }

  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    event.currentTarget.focus(); const screen = screenPoint(event), point = chartPoint(event); setCrosshair(screen); updateInspected(screen)
    if (activeTool === 'cursor') {
      onSelectDrawing?.(null); pan.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, viewport: { start: visibleStart, count: visibleCount }, prices }
      event.currentTarget.setPointerCapture?.(event.pointerId); event.preventDefault(); return
    }
    if (singlePointTools.has(activeTool)) {
      const label = activeTool === 'text' ? 'Text' : activeTool === 'note' ? 'Note' : activeTool === 'callout' ? 'Callout' : undefined
      completeDrawing({ id: id(), type: activeTool as Drawing['type'], points: [point], ...(label ? { text: label } : {}) }); return
    }
    if (multiPointTools.has(activeTool)) {
      if (!multi.current) { const drawing = { id: id(), type: activeTool as Drawing['type'], points: [point, point] }; multi.current = { drawing, fixed: 1 }; setDraft(drawing); return }
      if (multi.current.fixed === 1) { const drawing = { ...multi.current.drawing, points: [multi.current.drawing.points[0], point, point] }; multi.current = { drawing, fixed: 2 }; setDraft(drawing); return }
      completeDrawing({ ...multi.current.drawing, points: [multi.current.drawing.points[0], multi.current.drawing.points[1], point] }); return
    }
    if (draft && draft.type !== 'brush') { completedOnPointerDown.current = true; completeDrawing({ ...draft, points: [draft.points[0], point] }); return }
    const drawing = { id: id(), type: activeTool as Drawing['type'], points: [point, point] }
    setDraft(drawing); event.currentTarget.setPointerCapture?.(event.pointerId); event.preventDefault()
  }
  const pointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const screen = screenPoint(event), point = chartPoint(event); setCrosshair(screen)
    if (edit.current) {
      const current = edit.current, deltaIndex = timeIndex(point.time) - timeIndex(current.point.time), deltaPrice = point.price - current.point.price
      const points = current.handle === 'move' ? current.drawing.points.map(anchor => ({ time: page.items[clamp(timeIndex(anchor.time) + deltaIndex, 0, total - 1)].time, price: anchor.price + deltaPrice })) : current.drawing.points.map((anchor, position) => position === current.handle ? point : anchor)
      const next = { ...current.drawing, points }; current.last = next; onUpdateDrawing?.(next); return
    }
    if (pan.current && activeTool === 'cursor') {
      const dx = event.clientX - pan.current.x, dy = event.clientY - pan.current.y
      const start = clamp(pan.current.viewport.start - dx / Math.max(width, 1) * pan.current.viewport.count, 0, Math.max(0, total - pan.current.viewport.count))
      const priceDelta = dy / Math.max(priceHeight, 1) * (pan.current.prices.upper - pan.current.prices.lower)
      schedulePan({ start, count: pan.current.viewport.count }, { lower: pan.current.prices.lower + priceDelta, upper: pan.current.prices.upper + priceDelta }); return
    }
    if (activeTool === 'cursor') updateInspected(screen)
    if (multi.current) { const points = [...multi.current.drawing.points]; points[points.length - 1] = point; const drawing = { ...multi.current.drawing, points }; multi.current.drawing = drawing; setDraft(drawing); return }
    if (!draft) return
    setDraft(current => !current ? current : current.type === 'brush' ? { ...current, points: [...current.points, point] } : { ...current, points: [current.points[0], point] })
  }
  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (completedOnPointerDown.current) { completedOnPointerDown.current = false; return }
    if (edit.current) { const current = edit.current; onCommitDrawingEdit?.(current.drawing, current.last); edit.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); return }
    if (pan.current) { event.currentTarget.releasePointerCapture?.(pan.current.pointerId); pan.current = null; return }
    if (!draft || multi.current) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (draft.points.length > 1 && (draft.points.length > 2 || draft.points[0].time !== draft.points[1].time || draft.points[0].price !== draft.points[1].price)) completeDrawing(draft)
    else if (draft.type === 'brush') setDraft(null)
  }
  const wheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(), anchor = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1)
    const mode = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1
    wheelQueue.current.delta += clamp(event.deltaY * mode, -120, 120); wheelQueue.current.anchor = anchor
    if (wheelFrame.current) return
    wheelFrame.current = requestAnimationFrame(() => {
      const queued = wheelQueue.current; wheelQueue.current = { delta: 0, anchor: queued.anchor }; wheelFrame.current = null
      setViewport(current => {
        const count = clamp(current.count * Math.exp(clamp(queued.delta, -240, 240) * .0015), minimumBars(total), total)
        const anchorIndex = current.start + queued.anchor * current.count
        return { count, start: clamp(anchorIndex - queued.anchor * count, 0, Math.max(0, total - count)) }
      })
    })
  }
  const cancelDraft = () => { setDraft(null); multi.current = null; onCancelTool?.() }
  const keyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (editableTarget(event.target)) return
    const modifier = event.ctrlKey || event.metaKey
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedDrawingId) { event.preventDefault(); onDeleteSelected?.(); return }
    if (event.key === 'Escape') { event.preventDefault(); cancelDraft(); onSelectDrawing?.(null); return }
    if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) onRedo?.(); else onUndo?.(); return }
    if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); onRedo?.(); return }
    if (event.key === '0') { event.preventDefault(); resetView(); return }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setViewport(current => ({ count: clamp(current.count * .9, minimumBars(total), total), start: clamp(current.start + current.count * .05, 0, total) })); return }
    if (event.key === '-') { event.preventDefault(); setViewport(current => ({ count: clamp(current.count * 1.1, minimumBars(total), total), start: clamp(current.start - current.count * .05, 0, total) })); return }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setIndex(value => clamp(value + (event.key === 'ArrowLeft' ? -1 : 1), 0, total - 1)) }
  }

  const beginEdit = (event: ReactPointerEvent<SVGElement>, drawing: Drawing, handle: number | 'move') => {
    if (activeTool !== 'cursor' || drawing.locked) return
    event.stopPropagation(); const owner = event.currentTarget.ownerSVGElement; if (!owner) return
    const rect = owner.getBoundingClientRect(), synthetic = { ...event, currentTarget: owner, clientX: event.clientX || rect.left, clientY: event.clientY || rect.top } as unknown as ReactPointerEvent<SVGSVGElement>
    const point = chartPoint(synthetic); edit.current = { pointerId: event.pointerId, drawing, point, handle, last: drawing }; onSelectDrawing?.(drawing.id); owner.setPointerCapture?.(event.pointerId)
  }
  const projected = (drawing: Drawing) => drawing.points.map(point => ({ x: xTime(point.time), y: yPrice(point.price) }))
  const handles = (drawing: Drawing, points: ScreenPoint[]) => selectedDrawingId === drawing.id && activeTool === 'cursor' ? points.map((point, position) => <circle key={`handle-${position}`} data-drawing-handle={position} cx={point.x} cy={point.y} r="5" fill="#f4f5f7" stroke="#20242b" strokeWidth="2" className="cursor-grab" onPointerDown={event => beginEdit(event, drawing, position)}/>) : null
  const drawingShape = (drawing: Drawing) => {
    if (drawing.visible === false) return null
    const points = projected(drawing), selected = selectedDrawingId === drawing.id, color = selected ? '#f4f5f7' : '#9aa1ad', strokeWidth = selected ? 2 : 1.4
    const select = (event: ReactPointerEvent<SVGElement>) => beginEdit(event, drawing, 'move')
    const wrap = (content: React.ReactNode) => <g key={drawing.id} data-drawing-type={drawing.type} data-drawing-anchor="time-price" onPointerDown={select} className={drawing.locked ? 'cursor-not-allowed' : 'cursor-move'}>{content}{handles(drawing, points)}</g>
    const [a, b = a, c = b] = points
    if (drawing.type === 'horizontal' || drawing.type === 'cross') return wrap(<><line x1={left} x2={left + width} y1={a.y} y2={a.y} stroke={color} strokeWidth={strokeWidth} strokeDasharray="5 4"/>{drawing.type === 'cross' && <line x1={a.x} x2={a.x} y1={top} y2={chartBottom} stroke={color} strokeWidth={strokeWidth} strokeDasharray="5 4"/>}</>)
    if (drawing.type === 'horizontalRay') return wrap(<line x1={a.x} x2={left + width} y1={a.y} y2={a.y} stroke={color} strokeWidth={strokeWidth} strokeDasharray="5 4"/>)
    if (drawing.type === 'vertical') return wrap(<line x1={a.x} x2={a.x} y1={top} y2={chartBottom} stroke={color} strokeWidth={strokeWidth} strokeDasharray="5 4"/>)
    if (drawing.type === 'text' || drawing.type === 'note' || drawing.type === 'callout') return wrap(<><circle cx={a.x} cy={a.y} r="3" fill={color}/>{drawing.type === 'callout' && <line x1={a.x} y1={a.y} x2={a.x + 20} y2={a.y - 18} stroke={color}/>}<rect x={a.x + 7} y={a.y - 25} width={Math.max(44, (drawing.text?.length ?? 4) * 7)} height="22" rx="4" fill="#20242b" stroke="#3a404a"/><text x={a.x + 13} y={a.y - 10} fill={settings.textColor} fontSize="11">{drawing.text || drawingLabels[drawing.type]}</text></>)
    if (drawing.type === 'brush' || drawing.type === 'polyline') return wrap(<polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={color} strokeWidth={drawing.type === 'brush' ? 2.2 : strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>)
    if (drawing.type === 'rectangle') return wrap(<rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="#94a3b8" fillOpacity=".1" stroke={color} strokeWidth={strokeWidth}/>)
    if (drawing.type === 'ellipse') return wrap(<ellipse cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} rx={Math.abs(b.x - a.x) / 2} ry={Math.abs(b.y - a.y) / 2} fill="#94a3b8" fillOpacity=".08" stroke={color} strokeWidth={strokeWidth}/>)
    if (drawing.type === 'parallelChannel') { const dx = b.x - a.x, dy = b.y - a.y; return wrap(<><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={strokeWidth}/><line x1={c.x} y1={c.y} x2={c.x + dx} y2={c.y + dy} stroke={color} strokeWidth={strokeWidth}/><polygon points={`${a.x},${a.y} ${b.x},${b.y} ${c.x + dx},${c.y + dy} ${c.x},${c.y}`} fill="#94a3b8" fillOpacity=".07"/></>) }
    if (drawing.type === 'fibRetracement' || drawing.type === 'fibExtension') {
      const levels = [0, .236, .382, .5, .618, .786, 1], origin = drawing.type === 'fibExtension' ? c : a, delta = b.y - a.y, startX = Math.min(a.x, drawing.type === 'fibExtension' ? c.x : b.x), endX = Math.max(b.x, drawing.type === 'fibExtension' ? c.x + Math.abs(b.x - a.x) : a.x)
      return wrap(<>{levels.map(level => { const screenY = origin.y + delta * level; return <g key={level}><line x1={startX} x2={endX} y1={screenY} y2={screenY} stroke={level === .618 ? '#d7a44a' : color} strokeWidth={level === .618 ? 1.5 : 1} opacity=".9"/><text x={endX + 4} y={screenY + 3} fill="#8e96a3" fontSize="9">{level}</text></g> })}</>)
    }
    if (['ruler', 'priceRange', 'dateRange', 'datePriceRange'].includes(drawing.type)) {
      const bars = Math.abs(timeIndex(drawing.points[1].time) - timeIndex(drawing.points[0].time)), priceDelta = drawing.points[1].price - drawing.points[0].price, percent = drawing.points[0].price === 0 ? 0 : priceDelta / drawing.points[0].price * 100
      const label = drawing.type === 'priceRange' ? `${format(priceDelta)} · ${percent.toFixed(2)}%` : drawing.type === 'dateRange' ? `${bars} bars` : `${bars} bars · ${format(priceDelta)} · ${percent.toFixed(2)}%`
      return wrap(<><rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="#6b7c93" fillOpacity=".09" stroke={color} strokeDasharray="4 3"/><text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 7} textAnchor="middle" fill={color} fontSize="10">{label}</text></>)
    }
    if (drawing.type === 'longPosition' || drawing.type === 'shortPosition') {
      const entry = drawing.points[0].price, stop = drawing.points[1].price, target = drawing.points[2].price, long = drawing.type === 'longPosition', valid = long ? target > entry && entry > stop : stop > entry && entry > target
      const risk = Math.abs(entry - stop), reward = Math.abs(target - entry), ratio = risk > 0 ? reward / risk : 0, riskPercent = entry ? risk / Math.abs(entry) * 100 : 0, rewardPercent = entry ? reward / Math.abs(entry) * 100 : 0
      const x1 = Math.min(a.x, b.x, c.x), x2 = Math.max(a.x, b.x, c.x, x1 + 90), entryY = yPrice(entry), stopY = yPrice(stop), targetY = yPrice(target)
      return wrap(<><rect x={x1} y={Math.min(entryY, targetY)} width={x2 - x1} height={Math.abs(targetY - entryY)} fill="#16a085" fillOpacity=".14"/><rect x={x1} y={Math.min(entryY, stopY)} width={x2 - x1} height={Math.abs(stopY - entryY)} fill="#f04452" fillOpacity=".14"/><line x1={x1} x2={x2} y1={entryY} y2={entryY} stroke={valid ? color : '#fb7185'} strokeWidth="1.5"/><text x={x1 + 6} y={entryY - 7} fill={valid ? settings.textColor : '#fb7185'} fontSize="9">{valid ? `${long ? 'LONG' : 'SHORT'} · Risk ${riskPercent.toFixed(2)}% · Reward ${rewardPercent.toFixed(2)}% · R:R ${ratio.toFixed(2)}` : 'Invalid position levels'}</text></>)
    }
    const dx = b.x - a.x, dy = b.y - a.y
    const rayEnd = drawing.type === 'ray' ? (() => { const targetX = dx >= 0 ? left + width : left, scale = Math.abs(dx) < 1 ? 1 : (targetX - a.x) / dx; return { x: targetX, y: a.y + dy * scale } })() : drawing.type === 'extended' ? (() => { const scaleA = Math.abs(dx) < 1 ? 1 : (left - a.x) / dx, scaleB = Math.abs(dx) < 1 ? 1 : (left + width - a.x) / dx; return { start: { x: left, y: a.y + dy * scaleA }, end: { x: left + width, y: a.y + dy * scaleB } } })() : null
    const start = drawing.type === 'extended' && rayEnd && 'start' in rayEnd ? rayEnd.start : a, end = drawing.type === 'extended' && rayEnd && 'end' in rayEnd ? rayEnd.end : drawing.type === 'ray' && rayEnd && 'x' in rayEnd ? rayEnd : b
    return wrap(<line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={color} strokeWidth={strokeWidth} markerEnd={drawing.type === 'arrow' ? 'url(#quant-arrow)' : undefined}/>)
  }

  const candlePosition = (local: number) => renderStart + local
  const bodyWidth = Math.max(1, Math.min(22, width / visibleCount * (.28 + settings.spacing / 150)))
  const linePoints = visibleItems.map((candle, local) => `${xIndex(candlePosition(local))},${yPrice(Number(candle.close))}`).join(' ')
  const areaPath = `${linePoints.split(' ').map((value, position) => `${position ? 'L' : 'M'}${value}`).join(' ')} L${xIndex(renderEnd - 1)},${chartBottom} L${xIndex(renderStart)},${chartBottom} Z`
  const lastClose = Number(visibleItems.at(-1)!.close), inspected = crosshair ? page.items[index] : selectedCandle
  const crossPrice = crosshair ? prices.upper - (crosshair.y - top) / priceHeight * priceSpan : null

  return <div className="flex min-h-0 shrink-0 flex-col">
    <div className="relative select-none">
      {indicators.length > 0 && <div aria-label="Active indicators" className="pointer-events-auto absolute left-4 top-10 z-20 flex max-w-[calc(100%-7rem)] flex-col gap-0.5 rounded-md bg-[#121419]/88 p-1 shadow-lg">{indicators.map(indicator => <div key={indicator.id} className="group/indicator flex h-6 items-center gap-1 px-1 text-[10px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: indicator.color }}/><span className={`w-16 font-mono font-semibold uppercase ${indicator.visible ? 'text-slate-300' : 'text-slate-600'}`}>{indicator.type} {indicator.period}</span><button type="button" aria-label={`${indicator.visible ? 'Hide' : 'Show'} ${indicator.type.toUpperCase()} ${indicator.period}`} title={indicator.visible ? 'Hide indicator' : 'Show indicator'} onClick={() => onToggleIndicator?.(indicator.id)} className="grid h-5 w-5 place-items-center rounded text-slate-600 opacity-70 hover:bg-slate-800 hover:text-slate-200 group-hover/indicator:opacity-100"><Icon name={indicator.visible ? 'eye' : 'eyeOff'} className="h-3 w-3"/></button><button type="button" aria-label={`Remove ${indicator.type.toUpperCase()} ${indicator.period}`} title="Remove indicator" onClick={() => onRemoveIndicator?.(indicator.id)} className="grid h-5 w-5 place-items-center rounded text-slate-600 opacity-70 hover:bg-slate-800 hover:text-red-300 group-hover/indicator:opacity-100"><Icon name="close" className="h-3 w-3"/></button></div>)}</div>}
      <svg ref={svg} viewBox={`0 0 ${viewWidth} ${totalHeight}`} style={{ background: settings.background, touchAction: 'none' }} className={`h-[370px] w-full shrink-0 border border-slate-800 outline-none focus-visible:border-slate-600 sm:h-[calc(100dvh-160px)] sm:min-h-[420px] sm:max-h-[920px] ${activeTool === 'cursor' ? (pan.current ? 'cursor-grabbing' : 'cursor-crosshair') : 'cursor-cell'}`} role="img" tabIndex={0} aria-label={`${page.dataset.symbol} ${frozen ? 'frozen backtest' : 'imported'} ${settings.chartType === 'candles' ? 'candlesticks' : settings.chartType}, ${Math.ceil(visibleCount)} candles in ${settings.timezone} (${renderEnd - renderStart} of ${total} loaded). Smooth wheel zoom and two-dimensional drag pan.`}
        onWheel={wheel} onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { pan.current = null; edit.current = null }} onContextMenu={event => { if (draft || multi.current) { event.preventDefault(); cancelDraft() } }} onPointerLeave={() => { if (!pan.current && !edit.current) setCrosshair(null) }}>
        <defs><linearGradient id="quant-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8590a0" stopOpacity=".24"/><stop offset="1" stopColor="#8590a0" stopOpacity=".02"/></linearGradient><marker id="quant-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 8 4 0 8Z" fill="context-stroke"/></marker></defs>
        <rect width={viewWidth} height={totalHeight} fill={settings.background}/>
        {timeTicks.map(tick => <g key={tick.time}><line x1={xTime(tick.time)} y1={top} x2={xTime(tick.time)} y2={chartBottom} stroke={settings.gridColor} strokeWidth="1" strokeDasharray="4 4" opacity="0.3"/><text x={xTime(tick.time)} y={axisBottom + 14} textAnchor="middle" fontSize="10" fill="#9ca3af">{tick.label}</text></g>)}
        {settings.showGrid && Array.from({ length: 6 }, (_, position) => <line key={`v-${position}`} x1={left + width * position / 5} x2={left + width * position / 5} y1={top} y2={chartBottom} stroke={settings.gridColor} opacity=".3"/>)}
        {settings.showVolume && (() => { const maximum = Math.max(...visibleItems.map(item => Number(item.volume)), 1); return visibleItems.map((candle, local) => { const height = Number(candle.volume) / maximum * Math.min(48, priceHeight * .18), x = xIndex(candlePosition(local)); return <rect key={`volume-${candle.ordinal}`} x={x - bodyWidth / 2} y={chartBottom - height} width={bodyWidth} height={height} fill={Number(candle.close) >= Number(candle.open) ? settings.bullColor : settings.bearColor} opacity=".18"/> }) })()}
        {settings.chartType === 'area' && <path d={areaPath} fill="url(#quant-area)" stroke="#c7cbd2" strokeWidth="1.5"/>}
        {settings.chartType === 'line' && <polyline points={linePoints} fill="none" stroke="#c7cbd2" strokeWidth="1.7"/>}
        {(settings.chartType === 'candles' || settings.chartType === 'bars') && visibleItems.map((candle, local) => { const position = candlePosition(local), x = xIndex(position), open = Number(candle.open), close = Number(candle.close), color = close >= open ? settings.bullColor : settings.bearColor; if (settings.chartType === 'bars') return <g key={candle.ordinal}><line x1={x} x2={x} y1={yPrice(Number(candle.high))} y2={yPrice(Number(candle.low))} stroke={color}/><line x1={x - bodyWidth / 2} x2={x} y1={yPrice(open)} y2={yPrice(open)} stroke={color}/><line x1={x} x2={x + bodyWidth / 2} y1={yPrice(close)} y2={yPrice(close)} stroke={color}/></g>; return <g key={candle.ordinal}>{settings.candleWicks && <line x1={x} x2={x} y1={yPrice(Number(candle.high))} y2={yPrice(Number(candle.low))} stroke={color}/>}<rect x={x - bodyWidth / 2} y={Math.min(yPrice(open), yPrice(close))} width={bodyWidth} height={Math.max(1, Math.abs(yPrice(open) - yPrice(close)))} fill={color} stroke={settings.candleBorders ? settings.background : color} strokeWidth={settings.candleBorders ? .6 : 0}/></g> })}
        {visibleIndicators.filter(item => item.type !== 'rsi').map(indicator => <polyline key={indicator.id} points={indicator.values.map((value, position) => value === null || position < renderStart || position >= renderEnd ? null : `${xIndex(position)},${yPrice(value)}`).filter(Boolean).join(' ')} fill="none" stroke={indicator.color} strokeWidth="1.45"/>)}
        {(settings.showPriceLine || settings.showLastValue) && <g>{settings.showPriceLine && <line x1={left} x2={left + width} y1={yPrice(lastClose)} y2={yPrice(lastClose)} stroke="#9299a4" strokeDasharray="3 3" opacity=".7"/>}{settings.showLastValue && <><rect x={left + width + 3} y={yPrice(lastClose) - 8} width={right - 8} height="16" rx="2" fill="#48505d"/><text x={left + width + 7} y={yPrice(lastClose) + 4} fill="#f8fafc" fontSize="10" fontFamily="monospace">{format(lastClose)}</text></>}</g>}
        {markers.filter(marker => marker.barIndex >= visibleItems[0].ordinal && marker.barIndex <= visibleItems.at(-1)!.ordinal).map(marker => { const position = page.items.findIndex(item => item.ordinal >= marker.barIndex), color = marker.kind === 'ENTRY' ? '#16a085' : marker.kind === 'EXIT' ? '#f04452' : '#d7a44a'; return <circle key={marker.id} cx={xIndex(position)} cy={top + 12} r="4" fill={color}><title>{`${marker.kind} · bar ${marker.barIndex} · event ${marker.id}`}</title></circle> })}
        {drawings.concat(draft ? [draft] : []).map(drawingShape)}
        {settings.showSymbol && <text x={left + 4} y="17" fill={settings.textColor} fontSize="11" fontWeight="650">{page.dataset.symbol} · {zoneLabel}</text>}
        {settings.showOhlc && <text x={left + (viewWidth >= 620 ? 132 : 4)} y={viewWidth >= 620 ? 17 : 32} fill="#8d949f" fontSize="10" fontFamily="monospace">O {inspected.open}  H {inspected.high}  L {inspected.low}  C {inspected.close}  V {inspected.volume}</text>}
        {hasRsi && <g><line x1={left} x2={left + width} y1={rsiTop - 8} y2={rsiTop - 8} stroke={settings.separatorColor}/><rect x={left} y={rsiTop} width={width} height={boundedRsi} fill="#13161b"/><line x1={left} x2={left + width} y1={rsiTop + boundedRsi * .3} y2={rsiTop + boundedRsi * .3} stroke={settings.gridColor} strokeDasharray="3 4"/><line x1={left} x2={left + width} y1={rsiTop + boundedRsi * .7} y2={rsiTop + boundedRsi * .7} stroke={settings.gridColor} strokeDasharray="3 4"/>{visibleIndicators.filter(item => item.type === 'rsi').map(indicator => <polyline key={indicator.id} points={indicator.values.map((value, position) => value === null || position < renderStart || position >= renderEnd ? null : `${xIndex(position)},${rsiTop + (100 - value) / 100 * boundedRsi}`).filter(Boolean).join(' ')} fill="none" stroke={indicator.color} strokeWidth="1.4"/>)}<text x={left + 4} y={rsiTop + 13} fill="#8d949f" fontSize="10">RSI</text><text x={left + width + 8} y={rsiTop + 5} fill="#737b88" fontSize="9">100</text><text x={left + width + 8} y={rsiBottom} fill="#737b88" fontSize="9">0</text></g>}
        {crosshair && settings.showCrosshair && activeTool === 'cursor' && !pan.current && <g pointerEvents="none"><line x1={crosshair.x} x2={crosshair.x} y1={top} y2={hasRsi ? rsiBottom : chartBottom} stroke="#858c97" strokeDasharray="3 3" opacity=".58"/><line x1={left} x2={left + width} y1={crosshair.y} y2={crosshair.y} stroke="#858c97" strokeDasharray="3 3" opacity=".58"/><rect x={left + width + 3} y={crosshair.y - 8} width={right - 8} height="16" rx="2" fill="#2a2e35"/><text x={left + width + 7} y={crosshair.y + 4} fill="#d7dbe0" fontSize="10" fontFamily="monospace">{format(crossPrice!)}</text><text x={crosshair.x} y={axisBottom + 15} textAnchor="middle" fill="#8b93a1" fontSize="9">{formatTime(page.items[index].time)}</text></g>}
        {/* Y-axis ticks and horizontal grid */}
        {(() => {
          const yRange = prices.upper - prices.lower
          const yStepRaw = yRange / 5
          const yMagnitude = Math.pow(10, Math.floor(Math.log10(yStepRaw || 1)))
          const yNorm = yStepRaw / yMagnitude
          const yStep = (yNorm < 1.5 ? 1 : yNorm < 3 ? 2 : yNorm < 7 ? 5 : 10) * yMagnitude
          const ticks = []
          for (let yVal = Math.ceil(prices.lower / yStep) * yStep; yVal <= prices.upper; yVal += yStep) ticks.push(yVal)
          return ticks.map(val => (
            <g key={`y-tick-${val}`}>
              {settings.showGrid && <line x1={left} x2={left + width} y1={yPrice(val)} y2={yPrice(val)} stroke={settings.gridColor} opacity=".3"/>}
              <text x={left + width + 5} y={yPrice(val) + 4} fill="#737b88" fontSize="10">{format(val)}</text>
            </g>
          ))
        })()}
      </svg>
      {hasRsi && <div role="separator" aria-label="Resize RSI pane" aria-orientation="horizontal" aria-valuemin={64} aria-valuemax={180} aria-valuenow={boundedRsi} tabIndex={0} style={{ top: `${(rsiTop - 13) / totalHeight * 100}%` }} className="absolute left-3 right-[78px] z-30 h-3 -translate-y-1/2 cursor-row-resize touch-none" onPointerDown={event => { event.preventDefault(); const start = event.clientY, initial = rsiHeight; event.currentTarget.setPointerCapture(event.pointerId); const move = (next: PointerEvent) => setRsiHeight(clamp(initial - (next.clientY - start) * totalHeight / Math.max(svg.current?.getBoundingClientRect().height ?? totalHeight, 1), 64, 180)); const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop) }} onKeyDown={event => { if (event.key === 'ArrowUp') setRsiHeight(value => clamp(value + 8, 64, 180)); if (event.key === 'ArrowDown') setRsiHeight(value => clamp(value - 8, 64, 180)) }}><span className="absolute left-1/2 top-1/2 h-0.5 w-12 -translate-x-1/2 -translate-y-1/2 rounded bg-slate-600 opacity-0 transition group-hover:opacity-100"/></div>}
      <div className="absolute bottom-2 right-36 flex items-center gap-1 rounded-md border border-slate-800 bg-[#14171c]/92 p-0.5 text-[9px] text-slate-500"><span className="px-1.5">{Math.floor(visibleStart) + 1}–{Math.min(total, Math.ceil(visibleStart + visibleCount))} / {total}</span>{manualPrices && <span className="border-l border-slate-700 px-1.5 text-amber-300">Manual price</span>}<button type="button" aria-label="Reset chart view" title="Reset Chart · 0" data-tooltip="Reset · 0" onClick={resetView} disabled={visibleStart === 0 && Math.abs(visibleCount - total) < .01 && !manualPrices} className="icon-tool grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-35"><Icon name="reset" className="h-3.5 w-3.5"/></button></div>
    </div>
  </div>
}
