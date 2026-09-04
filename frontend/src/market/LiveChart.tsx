import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ChartToolsRail, ChartUtilities } from '../components/ChartControls'
import { ChartClock, ChartSettingsModal, IndicatorLibraryModal, SymbolSearchModal, createIndicator } from '../components/ChartWorkspacePanels'
import { Icon } from '../components/Icon'
import type { Candle } from './api'
import { CandleChart } from './CandleChart'
import { TIMEFRAMES, timeframeLabel, type Timeframe } from './chartMath'
import { defaultChartSettings, type ChartSettings, type ChartType, type Drawing, type DrawingTool, type IndicatorConfig, type MagnetMode } from './chartTypes'
import { COINBASE_DEFAULT_SYMBOLS, DEFAULT_INSTRUMENTS, formatMarketPrice, mergeCandles, type Instrument, type LiveConnectionStatus, type LiveSymbol, type MarketCandle, type MarketDataProvider } from './liveMarket'
import { marketDataProvider } from './MarketDataProviders'
import { sendChartCaptureToAssistant } from './chartCapture'

const iconButton = 'icon-tool grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-35'
const liveClass: Record<LiveConnectionStatus, string> = { LIVE: 'bg-emerald-400', DELAYED: 'bg-amber-300', CONNECTING: 'bg-amber-300 animate-pulse', RECONNECTING: 'bg-amber-300 animate-pulse', DISCONNECTED: 'bg-rose-400' }
const INITIAL_HISTORY_BARS = 900, HISTORY_PAGE_SIZE = 300, MAX_CACHED_BARS = 20_000
const historyCache = new Map<string, MarketCandle[]>()
const cacheKey = (symbol: LiveSymbol, timeframe: Timeframe, before?: number) => `${symbol}|${timeframe}|${before ?? 'latest'}`
type HistoryRequest = { symbol: LiveSymbol; interval: Timeframe; limit: number; before?: number; signal?: AbortSignal }
type SharedHistoryRequest = { controller: AbortController; consumers: number; promise: Promise<MarketCandle[]> }
const historyInFlight = new Map<string, SharedHistoryRequest>()
const loadHistorical = (provider: MarketDataProvider, request: HistoryRequest, key: string) => {
  const cached = historyCache.get(key)
  if (cached?.length) return Promise.resolve(cached)
  let shared = historyInFlight.get(key)
  if (!shared) {
    const controller = new AbortController()
    shared = { controller, consumers: 0, promise: provider.getHistoricalCandles({ ...request, signal: controller.signal }).finally(() => historyInFlight.delete(key)) }
    historyInFlight.set(key, shared)
  }
  const entry = shared
  entry.consumers += 1
  let released = false
  const release = () => {
    if (released) return
    released = true
    entry.consumers -= 1
    if (entry.consumers === 0 && historyInFlight.get(key) === entry) entry.controller.abort()
  }
  request.signal?.addEventListener('abort', release, { once: true })
  return entry.promise.finally(() => { request.signal?.removeEventListener('abort', release); release() })
}
const asChartCandle = (candle: MarketCandle, ordinal: number): Candle => ({
  ordinal, time: new Date(candle.openTime).toISOString().replace('.000Z', 'Z'), open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume,
})

type ChartCellState = {
  symbol: LiveSymbol
  timeframe: Timeframe
  candles: MarketCandle[]
  drawings: Drawing[]
  indicators: IndicatorConfig[]
  chartType: ChartType
  settings: ChartSettings
}

const createChartCell = (): ChartCellState => ({ symbol: 'BTC-USD', timeframe: '1m', candles: [], drawings: [], indicators: [], chartType: 'candles', settings: { ...defaultChartSettings } })

