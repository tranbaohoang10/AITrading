import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from '../components/Icon'
import { AssetIcon } from './AssetIcon'
import type { Candle } from './api'
import { atr, bollinger, cci, ema, macd, rsi, sma, stochastic, timeframeMilliseconds, vwap, wma, obv, normalizeTimeframe } from './chartMath'
import { defaultChartSettings, drawingLabels, type ChartPoint, type ChartSettings, type Drawing, type DrawingTool, type IndicatorConfig, type MagnetMode } from './chartTypes'
import { captureSvgRegion, sendChartCaptureToAssistant, type CaptureRegion, type ChartCaptureContext } from './chartCapture'
import { formatMarketPrice } from './liveMarket'

type Marker = { id: number; barIndex: number; kind: string }
type Viewport = { start: number; count: number }
type PriceRange = { lower: number; upper: number }
type ScreenPoint = { x: number; y: number }
type PanState = { pointerId: number; x: number; y: number; viewport: Viewport; prices: PriceRange; mode: 'both' | 'scale'; anchorPrice?: number }
type EditState = { pointerId: number; drawing: Drawing; point: ChartPoint; handle: number | 'move'; last: Drawing }
type IndicatorSeries = IndicatorConfig & { values: Array<number | null>; bands?: { middle: Array<number | null>; upper: Array<number | null>; lower: Array<number | null> } }
type ContextMenuState = { kind: 'chart' | 'price' | 'time'; x: number; y: number }

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const minimumBars = (total: number) => Math.min(8, total)
export const visibleBarCountForWidth = (width: number) => clamp(Math.round(width / 8), 100, 180)
export const zoomViewport = (current: Viewport, total: number, anchor: number, delta: number, logicalTotal = total) => {
  const currentCount = clamp(current.count, minimumBars(total), total)
  const count = clamp(currentCount * Math.exp(clamp(delta, -240, 240) * .0015), minimumBars(total), total)
  const anchorIndex = current.start + clamp(anchor, 0, 1) * currentCount
  const start = clamp(anchorIndex - clamp(anchor, 0, 1) * count, 0, Math.max(0, logicalTotal - count))
  return { viewport: { count, start }, followingLatest: anchor >= .92 && start + count >= total - .5 }
}
const multiPointTools = new Set<DrawingTool>(['parallelChannel', 'fibExtension', 'polyline', 'triangle', 'longPosition', 'shortPosition'])
const singlePointTools = new Set<DrawingTool>(['horizontal', 'horizontalRay', 'vertical', 'cross', 'text', 'note', 'callout', 'priceNote'])
const editableTarget = (target: EventTarget | null) => target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
const navigationTool = (tool: DrawingTool) => tool === 'cursor' || tool === 'crosshair'

export function CandleChart({ page, markers = [], frozen = false, dataSource = 'imported', sourceLabel, timeframe = '1h', settings = defaultChartSettings, indicators = [], activeTool = 'cursor', drawings = [], selectedDrawingId, magnet = 'off', stayInMode = false, onAddDrawing, onUpdateDrawing, onCommitDrawingEdit, onSelectDrawing, onDeleteSelected, onDeleteDrawing, onUndo, onRedo, onCancelTool, onCaptureRequest, onToggleIndicator, onRemoveIndicator, onOpenIndicators, onOpenSettings, onRequestOlder }: {
  page: { dataset: { symbol: string }; items: Candle[] }
  markers?: Marker[]; frozen?: boolean; dataSource?: string; sourceLabel?: string; timeframe?: string; settings?: ChartSettings; indicators?: IndicatorConfig[]
 activeTool?: DrawingTool; drawings?: Drawing[]; selectedDrawingId?: string | null; magnet?: MagnetMode; stayInMode?: boolean
  onAddDrawing?: (drawing: Drawing) => void; onUpdateDrawing?: (drawing: Drawing) => void; onCommitDrawingEdit?: (before: Drawing, after: Drawing) => void
  onSelectDrawing?: (id: string | null) => void; onDeleteSelected?: () => void; onDeleteDrawing?: (id: string) => void; onUndo?: () => void; onRedo?: () => void; onCancelTool?: () => void
  onCaptureRequest?: (request: import('./chartCapture').ChartCaptureRequest) => Promise<void>
  onToggleIndicator?: (id: string) => void; onRemoveIndicator?: (id: string) => void; onOpenIndicators?: () => void
  onOpenSettings?: () => void
  onRequestOlder?: () => void
}) {
  const total = page.items.length
  const displaySymbol = page.dataset.symbol.replace(/-/g, '/')
  const [index, setIndex] = useState(Math.max(0, total - 1))
  const [crosshair, setCrosshair] = useState<ScreenPoint | null>(null)
  const [priceAxisHover, setPriceAxisHover] = useState(false)
  const [viewport, setViewport] = useState<Viewport>({ start: 0, count: total })
  const [isFollowingLatest, setIsFollowingLatest] = useState(true)
  const [manualPrices, setManualPrices] = useState<PriceRange | null>(null)
  const [capture, setCapture] = useState<CaptureRegion | null>(null), [capturePrompt, setCapturePrompt] = useState(''), [captureStatus, setCaptureStatus] = useState('')
  const [draft, setDraft] = useState<Drawing | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [rsiHeight, setRsiHeight] = useState(92)
  const [viewWidth, setViewWidth] = useState(900)
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 1024 : window.innerWidth)
  const [totalHeight, setTotalHeight] = useState(420)
  const svg = useRef<SVGSVGElement>(null)
  const pan = useRef<PanState | null>(null), edit = useRef<EditState | null>(null), captureAction = useRef<{ mode: 'draw' | 'move' | 'resize'; edge?: string; x: number; y: number; region: CaptureRegion } | null>(null)
  const multi = useRef<{ drawing: Drawing; fixed: number } | null>(null)
  const wheelQueue = useRef<{ delta: number; anchor: number }>({ delta: 0, anchor: .5 })
  const wheelFrame = useRef<number | null>(null), panFrame = useRef<number | null>(null)
  const completedOnPointerDown = useRef(false)
  const previousFirstTime = useRef<string | undefined>(page.items[0]?.time), olderRequest = useRef(false)
  const intervalMs = timeframeMilliseconds(normalizeTimeframe(timeframe) ?? '1h')

  useEffect(() => {
    if (!svg.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      if (rect.width) setViewWidth(Math.max(240, rect.width))
      if (rect.height) setTotalHeight(Math.max(240, rect.height))
    })
    observer.observe(svg.current); return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  useEffect(() => {
    setIndex(Math.max(0, total - 1)); setViewport({ start: 0, count: total }); setManualPrices(null); setIsFollowingLatest(true); setDraft(null); setCapture(null); setCapturePrompt(''); setCaptureStatus(''); setContextMenu(null); multi.current = null
  }, [page.dataset.symbol])
  useEffect(() => {
    setIndex(value => crosshair ? clamp(value, 0, Math.max(0, total - 1)) : isFollowingLatest ? Math.max(0, total - 1) : clamp(value, 0, Math.max(0, total - 1)))
    setViewport(value => {
      const count = clamp(value.count || total, minimumBars(total), total)
      const futureBars = Math.max(12, Math.ceil(count * .35))
      return { count, start: isFollowingLatest ? Math.max(0, total - count) : clamp(value.start, 0, Math.max(0, total + futureBars - count)) }
    })
  }, [crosshair, isFollowingLatest, total])
  useEffect(() => {
    if (!total) return
    const preferred = Math.min(total, visibleBarCountForWidth(viewWidth))
    setViewport(value => value.count === total || isFollowingLatest ? { count: preferred, start: Math.max(0, total - preferred) } : value)
  }, [viewWidth, total, isFollowingLatest])
  useEffect(() => {
    const previous = previousFirstTime.current, next = page.items[0]?.time
    if (previous && next && previous !== next) {
      const shift = page.items.findIndex(item => item.time === previous)
      if (shift > 0) setViewport(value => ({ ...value, start: clamp(value.start + shift, 0, Math.max(0, page.items.length + Math.ceil(value.count * .35) - value.count)) }))
    }
    previousFirstTime.current = next
  }, [page.items])
  useEffect(() => { setDraft(null); multi.current = null; completedOnPointerDown.current = false }, [activeTool])
  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [])
  useEffect(() => () => { if (wheelFrame.current) cancelAnimationFrame(wheelFrame.current); if (panFrame.current) cancelAnimationFrame(panFrame.current) }, [])

  const futureBars = Math.max(12, Math.ceil(Math.max(8, viewport.count) * .35))
  const logicalTotal = total + futureBars
  const visibleStart = clamp(viewport.start, 0, Math.max(0, logicalTotal - viewport.count))
  const visibleCount = clamp(viewport.count, minimumBars(total), total)
  useEffect(() => {
    const threshold = Math.max(3, Math.min(40, visibleCount * .12))
    if (onRequestOlder && total > visibleCount && visibleStart <= threshold) {
      if (!olderRequest.current) { olderRequest.current = true; onRequestOlder() }
    } else olderRequest.current = false
  }, [onRequestOlder, total, visibleCount, visibleStart])
  const renderStart = clamp(Math.floor(visibleStart), 0, Math.max(0, total - 1))
  const renderEnd = clamp(Math.ceil(Math.min(visibleStart + visibleCount, total)), renderStart + 1, total)
  const visibleItems = page.items.slice(renderStart, renderEnd)
  const values = useMemo(() => page.items.map(candle => Number(candle.close)), [page.items])
  const computedIndicators = useMemo<IndicatorSeries[]>(() => indicators.map(indicator => {
    if (indicator.type === 'bollinger') {
      const bands = bollinger(values, indicator.period, indicator.deviation ?? 2)
      return { ...indicator, values: bands.middle, bands }
    }
    const series = indicator.type === 'sma' ? sma(values, indicator.period)
      : indicator.type === 'ema' ? ema(values, indicator.period)
        : indicator.type === 'wma' ? wma(values, indicator.period)
        : indicator.type === 'rsi' ? rsi(values, indicator.period)
          : indicator.type === 'vwap' ? vwap(page.items)
              : indicator.type === 'atr' ? atr(page.items, indicator.period)
              : indicator.type === 'stochastic' ? stochastic(page.items, indicator.period)
                : indicator.type === 'cci' ? cci(page.items, indicator.period)
                  : indicator.type === 'obv' ? obv(page.items)
                    : macd(values, indicator.fast ?? 12, indicator.slow ?? 26)
    return { ...indicator, values: series }
  }), [indicators, page.items, values])
  const visibleIndicators = computedIndicators.filter(indicator => indicator.visible)
  if (!visibleItems.length) return <p className="p-6 text-sm text-slate-400">No candles in this window. Choose an earlier window.</p>

  const autoPrices = (() => {
    const lows = visibleItems.map(candle => Number(candle.low)), highs = visibleItems.map(candle => Number(candle.high))
    const minimum = Math.min(...lows), maximum = Math.max(...highs), padding = Math.max((maximum - minimum) * .08, Math.abs(maximum) * .001, 1e-8)
    return { lower: minimum - padding, upper: maximum + padding }
  })()
  const prices = manualPrices ?? autoPrices
  const priceSpan = Math.max(prices.upper - prices.lower, 1e-12)
  const left = 12, right = 78, width = Math.max(80, viewWidth - left - right)
  const overlayRows = indicators.length
  const overlayInset = Math.min(156, Math.max(56, 38 + overlayRows * 16))
  const top = overlayInset
  const hasRsi = visibleIndicators.some(indicator => indicator.type === 'rsi')
  const oscillatorIndicators = visibleIndicators.filter(indicator => ['rsi', 'macd', 'atr', 'stochastic', 'cci', 'obv'].includes(indicator.type))
  const hasVolume = settings.showVolume
  const axisBottom = totalHeight - 22, paneGap = hasVolume || oscillatorIndicators.length ? 14 : 0
  const paneHeight = Math.max(64, Math.min(104, (axisBottom - top - 145 - (hasVolume ? 62 : 0) - Math.max(0, paneGap * (oscillatorIndicators.length + Number(hasVolume) - 1))) / Math.max(1, oscillatorIndicators.length)))
  const boundedRsi = hasRsi ? clamp(rsiHeight, 64, Math.max(64, Math.min(180, paneHeight))) : 0
  const oscillatorHeight = (indicator: IndicatorConfig) => indicator.type === 'rsi' ? boundedRsi : paneHeight
  const priceHeight = Math.max(145, axisBottom - top - (hasVolume ? 62 + paneGap : 0) - oscillatorIndicators.reduce((sum, item) => sum + oscillatorHeight(item) + paneGap, 0)), chartBottom = top + priceHeight
  const paneTop = (index: number) => chartBottom + paneGap + (hasVolume ? 62 + paneGap : 0) + oscillatorIndicators.slice(0, index).reduce((sum, item) => sum + oscillatorHeight(item) + paneGap, 0)
  const volumeTop = chartBottom + paneGap
  const volumeBottom = volumeTop + (hasVolume ? 62 : 0)
  const rsiIndex = oscillatorIndicators.findIndex(indicator => indicator.type === 'rsi')
  const rsiTop = rsiIndex >= 0 ? paneTop(rsiIndex) : chartBottom
  const itemIndex = new Map(page.items.map((candle, position) => [candle.time, position]))
  const timeIndex = (time: string) => {
    const exact = itemIndex.get(time); if (exact !== undefined) return exact
    const target = Date.parse(time), latestTime = Date.parse(page.items.at(-1)?.time ?? ''), firstTime = Date.parse(page.items[0]?.time ?? '')
    if (Number.isFinite(target) && Number.isFinite(latestTime) && target > latestTime) return total - 1 + (target - latestTime) / intervalMs
    if (Number.isFinite(target) && Number.isFinite(firstTime) && target < firstTime) return (target - firstTime) / intervalMs
    let low = 0, high = total - 1
    while (low < high) { const middle = Math.floor((low + high) / 2); if (Date.parse(page.items[middle].time) < target) low = middle + 1; else high = middle }
    if (low > 0 && Math.abs(Date.parse(page.items[low - 1].time) - target) < Math.abs(Date.parse(page.items[low].time) - target)) return low - 1
    return low
  }
  const timeAtPosition = (position: number) => {
    const rounded = Math.round(position)
    if (rounded >= 0 && rounded < total) return page.items[rounded].time
    const anchor = rounded < 0 ? Date.parse(page.items[0].time) : Date.parse(page.items.at(-1)!.time)
    const offset = rounded < 0 ? rounded : rounded - (total - 1)
    return new Date(anchor + offset * intervalMs).toISOString()
  }
  const xIndex = (position: number) => left + (position + .5 - visibleStart) / visibleCount * width
  const timeTicks = useMemo(() => {
    const ticks: { time: string, label: string }[] = []
    if (visibleItems.length < 2) return ticks
    const count = Math.max(2, Math.floor(width / 130))
    const startObj = new Date(visibleItems[0].time)
    const endObj = new Date(visibleItems[visibleItems.length - 1].time)
    const diffHours = (endObj.getTime() - startObj.getTime()) / 3600000
    const showTime = diffHours < 120
    const showYear = diffHours > 8760

    for (let i = 0; i <= count; i++) {
      const idx = Math.floor(i * (visibleItems.length - 1) / count)
      const item = visibleItems[idx]
      if (item) {
        ticks.push({
          time: item.time,
          label: new Intl.DateTimeFormat('en-GB', {
            timeZone: settings.timezone === 'LOCAL' || settings.timezone === 'EXCHANGE' ? undefined : settings.timezone,
            year: showYear ? 'numeric' : undefined,
            month: 'short',
            day: '2-digit',
            hour: showTime ? '2-digit' : undefined,
            minute: showTime ? '2-digit' : undefined,
            hour12: false
          }).format(new Date(item.time)).replace(',', '')
        })
      }
    }
    return Array.from(new Map(ticks.map(t => [t.time, t])).values())
  }, [visibleItems, settings.timezone, width])
  const xTime = (time: string) => xIndex(timeIndex(time))
  const yPrice = (value: number) => top + (prices.upper - value) / priceSpan * priceHeight
  const format = (value: number) => Math.abs(value) >= 1e8 || (value !== 0 && Math.abs(value) < 1e-3) ? value.toExponential(3) : Number(value.toPrecision(7)).toString()
  const importedPrecision = dataSource === 'imported'
    ? page.items.reduce((maximum, candle) => Math.max(maximum, ...[candle.open, candle.high, candle.low, candle.close].map(value => (value.split('.')[1] ?? '').length)), 0)
    : 0
  const pricePrecision = Math.max(settings.pricePrecision ?? 0, importedPrecision)
  const formatPrice = (value: number) => formatMarketPrice(value, settings.priceIncrement ?? 0.01, pricePrecision)
  const formatVolume = (value: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, notation: Math.abs(value) >= 1000 ? 'compact' : 'standard' }).format(value)
  const formatTimezone = settings.timezone === 'LOCAL' || settings.timezone === 'EXCHANGE' ? undefined : settings.timezone
  const formatTime = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: formatTimezone, month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)).replace(',', '')
  const id = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `drawing-${Date.now()}`
  const selectedCandle = page.items[clamp(index, 0, total - 1)]

  const chartPoint = (event: ReactPointerEvent<SVGSVGElement>): ChartPoint => {
    const rect = event.currentTarget.getBoundingClientRect(), clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2, clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2
    const px = (clientX - rect.left) / Math.max(rect.width, 1) * viewWidth, py = (clientY - rect.top) / Math.max(rect.height, 1) * totalHeight
    const position = Math.round(visibleStart + (px - left) / width * visibleCount - .5)
    let price = prices.upper - (py - top) / Math.max(priceHeight, 1) * priceSpan
    if (magnet !== 'off' && position >= 0 && position < total) {
      const candle = page.items[position], candidates = [candle.open, candle.high, candle.low, candle.close].map(Number), nearest = candidates.reduce((best, value) => Math.abs(value - price) < Math.abs(best - price) ? value : best, candidates[0])
      const threshold = priceSpan * (magnet === 'strong' ? .06 : .018); if (Math.abs(nearest - price) <= threshold) price = nearest
    }
    const time = position >= 0 && position < total ? page.items[position].time : new Date(Date.parse(page.items.at(-1)!.time) + (position - (total - 1)) * intervalMs).toISOString()
    return { time, price }
  }
  const screenPoint = (event: ReactPointerEvent<SVGSVGElement>): ScreenPoint => {
    const rect = event.currentTarget.getBoundingClientRect(), clientX = Number.isFinite(event.clientX) ? event.clientX : rect.left + rect.width / 2, clientY = Number.isFinite(event.clientY) ? event.clientY : rect.top + rect.height / 2
    const px = (clientX - rect.left) / Math.max(rect.width, 1) * viewWidth, py = (clientY - rect.top) / Math.max(rect.height, 1) * totalHeight
    return { x: clamp(px, left, left + width), y: clamp(py, top, chartBottom) }
  }
  const updateInspected = (point: ScreenPoint) => setIndex(clamp(Math.floor(visibleStart + (point.x - left) / width * visibleCount), 0, total - 1))
  const resetPriceScale = () => setManualPrices(null)
  const resetView = () => { const count = Math.min(total, visibleBarCountForWidth(viewWidth)); setViewport({ start: Math.max(0, total - count), count }); setManualPrices(null); setIsFollowingLatest(true); setIndex(total - 1) }
  const schedulePan = (nextViewport: Viewport, nextPrices?: PriceRange) => {
    if (panFrame.current) cancelAnimationFrame(panFrame.current)
    panFrame.current = requestAnimationFrame(() => { setViewport(nextViewport); if (nextPrices) setManualPrices(nextPrices); panFrame.current = null })
  }
  const completeDrawing = (drawing: Drawing) => { onAddDrawing?.(drawing); setDraft(null); multi.current = null; if (!stayInMode) onCancelTool?.() }

  const pointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return
    setContextMenu(null)
    event.currentTarget.focus(); const screen = screenPoint(event), point = chartPoint(event); setCrosshair(screen); updateInspected(screen)
    const rect = event.currentTarget.getBoundingClientRect(), px = rect.width > 0 ? (event.clientX - rect.left) / rect.width * viewWidth : event.clientX
    if (activeTool === 'aiCapture') { setCapture({ x: screen.x, y: screen.y, width: 0, height: 0 }); captureAction.current = { mode: 'draw', x: screen.x, y: screen.y, region: { x: screen.x, y: screen.y, width: 0, height: 0 } }; event.currentTarget.setPointerCapture?.(event.pointerId); event.preventDefault(); return }
    if (px > left + width) {
      onSelectDrawing?.(null); pan.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, viewport: { start: visibleStart, count: visibleCount }, prices, mode: 'scale', anchorPrice: point.price }
      event.currentTarget.setPointerCapture?.(event.pointerId); event.preventDefault(); return
    }
    if (activeTool === 'eraser') { const nearest = drawings.map(drawing => ({ drawing, point: projectedPoint(drawing.points[0]) })).sort((a, b) => Math.hypot(a.point.x - screen.x, a.point.y - screen.y) - Math.hypot(b.point.x - screen.x, b.point.y - screen.y))[0]; if (nearest && Math.hypot(nearest.point.x - screen.x, nearest.point.y - screen.y) < 28) { onSelectDrawing?.(nearest.drawing.id); onDeleteDrawing?.(nearest.drawing.id) } return }
    if (navigationTool(activeTool)) {
      onSelectDrawing?.(null); pan.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, viewport: { start: visibleStart, count: visibleCount }, prices, mode: 'both' }
      event.currentTarget.setPointerCapture?.(event.pointerId); event.preventDefault(); return
    }
    if (singlePointTools.has(activeTool)) {
      const label = activeTool === 'text' ? 'Text' : activeTool === 'note' ? 'Note' : activeTool === 'callout' ? 'Callout' : activeTool === 'priceNote' ? 'Price Note' : undefined
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
    const rect = event.currentTarget.getBoundingClientRect(), rawX = rect.width > 0 ? (event.clientX - rect.left) / rect.width * viewWidth : event.clientX
    setPriceAxisHover(rawX > left + width)
    if (captureAction.current) {
      const action = captureAction.current
      if (action.mode === 'draw') { const next = { x: Math.min(action.x, screen.x), y: Math.min(action.y, screen.y), width: Math.abs(screen.x - action.x), height: Math.abs(screen.y - action.y) }; action.region = next; setCapture(next) }
      else if (action.mode === 'move') { const dx = screen.x - action.x, dy = screen.y - action.y; const next = { ...action.region, x: clamp(action.region.x + dx, left, left + width - action.region.width), y: clamp(action.region.y + dy, top, chartBottom - action.region.height) }; action.x = screen.x; action.y = screen.y; action.region = next; setCapture(next) }
      else { const next = { ...action.region }; const edge = action.edge ?? ''; if (edge.includes('left')) { const rightEdge = action.region.x + action.region.width; next.x = clamp(screen.x, left, rightEdge - 24); next.width = rightEdge - next.x } if (edge.includes('right')) { next.width = clamp(screen.x - action.region.x, 24, left + width - action.region.x) } if (edge.includes('top')) { const bottomEdge = action.region.y + action.region.height; next.y = clamp(screen.y, top, bottomEdge - 24); next.height = bottomEdge - next.y } if (edge.includes('bottom')) next.height = clamp(screen.y - action.region.y, 24, chartBottom - action.region.y); action.region = next; setCapture(next) }
      return
    }
    if (edit.current) {
      const current = edit.current, deltaIndex = timeIndex(point.time) - timeIndex(current.point.time), deltaPrice = point.price - current.point.price
      const points = current.handle === 'move' ? current.drawing.points.map(anchor => ({ time: timeAtPosition(timeIndex(anchor.time) + deltaIndex), price: anchor.price + deltaPrice })) : current.drawing.points.map((anchor, position) => position === current.handle ? point : anchor)
      const next = { ...current.drawing, points }; current.last = next; onUpdateDrawing?.(next); return
    }
    if (pan.current) {
      const dx = event.clientX - pan.current.x, dy = event.clientY - pan.current.y
      if (pan.current.mode === 'scale') { const initial = pan.current.prices, span = initial.upper - initial.lower, anchor = pan.current.anchorPrice ?? (initial.lower + span / 2), anchorRatio = (anchor - initial.lower) / span, nextSpan = clamp(span * Math.exp(dy / Math.max(priceHeight, 1) * 1.4), span * .08, span * 40); const lower = anchor - nextSpan * anchorRatio; setManualPrices({ lower, upper: lower + nextSpan }); setIsFollowingLatest(false); return }
      const count = pan.current.viewport.count
      const start = clamp(pan.current.viewport.start - dx / Math.max(width, 1) * count, 0, Math.max(0, logicalTotal - count))
      const priceDelta = dy / Math.max(priceHeight, 1) * (pan.current.prices.upper - pan.current.prices.lower)
      setIsFollowingLatest(start + count >= total - .5 && Math.abs(dy) < 1)
      schedulePan({ start, count }, Math.abs(dy) > 0.5 ? { lower: pan.current.prices.lower + priceDelta, upper: pan.current.prices.upper + priceDelta } : undefined)
      return
    }
    if (navigationTool(activeTool)) updateInspected(screen)
    if (multi.current) { const points = [...multi.current.drawing.points]; points[points.length - 1] = point; const drawing = { ...multi.current.drawing, points }; multi.current.drawing = drawing; setDraft(drawing); return }
    if (!draft) return
    setDraft(current => !current ? current : current.type === 'brush' ? { ...current, points: [...current.points, point] } : { ...current, points: [current.points[0], point] })
  }
  const pointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (captureAction.current) { const action = captureAction.current; captureAction.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); if (action.mode === 'draw' && action.region.width < 24) { setCapture(null); setCapturePrompt('') } return }
    if (completedOnPointerDown.current) { completedOnPointerDown.current = false; return }
    if (edit.current) { const current = edit.current; onCommitDrawingEdit?.(current.drawing, current.last); edit.current = null; event.currentTarget.releasePointerCapture?.(event.pointerId); return }
    if (pan.current) { event.currentTarget.releasePointerCapture?.(pan.current.pointerId); pan.current = null; return }
    if (!draft || multi.current) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    if (draft.points.length > 1 && (draft.points.length > 2 || draft.points[0].time !== draft.points[1].time || draft.points[0].price !== draft.points[1].price)) completeDrawing(draft)
    else if (draft.type === 'brush') setDraft(null)
  }
  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const element = event.currentTarget, rect = element.getBoundingClientRect()
    const plotLeft = rect.left + left / Math.max(viewWidth, 1) * rect.width
    const plotWidth = width / Math.max(viewWidth, 1) * rect.width
    const anchor = clamp((event.clientX - plotLeft) / Math.max(plotWidth, 1), 0, 1)
    const mode = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1
    wheelQueue.current.delta += clamp(event.deltaY * mode, -120, 120); wheelQueue.current.anchor = anchor
    if (wheelFrame.current) return
    wheelFrame.current = requestAnimationFrame(() => {
      const queued = wheelQueue.current; wheelQueue.current = { delta: 0, anchor: queued.anchor }; wheelFrame.current = null
      setViewport(current => {
        // LuxAlgo-style zoom keeps the candle below the pointer at the same screen position.
        // The old latest-candle shortcut made a wheel gesture from a live/following view
        // ignore the pointer and visibly jump the whole window back to the right edge.
        const next = zoomViewport(current, total, queued.anchor, queued.delta, logicalTotal)
        setIsFollowingLatest(next.followingLatest)
        return next.viewport
      })
    })
  }
  const cancelDraft = () => { setDraft(null); multi.current = null; onCancelTool?.() }
  const captureContext = (region: CaptureRegion): ChartCaptureContext => {
    const fromIndex = clamp(Math.floor(visibleStart + (region.x - left) / width * visibleCount), 0, total - 1), toIndex = clamp(Math.ceil(visibleStart + (region.x + region.width - left) / width * visibleCount), 0, total - 1)
    const captured = page.items.slice(Math.min(fromIndex, toIndex), Math.max(fromIndex, toIndex) + 1)
    const lows = captured.map(item => Number(item.low)), highs = captured.map(item => Number(item.high))
    return { symbol: page.dataset.symbol, provider: 'COINBASE', timeframe, visibleTimeRange: { from: page.items[clamp(Math.floor(visibleStart), 0, total - 1)].time, to: page.items[clamp(Math.ceil(visibleStart + visibleCount) - 1, 0, total - 1)].time }, capturedTimeRange: { from: captured[0]?.time ?? page.items[0].time, to: captured.at(-1)?.time ?? page.items.at(-1)!.time }, approximateCapturedPriceRange: { lower: Math.min(...lows, prices.lower), upper: Math.max(...highs, prices.upper) }, currentPrice: Number(page.items.at(-1)!.close), selectedDrawingIds: selectedDrawingId ? [selectedDrawingId] : [] }
  }
  const submitCapture = async () => {
    const region = capture
    if (!region || region.width < 24 || region.height < 24) { setCaptureStatus('Select a larger chart area.'); return }
    if (!svg.current) return
    setCaptureStatus('Preparing chart…')
    try { const blob = await captureSvgRegion(svg.current, region); const request = { blob, prompt: capturePrompt.trim() || 'Explain what is happening in this selected chart area.', context: captureContext(region), region }; await (onCaptureRequest ?? sendChartCaptureToAssistant)(request); setCapture(null); setCapturePrompt(''); setCaptureStatus(''); captureAction.current = null; onCancelTool?.() } catch (error) { setCaptureStatus(error instanceof Error ? error.message : 'Assistant is unavailable. No message was sent.') }
  }
  const captureScreen = (event: ReactPointerEvent<SVGElement>): ScreenPoint => { const owner = svg.current, rect = owner?.getBoundingClientRect(); if (!owner || !rect) return { x: left, y: top }; return { x: clamp((event.clientX - rect.left) / Math.max(rect.width, 1) * viewWidth, left, left + width), y: clamp((event.clientY - rect.top) / Math.max(rect.height, 1) * totalHeight, top, chartBottom) } }
  const beginCaptureHandle = (event: ReactPointerEvent<SVGElement>, mode: 'move' | 'resize', edge?: string) => { if (!capture || !svg.current) return; event.stopPropagation(); event.preventDefault(); const point = captureScreen(event); captureAction.current = { mode, edge, x: point.x, y: point.y, region: capture }; svg.current.setPointerCapture?.(event.pointerId) }
  const captureHandles = capture ? [
    { key: 'top-left', x: capture.x, y: capture.y, cursor: 'nwse-resize' }, { key: 'top', x: capture.x + capture.width / 2, y: capture.y, cursor: 'ns-resize' }, { key: 'top-right', x: capture.x + capture.width, y: capture.y, cursor: 'nesw-resize' },
    { key: 'right', x: capture.x + capture.width, y: capture.y + capture.height / 2, cursor: 'ew-resize' }, { key: 'bottom-right', x: capture.x + capture.width, y: capture.y + capture.height, cursor: 'nwse-resize' }, { key: 'bottom', x: capture.x + capture.width / 2, y: capture.y + capture.height, cursor: 'ns-resize' },
    { key: 'bottom-left', x: capture.x, y: capture.y + capture.height, cursor: 'nesw-resize' }, { key: 'left', x: capture.x, y: capture.y + capture.height / 2, cursor: 'ew-resize' },
  ] : []
  const keyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); setCapture(null); setCapturePrompt(''); setCaptureStatus(''); captureAction.current = null; cancelDraft(); onSelectDrawing?.(null); onCancelTool?.(); return }
    if (editableTarget(event.target)) return
    const modifier = event.ctrlKey || event.metaKey
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedDrawingId) { event.preventDefault(); onDeleteSelected?.(); return }
    if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) onRedo?.(); else onUndo?.(); return }
    if (modifier && event.key.toLowerCase() === 'y') { event.preventDefault(); onRedo?.(); return }
    if (event.key === '0') { event.preventDefault(); resetView(); return }
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      setViewport(current => {
        const currentCount = clamp(current.count, minimumBars(total), total), count = clamp(currentCount * .9, minimumBars(total), total)
        if (isFollowingLatest) return { count, start: Math.max(0, total - count) }
        const anchorIndex = current.start + currentCount / 2
        return { count, start: clamp(anchorIndex - count / 2, 0, Math.max(0, logicalTotal - count)) }
      })
      return
    }
    if (event.key === '-') {
      event.preventDefault()
      setViewport(current => {
        const currentCount = clamp(current.count, minimumBars(total), total), count = clamp(currentCount * 1.1, minimumBars(total), total)
        if (isFollowingLatest) return { count, start: Math.max(0, total - count) }
        const anchorIndex = current.start + currentCount / 2
        return { count, start: clamp(anchorIndex - count / 2, 0, Math.max(0, logicalTotal - count)) }
      })
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setIndex(value => clamp(value + (event.key === 'ArrowLeft' ? -1 : 1), 0, total - 1)) }
  }

  if (!visibleItems.length) return <p className="p-6 text-sm text-slate-400">No candles in this window. Choose an earlier window.</p>

  const beginEdit = (event: ReactPointerEvent<SVGElement>, drawing: Drawing, handle: number | 'move') => {
    if (activeTool !== 'cursor' || drawing.locked) return
    event.stopPropagation(); const owner = event.currentTarget.ownerSVGElement; if (!owner) return
    const rect = owner.getBoundingClientRect(), synthetic = { ...event, currentTarget: owner, clientX: event.clientX || rect.left, clientY: event.clientY || rect.top } as unknown as ReactPointerEvent<SVGSVGElement>
    const point = chartPoint(synthetic); edit.current = { pointerId: event.pointerId, drawing, point, handle, last: drawing }; onSelectDrawing?.(drawing.id); owner.setPointerCapture?.(event.pointerId)
  }
  const projected = (drawing: Drawing) => drawing.points.map(point => ({ x: xTime(point.time), y: yPrice(point.price) }))
  const projectedPoint = (point: ChartPoint) => ({ x: xTime(point.time), y: yPrice(point.price) })
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
    if (drawing.type === 'text' || drawing.type === 'note' || drawing.type === 'callout' || drawing.type === 'priceNote') return wrap(<><circle cx={a.x} cy={a.y} r="3" fill={color}/>{drawing.type === 'callout' && <line x1={a.x} y1={a.y} x2={a.x + 20} y2={a.y - 18} stroke={color}/>}<rect x={a.x + 7} y={a.y - 25} width={Math.max(44, (drawing.text?.length ?? 4) * 7)} height="22" rx="4" fill="#20242b" stroke="#3a404a"/><text x={a.x + 13} y={a.y - 10} fill={settings.textColor} fontSize="11">{drawing.text || drawingLabels[drawing.type]}</text></>)
    if (drawing.type === 'brush' || drawing.type === 'polyline') return wrap(<polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={color} strokeWidth={drawing.type === 'brush' ? 2.2 : strokeWidth} strokeLinecap="round" strokeLinejoin="round"/>)
    if (drawing.type === 'rectangle') return wrap(<rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="#94a3b8" fillOpacity=".1" stroke={color} strokeWidth={strokeWidth}/>)
    if (drawing.type === 'ellipse') return wrap(<ellipse cx={(a.x + b.x) / 2} cy={(a.y + b.y) / 2} rx={Math.abs(b.x - a.x) / 2} ry={Math.abs(b.y - a.y) / 2} fill="#94a3b8" fillOpacity=".08" stroke={color} strokeWidth={strokeWidth}/>)
    if (drawing.type === 'triangle') return wrap(<polygon points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`} fill="#94a3b8" fillOpacity=".08" stroke={color} strokeWidth={strokeWidth}/>)
    if (drawing.type === 'parallelChannel') { const dx = b.x - a.x, dy = b.y - a.y; return wrap(<><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={strokeWidth}/><line x1={c.x} y1={c.y} x2={c.x + dx} y2={c.y + dy} stroke={color} strokeWidth={strokeWidth}/><polygon points={`${a.x},${a.y} ${b.x},${b.y} ${c.x + dx},${c.y + dy} ${c.x},${c.y}`} fill="#94a3b8" fillOpacity=".07"/></>) }
    if (drawing.type === 'fibRetracement' || drawing.type === 'fibExtension') {
      const levels = [0, .236, .382, .5, .618, .786, 1], origin = drawing.type === 'fibExtension' ? c : a, delta = b.y - a.y, startX = Math.min(a.x, drawing.type === 'fibExtension' ? c.x : b.x), endX = Math.max(b.x, drawing.type === 'fibExtension' ? c.x + Math.abs(b.x - a.x) : a.x)
      return wrap(<>{levels.map(level => { const screenY = origin.y + delta * level; return <g key={level}><line x1={startX} x2={endX} y1={screenY} y2={screenY} stroke={level === .618 ? '#d7a44a' : color} strokeWidth={level === .618 ? 1.5 : 1} opacity=".9"/><text x={endX + 4} y={screenY + 3} fill="#8e96a3" fontSize="9">{level}</text></g> })}</>)
    }
    if (['ruler', 'priceRange', 'dateRange', 'datePriceRange'].includes(drawing.type)) {
      const bars = Math.abs(timeIndex(drawing.points[1].time) - timeIndex(drawing.points[0].time)), priceDelta = drawing.points[1].price - drawing.points[0].price, percent = drawing.points[0].price === 0 ? 0 : priceDelta / drawing.points[0].price * 100
      const label = drawing.type === 'priceRange' ? `${formatPrice(priceDelta)} · ${percent.toFixed(2)}%` : drawing.type === 'dateRange' ? `${bars} bars` : `${bars} bars · ${formatPrice(priceDelta)} · ${percent.toFixed(2)}%`
      return wrap(<><rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="#6b7c93" fillOpacity=".09" stroke={color} strokeDasharray="4 3"/><text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 7} textAnchor="middle" fill={color} fontSize="10">{label}</text></>)
    }
    if (drawing.type === 'longPosition' || drawing.type === 'shortPosition') {
      const entry = drawing.points[0]?.price ?? 0, stop = drawing.points[1]?.price ?? entry, target = drawing.points[2]?.price ?? entry, long = drawing.type === 'longPosition', valid = drawing.points.length >= 3 && (long ? target > entry && entry > stop : stop > entry && entry > target)
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
  const lastItem = visibleItems.at(-1)!
  const lastClose = Number(lastItem.close)
  const lastColor = lastClose >= Number(lastItem.open) ? settings.bullColor : settings.bearColor
  const inspected = crosshair ? page.items[index] : selectedCandle
  const change = Number(inspected.close) - Number(inspected.open)
  const changePercent = Number(inspected.open) ? change / Number(inspected.open) * 100 : 0
  const changeLabel = `${change >= 0 ? '+' : ''}${formatPrice(change)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`
  const bullish = Number(inspected.close) >= Number(inspected.open)
  const statusClass = viewportWidth <= 560 ? 'chart-status-small' : viewportWidth <= 900 ? 'chart-status-compact' : 'chart-status-desktop'
  const statusText = viewportWidth <= 560
    ? `${settings.showSymbol ? `${displaySymbol} · ` : ''}${settings.showOhlc ? `C ${formatPrice(Number(inspected.close))} ${changeLabel}` : ''}`
    : viewportWidth <= 900
      ? `${settings.showSymbol ? `${displaySymbol} · ` : ''}${settings.showOhlc ? `O ${formatPrice(Number(inspected.open))} H ${formatPrice(Number(inspected.high))} L ${formatPrice(Number(inspected.low))} C ${formatPrice(Number(inspected.close))}` : ''}`
      : `${settings.showSymbol ? `${displaySymbol} · ${timeframe} · ` : ''}${settings.showOhlc ? `O ${formatPrice(Number(inspected.open))} H ${formatPrice(Number(inspected.high))} L ${formatPrice(Number(inspected.low))} C ${formatPrice(Number(inspected.close))} ${changeLabel}` : ''}`
  const indicatorRows = indicators.map(indicator => ({ indicator, value: computedIndicators.find(item => item.id === indicator.id)?.values[index] ?? null }))
  const crossPrice = crosshair ? prices.upper - (crosshair.y - top) / priceHeight * priceSpan : null
  const pointsFor = (series: Array<number | null>, y: (value: number) => number) => series.slice(renderStart, renderEnd).map((value, local) => value === null ? null : `${xIndex(renderStart + local)},${y(value)}`).filter(Boolean).join(' ')
  const paneBottom = oscillatorIndicators.length ? paneTop(oscillatorIndicators.length - 1) + oscillatorHeight(oscillatorIndicators.at(-1)!) : hasVolume ? volumeBottom : chartBottom

  const futureX = xIndex(total - .5)
  return <div className="flex h-full min-h-0 w-full flex-1 flex-col">
    <div className="relative flex min-h-0 flex-1 flex-col select-none">
      {sourceLabel && <div data-testid="market-header" className="pointer-events-none absolute left-4 top-2 z-20 flex max-w-[calc(100%-6rem)] flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-4 text-slate-300 sm:text-[11px]"><AssetIcon symbol={page.dataset.symbol}/><span className="font-semibold text-slate-100">{displaySymbol} · {sourceLabel} · {timeframe}</span><span className="font-mono">O {formatPrice(Number(inspected.open))}</span><span className="font-mono">H {formatPrice(Number(inspected.high))}</span><span className="font-mono">L {formatPrice(Number(inspected.low))}</span><span className="font-mono">C {formatPrice(Number(inspected.close))}</span><span className={`font-mono ${bullish ? 'text-emerald-300' : 'text-rose-300'}`}>{changeLabel}</span><span className={`basis-full font-mono ${bullish ? 'text-emerald-300' : 'text-rose-300'}`}>Volume {formatVolume(Number(inspected.volume))}</span></div>}
      {indicators.length > 0 && <div aria-label="Active indicators" style={{ top: `${overlayInset + 4}px` }} className="chart-indicator-legend pointer-events-auto absolute left-3 z-20 flex max-w-[calc(100%-7rem)] flex-col gap-px rounded-md px-1 py-0.5">{indicatorRows.map(({ indicator, value }) => <div key={indicator.id} className="group/indicator flex min-h-4 items-center gap-1 text-[10px] text-slate-400"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: indicator.color }}/><span className={`w-16 truncate font-mono font-semibold uppercase ${indicator.visible ? 'text-slate-300' : 'text-slate-600'}`}>{indicator.type} {indicator.period}</span><span className="font-mono text-[9px] text-slate-500">{value === null ? '—' : format(value)}</span><button type="button" aria-label={`${indicator.visible ? 'Hide' : 'Show'} ${indicator.type.toUpperCase()} ${indicator.period}`} title={indicator.visible ? 'Hide indicator' : 'Show indicator'} onClick={() => onToggleIndicator?.(indicator.id)} className="grid h-4 w-4 shrink-0 place-items-center rounded text-slate-600 opacity-0 hover:bg-slate-800 hover:text-slate-200 group-hover/indicator:opacity-100 group-focus-within/indicator:opacity-100"><Icon name={indicator.visible ? 'eye' : 'eyeOff'} className="h-3 w-3"/></button><button type="button" aria-label={`Configure ${indicator.type.toUpperCase()} ${indicator.period}`} title="Indicator settings" onClick={onOpenIndicators} className="grid h-4 w-4 shrink-0 place-items-center rounded text-slate-600 opacity-0 hover:bg-slate-800 hover:text-slate-200 group-hover/indicator:opacity-100 group-focus-within/indicator:opacity-100"><Icon name="settings" className="h-3 w-3"/></button><button type="button" aria-label={`Remove ${indicator.type.toUpperCase()} ${indicator.period}`} title="Remove indicator" onClick={() => onRemoveIndicator?.(indicator.id)} className="grid h-4 w-4 shrink-0 place-items-center rounded text-slate-600 opacity-0 hover:bg-slate-800 hover:text-slate-200 group-hover/indicator:opacity-100 group-focus-within/indicator:opacity-100"><Icon name="close" className="h-3 w-3"/></button></div>)}</div>}
      <svg ref={svg} onWheel={handleWheel} viewBox={`0 0 ${viewWidth} ${totalHeight}`} preserveAspectRatio="none" style={{ background: settings.background, touchAction: 'none' }} className={`h-full min-h-0 w-full flex-1 border border-slate-800 outline-none focus-visible:border-slate-600 ${priceAxisHover || pan.current?.mode === 'scale' ? 'cursor-ns-resize' : navigationTool(activeTool) ? (pan.current ? 'cursor-grabbing' : 'cursor-crosshair') : activeTool === 'aiCapture' ? 'cursor-crosshair' : 'cursor-cell'}`} role="img" tabIndex={0} aria-label={`${displaySymbol} ${frozen ? 'frozen backtest' : dataSource} ${settings.chartType === 'candles' ? 'candlesticks' : settings.chartType}, ${Math.ceil(visibleCount)} candles in ${settings.timezone} (${renderEnd - renderStart} of ${total} loaded). Smooth cursor-centered wheel zoom and horizontal time pan; right price axis controls display scale.`}
        onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { pan.current = null; edit.current = null; captureAction.current = null; setPriceAxisHover(false) }} onDoubleClick={event => { const rect = event.currentTarget.getBoundingClientRect(), px = rect.width > 0 ? (event.clientX - rect.left) / rect.width * viewWidth : event.clientX; if (px > left + width) { event.preventDefault(); resetPriceScale() } }} onContextMenu={event => { event.preventDefault(); if (activeTool === 'aiCapture') { setCapture(null); setCapturePrompt(''); setCaptureStatus(''); captureAction.current = null; onCancelTool?.(); return } if (draft || multi.current) { cancelDraft(); return } const rect = event.currentTarget.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top, px = x / Math.max(rect.width, 1) * viewWidth, py = y / Math.max(rect.height, 1) * totalHeight; setContextMenu({ kind: px > left + width ? 'price' : py > axisBottom ? 'time' : 'chart', x, y }) }} onPointerLeave={() => { setPriceAxisHover(false); if (!pan.current && !edit.current && !captureAction.current) setCrosshair(null) }}>
        <defs><linearGradient id="quant-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a39d91" stopOpacity=".24"/><stop offset="1" stopColor="#a39d91" stopOpacity=".02"/></linearGradient><marker id="quant-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 8 4 0 8Z" fill="context-stroke"/></marker></defs>
        <rect width={viewWidth} height={totalHeight} fill={settings.background}/>
        {frozen && <text x="-1000" y="-1000" aria-hidden="true" style={{ display: 'none' }}>{settings.showOhlc ? `O ${inspected.open} H ${inspected.high} L ${inspected.low} C ${inspected.close} V ${inspected.volume}` : ''}</text>}
        {futureX > left + 8 && futureX < left + width - 8 && <g data-testid="future-space"><line x1={futureX} x2={futureX} y1={top} y2={chartBottom} stroke={settings.separatorColor} strokeDasharray="5 5" opacity=".65"/><text x={futureX + 6} y={top + 16} fill="#77736d" fontSize="9">Future · no data</text></g>}
        {timeTicks.map(tick => <g key={tick.time}><line x1={xTime(tick.time)} y1={top} x2={xTime(tick.time)} y2={chartBottom} stroke={settings.gridColor} strokeWidth="1" strokeDasharray="4 4" opacity="0.3"/><text x={xTime(tick.time)} y={axisBottom + 14} textAnchor="middle" fontSize="10" fill="#9ca3af">{tick.label}</text></g>)}
        {settings.showGrid && Array.from({ length: 6 }, (_, position) => <line key={`v-${position}`} x1={left + width * position / 5} x2={left + width * position / 5} y1={top} y2={chartBottom} stroke={settings.gridColor} opacity=".3"/>)}
        {hasVolume && (() => { const maximum = Math.max(...visibleItems.map(item => Number(item.volume)), 1); return <g data-pane="volume"><line x1={left} x2={left + width} y1={volumeTop - 8} y2={volumeTop - 8} stroke={settings.separatorColor}/><text x={left + 4} y={volumeTop + 13} fill="#aaa59d" fontSize="10">Volume</text>{visibleItems.map((candle, local) => { const height = Number(candle.volume) / maximum * 52, x = xIndex(candlePosition(local)); return <rect key={`volume-${candle.ordinal}`} x={x - bodyWidth / 2} y={volumeBottom - height} width={bodyWidth} height={height} fill={Number(candle.close) >= Number(candle.open) ? settings.bullColor : settings.bearColor} opacity=".52"/> })}</g> })()}
        {settings.chartType === 'area' && <path d={areaPath} fill="url(#quant-area)" stroke="#d0ccc3" strokeWidth="1.5"/>}
        {settings.chartType === 'line' && <polyline points={linePoints} fill="none" stroke="#d0ccc3" strokeWidth="1.7"/>}
        {(settings.chartType === 'candles' || settings.chartType === 'bars') && visibleItems.map((candle, local) => { const position = candlePosition(local), x = xIndex(position), open = Number(candle.open), close = Number(candle.close), color = close >= open ? settings.bullColor : settings.bearColor; if (settings.chartType === 'bars') return <g key={candle.ordinal}><line x1={x} x2={x} y1={yPrice(Number(candle.high))} y2={yPrice(Number(candle.low))} stroke={color}/><line x1={x - bodyWidth / 2} x2={x} y1={yPrice(open)} y2={yPrice(open)} stroke={color}/><line x1={x} x2={x + bodyWidth / 2} y1={yPrice(close)} y2={yPrice(close)} stroke={color}/></g>; return <g key={candle.ordinal}>{settings.candleWicks && <line x1={x} x2={x} y1={yPrice(Number(candle.high))} y2={yPrice(Number(candle.low))} stroke={color}/>}<rect x={x - bodyWidth / 2} y={Math.min(yPrice(open), yPrice(close))} width={bodyWidth} height={Math.max(1, Math.abs(yPrice(open) - yPrice(close)))} fill={color} stroke={settings.candleBorders ? settings.background : color} strokeWidth={settings.candleBorders ? .6 : 0}/></g> })}
        {visibleIndicators.filter(item => !['rsi', 'macd', 'atr'].includes(item.type)).map(indicator => <g key={indicator.id}><polyline points={pointsFor(indicator.values, yPrice)} fill="none" stroke={indicator.color} strokeWidth="1.45"/>{indicator.type === 'bollinger' && indicator.bands && <><polyline points={pointsFor(indicator.bands.upper, yPrice)} fill="none" stroke={indicator.color} strokeOpacity=".62" strokeWidth="1" strokeDasharray="3 3"/><polyline points={pointsFor(indicator.bands.lower, yPrice)} fill="none" stroke={indicator.color} strokeOpacity=".62" strokeWidth="1" strokeDasharray="3 3"/></>}</g>)}
        {(settings.showPriceLine || settings.showLastValue) && <g>{settings.showPriceLine && <line x1={left} x2={left + width} y1={yPrice(lastClose)} y2={yPrice(lastClose)} stroke="#9a958c" strokeDasharray="3 3" opacity=".7"/>}{settings.showLastValue && <><rect x={left + width + 3} y={yPrice(lastClose) - 8} width={right - 8} height="16" rx="2" fill={lastColor}/><text x={left + width + 7} y={yPrice(lastClose) + 4} fill="#f8f6f0" fontSize="10" fontFamily="monospace">{formatPrice(lastClose)}</text></>}</g>}
        {markers.filter(marker => marker.barIndex >= visibleItems[0].ordinal && marker.barIndex <= visibleItems.at(-1)!.ordinal).map(marker => { const position = page.items.findIndex(item => item.ordinal >= marker.barIndex), color = marker.kind === 'ENTRY' ? '#16a085' : marker.kind === 'EXIT' ? '#f04452' : '#d7a44a'; return <circle key={marker.id} cx={xIndex(position)} cy={top + 12} r="4" fill={color}><title>{`${marker.kind} · bar ${marker.barIndex} · event ${marker.id}`}</title></circle> })}
        {drawings.concat(draft ? [draft] : []).map(drawingShape)}
        {oscillatorIndicators.map((indicator, paneIndex) => { const panelTop = paneTop(paneIndex), panelHeight = oscillatorHeight(indicator), series = indicator.values.slice(renderStart, renderEnd).filter((value): value is number => value !== null), bounded = indicator.type === 'rsi' || indicator.type === 'stochastic', minimum = bounded ? 0 : Math.min(...series, 0), maximum = bounded ? 100 : Math.max(...series, 0), padding = Math.max((maximum - minimum) * .12, 1e-8), lower = minimum - padding, upper = maximum + padding, scale = Math.max(upper - lower, 1e-8), y = (value: number) => panelTop + (upper - value) / scale * panelHeight; return <g key={indicator.id} data-pane="oscillator" data-indicator={indicator.type}><line x1={left} x2={left + width} y1={panelTop - 8} y2={panelTop - 8} stroke={settings.separatorColor}/><rect x={left} y={panelTop} width={width} height={panelHeight} fill="#191a1d"/><line x1={left} x2={left + width} y1={y(bounded ? 70 : 0)} y2={y(bounded ? 70 : 0)} stroke={settings.gridColor} strokeDasharray="3 4"/><line x1={left} x2={left + width} y1={y(bounded ? 30 : 0)} y2={y(bounded ? 30 : 0)} stroke={settings.gridColor} strokeDasharray="3 4"/><polyline points={pointsFor(indicator.values, y)} fill="none" stroke={indicator.color} strokeWidth="1.4"/><text x={left + 4} y={panelTop + 13} fill="#aaa59d" fontSize="10">{indicator.type.toUpperCase()}</text><text x={left + width + 8} y={panelTop + 10} fill="#817f7b" fontSize="9">{format(maximum)}</text><text x={left + width + 8} y={panelTop + panelHeight} fill="#817f7b" fontSize="9">{format(minimum)}</text></g> })}
        {crosshair && settings.showCrosshair && navigationTool(activeTool) && !pan.current && <g pointerEvents="none"><line x1={crosshair.x} x2={crosshair.x} y1={top} y2={paneBottom} stroke="#99958d" strokeDasharray="3 3" opacity=".58"/><line x1={left} x2={left + width} y1={crosshair.y} y2={crosshair.y} stroke="#99958d" strokeDasharray="3 3" opacity=".58"/><rect x={left + width + 3} y={crosshair.y - 8} width={right - 8} height="16" rx="2" fill="#323337"/><text x={left + width + 7} y={crosshair.y + 4} fill="#e1ddd5" fontSize="10" fontFamily="monospace">{formatPrice(crossPrice!)}</text><rect x={crosshair.x - 44} y={axisBottom + 4} width="88" height="16" rx="2" fill="#323337"/><text x={crosshair.x} y={axisBottom + 15} textAnchor="middle" fill="#e1ddd5" fontSize="9">{formatTime(page.items[index].time)}</text></g>}
        {!sourceLabel && <g aria-label="Chart status overlay" pointerEvents="none">
          <rect x={left} y="4" width={width} height={Math.max(1, top - 8)} fill={settings.background} opacity=".92" />
          {settings.showSymbol || settings.showOhlc ? <>
            <text x={left + 6} y="19" className={statusClass} fill="#e7e2d9" fontSize="11" fontWeight="650">{statusText}</text>
          </> : null}
          {settings.showVolume && <text x={left + 6} y="35" fill="#a9a39a" fontSize="10">Volume {inspected.volume}</text>}
        </g>}
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
              <text x={left + width + 5} y={yPrice(val) + 4} fill="#817f7b" fontSize="10">{formatPrice(val)}</text>
            </g>
          ))
        })()}
        {activeTool === 'aiCapture' && <g data-capture-overlay>
          {capture && capture.width >= 1 && capture.height >= 1 && <><rect x={left} y={top} width={width} height={Math.max(0, capture.y - top)} fill="#020304" fillOpacity=".58"/><rect x={left} y={capture.y} width={Math.max(0, capture.x - left)} height={capture.height} fill="#020304" fillOpacity=".58"/><rect x={capture.x + capture.width} y={capture.y} width={Math.max(0, left + width - capture.x - capture.width)} height={capture.height} fill="#020304" fillOpacity=".58"/><rect x={left} y={capture.y + capture.height} width={width} height={Math.max(0, chartBottom - capture.y - capture.height)} fill="#020304" fillOpacity=".58"/><rect data-capture-selection x={capture.x} y={capture.y} width={capture.width} height={capture.height} fill="#f8fafc" fillOpacity=".04" stroke="#d8dee8" strokeWidth="1.2" strokeDasharray="5 3" onPointerDown={event => beginCaptureHandle(event, 'move')} />{captureHandles.map(handle => <rect key={handle.key} data-capture-handle={handle.key} x={handle.x - 5} y={handle.y - 5} width="10" height="10" rx="2" fill="#f8fafc" stroke="#20242b" strokeWidth="1.5" style={{ cursor: handle.cursor }} onPointerDown={event => beginCaptureHandle(event, 'resize', handle.key)} />)}</>}
        </g>}
      </svg>
      {contextMenu && <div role="menu" aria-label={`${contextMenu.kind} chart context menu`} data-testid="chart-context-menu" className="absolute z-50 min-w-44 rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-2xl" style={{ left: `${Math.min(Math.max(contextMenu.x, 4), Math.max(4, viewWidth - 190)) / Math.max(viewWidth, 1) * 100}%`, top: `${Math.min(Math.max(contextMenu.y, 4), Math.max(4, totalHeight - 160)) / Math.max(totalHeight, 1) * 100}%` }} onPointerDown={event => event.stopPropagation()}>
        <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500">{contextMenu.kind === 'price' ? 'Price scale' : contextMenu.kind === 'time' ? 'Time axis' : 'Chart'}</p>
        {(contextMenu.kind === 'chart' || contextMenu.kind === 'time') && <button type="button" role="menuitem" onClick={() => { resetView(); setContextMenu(null) }} className="flex min-h-8 w-full items-center rounded-md px-2 text-left text-xs text-slate-300 hover:bg-slate-800">Go to realtime</button>}
        {contextMenu.kind === 'chart' && <><button type="button" role="menuitem" onClick={() => { onUndo?.(); setContextMenu(null) }} className="flex min-h-8 w-full items-center rounded-md px-2 text-left text-xs text-slate-300 hover:bg-slate-800">Undo drawing</button><button type="button" role="menuitem" onClick={() => { onRedo?.(); setContextMenu(null) }} className="flex min-h-8 w-full items-center rounded-md px-2 text-left text-xs text-slate-300 hover:bg-slate-800">Redo drawing</button><button type="button" role="menuitem" onClick={() => { onOpenSettings?.(); setContextMenu(null) }} className="flex min-h-8 w-full items-center rounded-md px-2 text-left text-xs text-slate-300 hover:bg-slate-800">Chart settings</button></>}
        {contextMenu.kind === 'price' && <button type="button" role="menuitem" onClick={() => { resetPriceScale(); setContextMenu(null) }} className="flex min-h-8 w-full items-center rounded-md px-2 text-left text-xs text-slate-300 hover:bg-slate-800">Auto-fit price scale</button>}
      </div>}
      {activeTool === 'aiCapture' && capture && capture.width >= 24 && capture.height >= 24 && <div data-testid="chart-capture-prompt" className="absolute z-40 flex w-[min(360px,calc(100%-1rem))] items-center gap-1 rounded-lg border border-slate-600 bg-slate-900/95 p-1.5 shadow-2xl" style={{ left: `${Math.min(76, Math.max(2, capture.x / viewWidth * 100))}%`, top: `${Math.min(82, Math.max(12, (capture.y + capture.height + 8) / totalHeight * 100))}%` }} onPointerDown={event => event.stopPropagation()}><input aria-label="Ask Quant about this area" value={capturePrompt} onChange={event => setCapturePrompt(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setCapture(null); setCapturePrompt(''); setCaptureStatus(''); captureAction.current = null; onCancelTool?.(); return } if (event.key === 'Enter') { event.preventDefault(); void submitCapture() } }} placeholder="Ask Quant about this area…" className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500" autoFocus /><button type="button" aria-label="Send chart capture to Assistant" title="Send to Assistant" onClick={() => void submitCapture()} className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-slate-200 text-slate-950 hover:bg-white"><Icon name="send" className="h-3.5 w-3.5" /></button><button type="button" aria-label="Exit chart capture" title="Exit capture" onClick={() => { setCapture(null); setCapturePrompt(''); setCaptureStatus(''); captureAction.current = null; onCancelTool?.() }} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white"><Icon name="close" className="h-3.5 w-3.5" /></button></div>}
      {captureStatus && <p role="status" className="absolute bottom-12 left-3 z-40 rounded-md border border-slate-700 bg-slate-900/95 px-2 py-1 text-[10px] text-slate-300">{captureStatus}</p>}
      {hasRsi && <div role="separator" aria-label="Resize RSI pane" aria-orientation="horizontal" aria-valuemin={64} aria-valuemax={180} aria-valuenow={boundedRsi} tabIndex={0} style={{ top: `${(rsiTop - 13) / totalHeight * 100}%` }} className="group absolute left-3 right-[78px] z-30 h-3 -translate-y-1/2 cursor-row-resize touch-none" onPointerDown={event => { event.preventDefault(); const start = event.clientY, initial = rsiHeight; event.currentTarget.setPointerCapture(event.pointerId); const move = (next: PointerEvent) => setRsiHeight(clamp(initial - (next.clientY - start) * totalHeight / Math.max(svg.current?.getBoundingClientRect().height ?? totalHeight, 1), 64, 180)); const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop) }} onKeyDown={event => { if (event.key === 'ArrowUp') setRsiHeight(value => clamp(value + 8, 64, 180)); if (event.key === 'ArrowDown') setRsiHeight(value => clamp(value - 8, 64, 180)) }}><span className="absolute left-1/2 top-1/2 h-0.5 w-12 -translate-x-1/2 -translate-y-1/2 rounded bg-slate-600 opacity-0 transition group-hover:opacity-100"/></div>}
      <div className="absolute bottom-2 left-3 flex items-center gap-1 rounded-md border border-slate-800 bg-[#1c1d20]/88 p-0.5 text-[9px] text-slate-500"><span className="sr-only">{Math.floor(visibleStart) + 1}–{Math.min(total, Math.ceil(visibleStart + visibleCount))} / {total} loaded; {Math.max(0, Math.round(visibleCount))} visible bars</span>{manualPrices && <button type="button" aria-label="Auto-fit price scale" title="Auto-fit price scale" onClick={resetPriceScale} className="rounded px-1.5 text-slate-300 hover:bg-slate-800 hover:text-white">Auto</button>}<button type="button" aria-label="Go to realtime" title="Go to realtime" onClick={resetView} className={`rounded px-1.5 ${isFollowingLatest ? 'text-slate-600' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>Realtime</button><button type="button" aria-label="Reset chart view" title="Reset Chart · 0" data-tooltip="Reset · 0" onClick={resetView} disabled={visibleStart === 0 && Math.abs(visibleCount - total) < .01 && !manualPrices} className="icon-tool grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-35"><Icon name="reset" className="h-3.5 w-3.5"/></button></div>
    </div>
  </div>
}