export function LiveChart({ workspaceNavigation, provider = marketDataProvider }: { workspaceNavigation?: ReactNode; provider?: MarketDataProvider } = {}) {
  const unitTestDefaultProvider = provider === marketDataProvider && typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom')
  const [cells, setCells] = useState<Record<string, ChartCellState>>({ c1: createChartCell() }), [symbols, setSymbols] = useState<LiveSymbol[]>([...COINBASE_DEFAULT_SYMBOLS]), [instruments, setInstruments] = useState<Instrument[]>(DEFAULT_INSTRUMENTS)
  const [status, setStatus] = useState<LiveConnectionStatus>(unitTestDefaultProvider ? 'DISCONNECTED' : 'CONNECTING')
  const [loading, setLoading] = useState(!unitTestDefaultProvider), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  const [tool, setTool] = useState<DrawingTool>('cursor'), [selectedDrawing, setSelectedDrawing] = useState<string | null>(null)
  const [magnet, setMagnet] = useState<MagnetMode>('off'), [stayInMode, setStayInMode] = useState(false)
  const [indicatorOpen, setIndicatorOpen] = useState(false), [indicatorSearch, setIndicatorSearch] = useState(''), [symbolSearchOpen, setSymbolSearchOpen] = useState(false), [symbolSearch, setSymbolSearch] = useState(''), [settingsOpen, setSettingsOpen] = useState(false)
  const [layout, setLayout] = useState<'1' | '2H' | '2V' | '4' | '8'>('1'), [activeCell, setActiveCell] = useState('c1'), [olderLoading, setOlderLoading] = useState(false)
  const [split, setSplit] = useState({ x: .5, y: .5 })
  const olderBefore = useRef<number | null>(null)
  const drawingHistory = useRef<Record<string, { past: Drawing[][]; future: Drawing[][] }>>({})
  const activeState = cells[activeCell] ?? createChartCell()
  const { symbol, timeframe, candles, drawings, indicators, chartType, settings } = activeState
  const updateCell = (id: string, update: (cell: ChartCellState) => ChartCellState) => setCells(current => ({ ...current, [id]: update(current[id] ?? createChartCell()) }))
  const updateActiveCell = (update: (cell: ChartCellState) => ChartCellState) => updateCell(activeCell, update)
  const setSymbol = (next: LiveSymbol) => updateActiveCell(cell => ({ ...cell, symbol: next }))
  const setTimeframe = (next: Timeframe) => updateActiveCell(cell => ({ ...cell, timeframe: next }))
  const setCandles = (update: MarketCandle[] | ((current: MarketCandle[]) => MarketCandle[])) => updateActiveCell(cell => ({ ...cell, candles: typeof update === 'function' ? update(cell.candles) : update }))
  const setDrawings = (update: Drawing[] | ((current: Drawing[]) => Drawing[])) => setCells(current => { const cell = current[activeCell] ?? createChartCell(), next = typeof update === 'function' ? update(cell.drawings) : update; if (JSON.stringify(next) === JSON.stringify(cell.drawings)) return current; const history = drawingHistory.current[activeCell] ?? { past: [], future: [] }; history.past.push(cell.drawings); history.future = []; drawingHistory.current[activeCell] = history; return { ...current, [activeCell]: { ...cell, drawings: next } } })
  const updateDrawingsTransient = (update: Drawing[] | ((current: Drawing[]) => Drawing[])) => updateActiveCell(cell => ({ ...cell, drawings: typeof update === 'function' ? update(cell.drawings) : update }))
  const setIndicators = (update: IndicatorConfig[] | ((current: IndicatorConfig[]) => IndicatorConfig[])) => updateActiveCell(cell => ({ ...cell, indicators: typeof update === 'function' ? update(cell.indicators) : update }))
  const setChartType = (next: ChartType) => updateActiveCell(cell => ({ ...cell, chartType: next }))
  const selectCell = (id: string) => { setCells(current => current[id] ? current : { ...current, [id]: createChartCell() }); setActiveCell(id) }
  const activeInstrument = instruments.find(item => item.symbol === symbol) ?? { symbol, name: symbol, assetClass: 'CRYPTO' as const, provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: settings.priceIncrement ?? .01, pricePrecision: settings.pricePrecision ?? 2, modes: ['HISTORICAL', 'REALTIME'] as const }
  const updateSettings = (next: ChartSettings) => updateActiveCell(cell => ({ ...cell, settings: next }))
  const undoDrawing = () => setCells(current => { const cell = current[activeCell] ?? createChartCell(), history = drawingHistory.current[activeCell]; const previous = history?.past.pop(); if (!previous) return current; history.future.push(cell.drawings); return { ...current, [activeCell]: { ...cell, drawings: previous } } })
  const redoDrawing = () => setCells(current => { const cell = current[activeCell] ?? createChartCell(), history = drawingHistory.current[activeCell]; const next = history?.future.pop(); if (!next) return current; history.past.push(cell.drawings); return { ...current, [activeCell]: { ...cell, drawings: next } } })

  useEffect(() => {
    if (unitTestDefaultProvider) return
    const controller = new AbortController()
    const load = async () => {
      if (provider.listInstruments) {
        const items = await provider.listInstruments(controller.signal)
        if (items.length) { setInstruments(items); setSymbols(items.map(item => item.symbol)) }
      } else if (provider.listProducts) {
        const items = await provider.listProducts(controller.signal)
        if (items.length) { setSymbols(items); setInstruments(items.map(item => DEFAULT_INSTRUMENTS.find(defaultItem => defaultItem.symbol === item) ?? { symbol: item, name: item, assetClass: 'CRYPTO', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: .01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] } as Instrument)) }
      }
    }
    void load().catch(() => { /* Default entitled symbols remain available offline. */ })
    return () => controller.abort()
  }, [provider, unitTestDefaultProvider])

  useEffect(() => {
    if (!symbolSearchOpen || !provider.searchInstruments || !symbolSearch.trim()) return
    const controller = new AbortController()
    void provider.searchInstruments(symbolSearch, controller.signal).then(items => { if (items.length) setInstruments(items) }).catch(() => { /* Search remains local when provider search is unavailable. */ })
    return () => controller.abort()
  }, [provider, symbolSearch, symbolSearchOpen])

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return
      if (!event.altKey) return
      const next: DrawingTool | null = event.key.toLowerCase() === 't' ? 'trend' : event.key.toLowerCase() === 'h' ? 'horizontal' : event.key.toLowerCase() === 'v' ? 'vertical' : null
      if (next) { event.preventDefault(); setTool(next) }
    }
    window.addEventListener('keydown', shortcuts)
    return () => window.removeEventListener('keydown', shortcuts)
  }, [])

  useEffect(() => {
    if (unitTestDefaultProvider) return
    let active = true, unsubscribe = () => {}
    const controller = new AbortController()
    const mergeHistory = async (keepCurrent: boolean) => {
      const key = cacheKey(symbol, timeframe), history = await loadHistorical(provider, { symbol, interval: timeframe, limit: INITIAL_HISTORY_BARS, signal: controller.signal }, key)
      if (!active) return
      historyCache.set(key, history.slice(-MAX_CACHED_BARS))
      setCandles(current => keepCurrent ? history.reduce(mergeCandles, current).slice(-MAX_CACHED_BARS) : history.slice(-MAX_CACHED_BARS))
      return history
    }
    const start = async () => {
      setLoading(true); setError(''); setStatus('CONNECTING'); setCandles([]); setSelectedDrawing(null); setTool('cursor'); olderBefore.current = null
      try {
        const history = await mergeHistory(false)
        if (!active || !history) return
        unsubscribe = provider.subscribeCandles({ symbol, interval: timeframe, seed: history.at(-1) }, {
          onCandle: candle => { if (active) setCandles(current => { const next = mergeCandles(current, candle).slice(-MAX_CACHED_BARS); historyCache.set(cacheKey(symbol, timeframe), next); return next }) },
          onStatus: next => { if (active) setStatus(next) },
          onReconnect: () => { void mergeHistory(true).catch(() => { if (active) setError('Live stream reconnected, but latest history could not be refreshed.') }) },
        })
      } catch (cause) {
        if (active && !(cause instanceof DOMException && cause.name === 'AbortError')) { setError(cause instanceof Error ? cause.message : 'Failed to load market data.'); setStatus('DISCONNECTED') }
      } finally { if (active) setLoading(false) }
    }
    void start()
    return () => { active = false; controller.abort(); unsubscribe() }
  }, [activeCell, attempt, provider, symbol, timeframe, unitTestDefaultProvider])

  const loadOlder = async () => {
    const before = candles[0]?.openTime
    if (!before || olderLoading || candles.length >= MAX_CACHED_BARS || olderBefore.current === before) return
    olderBefore.current = before; setOlderLoading(true)
    try {
      const key = cacheKey(symbol, timeframe, before), older = await loadHistorical(provider, { symbol, interval: timeframe, limit: HISTORY_PAGE_SIZE, before: before - 1 }, key)
      historyCache.set(key, older)
      if (older.length) setCandles(current => { const next = older.reduce(mergeCandles, current).slice(0, MAX_CACHED_BARS); historyCache.set(cacheKey(symbol, timeframe), next); return next })
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Failed to load older market candles.')
    } finally { setOlderLoading(false) }
  }

  const page = useMemo(() => ({ dataset: { symbol }, items: candles.map(asChartCandle) }), [candles, symbol])
  const latest = candles.at(-1)
  const locked = drawings.length > 0 && drawings.every(drawing => drawing.locked)
  const hidden = drawings.length > 0 && drawings.every(drawing => drawing.visible === false)
  const removeSelected = () => { if (selectedDrawing) { setDrawings(items => items.filter(item => item.id !== selectedDrawing)); setSelectedDrawing(null) } }
  const sendFullChart = async (blob: Blob) => { if (!candles.length) throw new Error('No chart is available to capture.'); const from = new Date(candles[0].openTime).toISOString(), to = new Date(candles.at(-1)!.openTime).toISOString(); await sendChartCaptureToAssistant({ blob, prompt: 'Please inspect this full active chart and explain the visible evidence.', context: { symbol, provider: activeInstrument.provider, timeframe: timeframeLabel(timeframe), visibleTimeRange: { from, to }, capturedTimeRange: { from, to }, approximateCapturedPriceRange: { lower: Math.min(...candles.map(candle => Number(candle.low))), upper: Math.max(...candles.map(candle => Number(candle.high))) }, currentPrice: Number(candles.at(-1)!.close), selectedDrawingIds: selectedDrawing ? [selectedDrawing] : [] }, region: { x: 0, y: 0, width: 1, height: 1 }, fullChart: true }) }
  const selectInstrument = (instrument: Instrument) => { setSymbol(instrument.symbol); updateActiveCell(cell => ({ ...cell, settings: { ...cell.settings, priceIncrement: instrument.priceIncrement, pricePrecision: instrument.pricePrecision } })); setSymbolSearchOpen(false); setSymbolSearch('') }
  const resetSplitter = (axis: 'x' | 'y') => setSplit(value => ({ ...value, [axis]: .5 }))
  const beginSplitter = (axis: 'x' | 'y', event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); const grid = event.currentTarget.parentElement?.getBoundingClientRect(), start = axis === 'x' ? event.clientX : event.clientY, initial = split[axis], size = axis === 'x' ? grid?.width ?? window.innerWidth : grid?.height ?? window.innerHeight, move = (next: PointerEvent) => { setSplit(value => ({ ...value, [axis]: Math.max(.25, Math.min(.75, initial + ((axis === 'x' ? next.clientX : next.clientY) - start) / Math.max(size, 1))) })) }, stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop)
  }
  const chartCount = layout === '1' ? 1 : layout === '2H' || layout === '2V' ? 2 : layout === '4' ? 4 : 8
  const gridClass = layout === '2H' ? 'grid-cols-2 grid-rows-1' : layout === '2V' ? 'grid-cols-1 grid-rows-2' : layout === '4' ? 'grid-cols-2 grid-rows-2' : layout === '8' ? 'grid-cols-4 grid-rows-2' : 'grid-cols-1 grid-rows-1'
  const gridStyle = { gridTemplateColumns: layout === '2H' || layout === '4' ? `${split.x}fr ${1 - split.x}fr` : layout === '2V' ? '1fr' : layout === '8' ? 'repeat(4, minmax(0, 1fr))' : '1fr', gridTemplateRows: layout === '2V' || layout === '4' || layout === '8' ? `${split.y}fr ${1 - split.y}fr` : '1fr' }

  const chartSource = `${activeInstrument.provider} · ${activeInstrument.feed ?? 'configured'}`
  return <section aria-label="Chart" data-testid="chart-view" className="relative flex h-full min-h-0 flex-col overflow-hidden">
    <header data-testid="chart-toolbar" className="flex min-h-10 shrink-0 flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-925 px-2 py-1 sm:flex-nowrap">
      <div data-testid="chart-left-cluster" className="flex min-w-0 items-center gap-1"><button type="button" aria-label="Open Symbol Search" title="Symbol Search" onClick={() => setSymbolSearchOpen(true)} className={`${iconButton} shrink-0`}><Icon name="search" className="h-4 w-4" /></button><label className="flex h-8 min-w-0 items-center gap-1.5"><span className="sr-only">Symbol</span><select aria-label="Symbol" value={symbol} onChange={event => setSymbol(event.target.value as LiveSymbol)} className="h-8 max-w-36 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs font-semibold text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-300">{symbols.map(value => <option key={value} value={value}>{value}</option>)}</select><span aria-label={chartSource.startsWith('COINBASE') ? `Coinbase · ${status}` : `${chartSource} · ${status}`} title={`${chartSource} · ${status}`} className={`h-1.5 w-1.5 shrink-0 rounded-full ${liveClass[status]}`} /></label><label className="flex h-8 items-center"><span className="sr-only">Timeframe</span><select aria-label="Timeframe" value={timeframe} onChange={event => setTimeframe(event.target.value as Timeframe)} className="h-8 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs font-semibold text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-300">{TIMEFRAMES.map(value => <option key={value} value={value}>{timeframeLabel(value)}</option>)}</select></label>{latest && <span aria-label="Current market price" className="hidden font-mono text-xs font-semibold text-slate-100 sm:inline">{formatMarketPrice(Number(latest.close), activeInstrument.priceIncrement, activeInstrument.pricePrecision)}</span>}</div>
      <div data-testid="chart-right-cluster" className="ml-auto flex min-w-0 items-center gap-1"><details className="relative"><summary aria-label="Chart type" title="Chart type" className={iconButton}><Icon name="candle" className="h-4 w-4" /></summary><div className="absolute right-0 top-9 z-40 w-40 rounded-lg border border-slate-700 bg-slate-900 p-1.5 shadow-2xl"><p className="px-2 py-1 text-[9px] uppercase tracking-wider text-slate-600">Chart type</p>{(['candles', 'bars', 'line', 'area'] as const).map(type => <button key={type} type="button" className={`flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs capitalize ${chartType === type ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'}`} onClick={event => { setChartType(type); event.currentTarget.closest('details')?.removeAttribute('open') }}>{type}{chartType === type && <span className="ml-auto">✓</span>}</button>)}</div></details>
        <details className="relative"><summary aria-label="Chart layout" title="Chart layout" className={iconButton}><Icon name="layout" className="h-4 w-4" /></summary><div className="absolute right-0 top-9 z-40 w-52 rounded-lg border border-slate-700 bg-slate-900 p-1.5 shadow-2xl"><p className="px-2 py-1 text-[9px] uppercase tracking-wider text-slate-600">Layout</p><div className="grid grid-cols-5 gap-1">{(['1', '2H', '2V', '4', '8'] as const).map(value => <button key={value} type="button" aria-label={`Layout ${value}`} aria-pressed={layout === value} className={`grid min-h-9 place-items-center rounded-md border text-[10px] ${layout === value ? 'border-slate-400 bg-slate-700 text-white' : 'border-slate-800 text-slate-400 hover:bg-slate-800'}`} onClick={event => { setLayout(value); selectCell('c1'); event.currentTarget.closest('details')?.removeAttribute('open') }}>{value}</button>)}</div></div></details>
        <button type="button" aria-label="Indicators" title="Indicators" onClick={() => setIndicatorOpen(true)} className={`${iconButton} ${indicators.length ? 'text-slate-100' : ''}`}><Icon name="indicator" className="h-4 w-4" /></button>
        <span className="mx-1 h-5 w-px shrink-0 bg-slate-800" aria-hidden="true" />
        <button type="button" aria-label="Undo drawing" title="Undo drawing · Ctrl/Cmd+Z" disabled={!drawingHistory.current[activeCell]?.past.length} onClick={undoDrawing} className={iconButton}><Icon name="undo" className="h-4 w-4" /></button><button type="button" aria-label="Redo drawing" title="Redo drawing · Ctrl/Cmd+Shift+Z" disabled={!drawingHistory.current[activeCell]?.future.length} onClick={redoDrawing} className={iconButton}><Icon name="redo" className="h-4 w-4" /></button>
        <button type="button" aria-label="Chart settings" title="Chart settings" onClick={() => setSettingsOpen(true)} className={iconButton}><Icon name="settings" className="h-4 w-4" /></button><ChartClock timezone={settings.timezone} onChange={value => updateSettings({ ...settings, timezone: value })} />
        {workspaceNavigation}<span className="mx-1 h-5 w-px shrink-0 bg-slate-800" aria-hidden="true"/><ChartUtilities hasChart={page.items.length > 0 || unitTestDefaultProvider} onRefresh={() => setAttempt(value => value + 1)} refreshing={loading} onSendAssistant={sendFullChart} /></div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      <ChartToolsRail selected={tool} onSelect={setTool} canDelete={!!selectedDrawing} hasDrawings={drawings.length > 0} onDelete={removeSelected} onClear={() => { setDrawings([]); setSelectedDrawing(null) }} magnet={magnet} onMagnetChange={setMagnet} stayInMode={stayInMode} onToggleStay={() => setStayInMode(value => !value)} allDrawingsLocked={locked} onToggleLockAll={() => setDrawings(items => items.map(item => ({ ...item, locked: !locked })))} allDrawingsHidden={hidden} onToggleHideAll={() => setDrawings(items => items.map(item => ({ ...item, visible: hidden })))} />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading && <p role="status" className="m-auto text-sm text-slate-400">Loading {chartSource} historical candles…</p>}
        {olderLoading && <p role="status" className="pointer-events-none absolute left-2 top-2 z-30 rounded bg-slate-900/90 px-2 py-1 text-[10px] text-slate-500">Loading older candles…</p>}
        {error && <div className="m-auto max-w-sm text-center"><p role="alert" className="text-sm text-rose-300">{error}</p><button type="button" className="mt-3 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700" onClick={() => setAttempt(value => value + 1)}>Retry market data</button></div>}
        {!error && (page.items.length > 0 || Object.values(cells).some(cell => cell.candles.length > 0)) && <div className={`relative grid min-h-0 flex-1 gap-px bg-slate-800 ${gridClass}`} style={gridStyle} data-testid="chart-grid" data-chart-export>{Array.from({ length: chartCount }, (_, index) => { const id = `c${index + 1}`, active = id === activeCell, cell = cells[id] ?? createChartCell(), cellPage = { dataset: { symbol: cell.symbol }, items: cell.candles.map(asChartCandle) }; return <div key={id} role="button" tabIndex={0} aria-label={`Chart cell ${index + 1}`} aria-pressed={active} onClick={() => selectCell(id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCell(id) } }} className={`relative min-h-0 min-w-0 overflow-hidden bg-[#141518] ${active ? 'ring-1 ring-inset ring-slate-400' : ''}`}><div className="pointer-events-none absolute right-2 top-1 z-20 rounded bg-slate-950/70 px-1.5 py-0.5 text-[9px] text-slate-500">{id}{active ? ' · active' : ''}</div>{cell.candles.length > 0 ? <CandleChart page={cellPage} dataSource="live Coinbase" sourceLabel={chartSource} timeframe={timeframeLabel(cell.timeframe)} settings={{ ...cell.settings, chartType: cell.chartType }} indicators={active ? indicators : cell.indicators} activeTool={active ? tool : 'cursor'} drawings={active ? drawings : cell.drawings} selectedDrawingId={active ? selectedDrawing : null} magnet={magnet} stayInMode={stayInMode} onSelectDrawing={active ? setSelectedDrawing : undefined} onDeleteSelected={active ? removeSelected : undefined} onDeleteDrawing={active ? id => { setDrawings(items => items.filter(item => item.id !== id)); setSelectedDrawing(null) } : undefined} onUndo={active ? undoDrawing : undefined} onRedo={active ? redoDrawing : undefined} onCancelTool={() => setTool('cursor')} onUpdateDrawing={active ? drawing => updateDrawingsTransient(items => items.map(item => item.id === drawing.id ? drawing : item)) : undefined} onCommitDrawingEdit={active ? (before, after) => { updateDrawingsTransient(items => items.map(item => item.id === after.id ? after : item)); setCells(current => { const cell = current[activeCell] ?? createChartCell(), history = drawingHistory.current[activeCell] ?? { past: [], future: [] }; history.past.push(cell.drawings.map(item => item.id === after.id ? before : item)); history.future = []; drawingHistory.current[activeCell] = history; return { ...current } }) } : undefined} onAddDrawing={active ? drawing => { setDrawings(items => [...items, drawing]); setSelectedDrawing(drawing.id) } : undefined} onToggleIndicator={active ? id => setIndicators(items => items.map(item => item.id === id ? { ...item, visible: !item.visible } : item)) : undefined} onRemoveIndicator={active ? id => setIndicators(items => items.filter(item => item.id !== id)) : undefined} onOpenIndicators={active ? () => setIndicatorOpen(true) : undefined} onOpenSettings={active ? () => setSettingsOpen(true) : undefined} onRequestOlder={active ? () => void loadOlder() : undefined} /> : <p className="grid h-full place-items-center text-[10px] text-slate-600">Select this cell to load its chart</p>}</div> })}{layout !== '1' && layout !== '2V' && layout !== '8' && <div role="separator" aria-label="Vertical chart splitter" tabIndex={0} className="absolute top-0 z-30 h-full w-1 -translate-x-1/2 cursor-col-resize bg-slate-700/60 hover:bg-slate-400" style={{ left: `${split.x * 100}%` }} onPointerDown={event => beginSplitter('x', event)} onDoubleClick={() => resetSplitter('x')} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); resetSplitter('x') } }} />}{layout === '2V' || layout === '4' || layout === '8' ? <div role="separator" aria-label="Horizontal chart splitter" tabIndex={0} className="absolute left-0 z-30 h-1 w-full -translate-y-1/2 cursor-row-resize bg-slate-700/60 hover:bg-slate-400" style={{ top: `${split.y * 100}%` }} onPointerDown={event => beginSplitter('y', event)} onDoubleClick={() => resetSplitter('y')} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); resetSplitter('y') } }} /> : null}</div>}
      </div>
    </div>
    <SymbolSearchModal open={symbolSearchOpen} query={symbolSearch} instruments={instruments} onQueryChange={setSymbolSearch} onSelect={selectInstrument} onClose={() => setSymbolSearchOpen(false)} />
    <IndicatorLibraryModal open={indicatorOpen} search={indicatorSearch} active={indicators} onSearchChange={setIndicatorSearch} onAdd={option => { setIndicators(items => [...items, createIndicator(option, items.length)]); setIndicatorOpen(false) }} onClose={() => setIndicatorOpen(false)} />
    <ChartSettingsModal open={settingsOpen} settings={settings} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />
  </section>
}
