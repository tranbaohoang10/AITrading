import { formatChartDate } from './chartTimezone'
import { SymbolCatalogSearch } from './SymbolCatalogSearch'
import { useOpenReplay } from '../replay/ReplayHost'
import { ReplayLauncher } from '../replay/ReplayLauncher'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ChartToolsRail, ChartUtilities } from '../components/ChartControls'
import { ChartClock, ChartSettingsModal, IndicatorLibraryModal, SymbolSearchModal, createIndicator } from '../components/ChartWorkspacePanels'
import { Icon } from '../components/Icon'
import type { Candle } from './api'
import { CandleChart } from './CandleChart'
import { TimeframePopover } from './TimeframePopover'
import { timeframeMilliseconds, timeframeLabel, type Timeframe } from './chartMath'
import { defaultChartSettings, type ChartSettings, type ChartType, type Drawing, type DrawingTool, type IndicatorConfig, type MagnetMode } from './chartTypes'
import { DEFAULT_INSTRUMENTS, displayMarketSymbol, formatMarketPrice, mergeCandles, type Instrument, type LiveConnectionStatus, type LiveSymbol, type MarketCandle, type MarketDataProvider } from './liveMarket'
import { marketDataProvider } from './MarketDataProviders'
import { sendChartCaptureToAssistant } from './chartCapture'
import { PositionSetupPopover } from './PositionSetupPopover'

const iconButton = 'icon-tool grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-35'
const toolbarTrigger = 'flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800/60 hover:text-white focus-visible:bg-slate-800/60 focus-visible:ring-2 focus-visible:ring-slate-300'
const liveClass: Record<LiveConnectionStatus, string> = { LIVE: 'bg-emerald-400', CONNECTED: 'bg-sky-400', MARKET_CLOSED: 'bg-slate-400', DELAYED: 'bg-amber-300', CONNECTING: 'bg-amber-300 animate-pulse', RECONNECTING: 'bg-amber-300 animate-pulse', DISCONNECTED: 'bg-rose-400' }
/** Its clock updates only the realtime status, never the candle workspace. */
function RealtimeStatus({ status, firstEventAt, lastUpdate, activeCandleTime, partial, timeframe, timezone }: { timezone: string; status: LiveConnectionStatus; firstEventAt?: number; lastUpdate?: number; activeCandleTime?: number; partial?: boolean; timeframe: Timeframe }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const staleAfter = Math.max(60_000, Math.min(timeframeMilliseconds(timeframe), 300_000))
  const confirmedLive = status === 'LIVE' && Boolean(lastUpdate), stale = confirmedLive && now - lastUpdate! > staleAfter
  const effectiveStatus: LiveConnectionStatus = stale ? 'DELAYED' : status === 'LIVE' && !lastUpdate ? 'CONNECTING' : status
  const label = stale ? 'Stale' : status === 'LIVE' && !lastUpdate ? 'Waiting for first tick' : status === 'CONNECTING' ? 'Waiting for first tick' : status[0] + status.slice(1).toLowerCase()
  const visibleLabel = effectiveStatus === 'LIVE' ? 'Live' : effectiveStatus === 'CONNECTED' ? 'Connected' : effectiveStatus === 'MARKET_CLOSED' ? 'Market closed' : effectiveStatus === 'CONNECTING' ? 'Waiting' : effectiveStatus === 'RECONNECTING' ? 'Reconnecting' : effectiveStatus === 'DELAYED' ? stale ? 'Stale' : 'Delayed' : 'Offline'
  const time = (value?: number) => value ? formatChartDate(new Date(value), timezone, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '—'
  const detail = effectiveStatus === 'MARKET_CLOSED'
    ? `Market closed · showing the latest historical or cached candle. Realtime resumes only when Alpaca sends a new provider trade.`
    : effectiveStatus === 'CONNECTED'
      ? `Realtime connected · subscription active; waiting for the first provider trade. Cached history is not treated as a live tick.`
      : `Realtime · ${label}. First tick ${time(firstEventAt ?? lastUpdate)}. Last tick ${time(lastUpdate)}. Candle ${time(activeCandleTime)}${partial ? ' (partial)' : ''}.`
  return <div data-testid="realtime-status" role="status" aria-label={detail} title={detail} className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950/60 px-2 text-[10px] leading-none text-slate-300"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${liveClass[effectiveStatus]}`}/><span className="font-semibold">{visibleLabel}</span></div>
}

const INITIAL_HISTORY_BARS = 300, HISTORY_PAGE_SIZE = 300, MAX_CACHED_BARS = 20_000, HISTORY_REQUEST_TIMEOUT_MS = 60_000
const historyCache = new Map<string, MarketCandle[]>()
const cacheKey = (symbol: LiveSymbol, timeframe: Timeframe, before?: number) => `${symbol}|${timeframe}|${before ?? 'latest'}`
type HistoryRequest = { symbol: LiveSymbol; interval: Timeframe; limit: number; before?: number; signal?: AbortSignal }
type SharedHistoryRequest = { controller: AbortController; consumers: number; startedAt: number; promise: Promise<MarketCandle[]> }
const historyInFlight = new Map<string, SharedHistoryRequest>()
const loadHistorical = (provider: MarketDataProvider, request: HistoryRequest, key: string) => {
  const cached = historyCache.get(key)?.filter(candle => candle.closed)
  if (cached?.length) return Promise.resolve(cached)
  let shared = historyInFlight.get(key)
  if (shared && (shared.controller.signal.aborted || Date.now() - shared.startedAt >= HISTORY_REQUEST_TIMEOUT_MS)) {
    shared.controller.abort()
    historyInFlight.delete(key)
    shared = undefined
  }
  if (!shared) {
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined
    const timedOut = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort()
        reject(new Error('Market data request timed out. Retry the chart.'))
      }, HISTORY_REQUEST_TIMEOUT_MS)
    })
    const entry: SharedHistoryRequest = {
      controller,
      consumers: 0,
      startedAt: Date.now(),
      promise: Promise.race([provider.getHistoricalCandles({ ...request, signal: controller.signal }), timedOut]).finally(() => {
        if (timeout) clearTimeout(timeout)
        if (historyInFlight.get(key) === entry) historyInFlight.delete(key)
      }),
    }
    shared = entry
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
  loading: boolean
  error: string
  firstEventAt?: number
  lastUpdate?: number
  status: LiveConnectionStatus
  drawings: Drawing[]
  indicators: IndicatorConfig[]
  chartType: ChartType
  settings: ChartSettings
}

const createChartCell = (seed?: ChartCellState): ChartCellState => ({ symbol: seed?.symbol ?? 'BTC-USD', timeframe: seed?.timeframe ?? '1m', candles: [], loading: false, error: '', status: 'CONNECTING', drawings: [], indicators: [], chartType: seed?.chartType ?? 'candles', settings: { ...(seed?.settings ?? defaultChartSettings) } })
const chartIdsForLayout = (layout: '1' | '2H' | '2V' | '4' | '8') => Array.from({ length: layout === '1' ? 1 : layout === '2H' || layout === '2V' ? 2 : layout === '4' ? 4 : 8 }, (_, index) => `c${index + 1}`)

export function LiveChart({ workspaceNavigation, provider = marketDataProvider }: { workspaceNavigation?: ReactNode; provider?: MarketDataProvider } = {}) {
  const openReplay = useOpenReplay()
  const unitTestDefaultProvider = provider === marketDataProvider && typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom')
  const [cells, setCells] = useState<Record<string, ChartCellState>>({ c1: createChartCell() }), [instruments, setInstruments] = useState<Instrument[]>(DEFAULT_INSTRUMENTS), [instrumentCatalog, setInstrumentCatalog] = useState<Instrument[]>(DEFAULT_INSTRUMENTS)
  const [attempt, setAttempt] = useState(0)
  const [tool, setTool] = useState<DrawingTool>('cursor'), [selectedDrawing, setSelectedDrawing] = useState<string | null>(null)
  const [magnet, setMagnet] = useState<MagnetMode>('off'), [stayInMode, setStayInMode] = useState(false)
  const [indicatorOpen, setIndicatorOpen] = useState(false), [indicatorSearch, setIndicatorSearch] = useState(''), [symbolSearchOpen, setSymbolSearchOpen] = useState(false), [symbolSearch, setSymbolSearch] = useState(''), [settingsOpen, setSettingsOpen] = useState(false)
  const [layout, setLayout] = useState<'1' | '2H' | '2V' | '4' | '8'>('1'), [activeCell, setActiveCell] = useState('c1'), [olderLoading, setOlderLoading] = useState(false)
  const [split, setSplit] = useState({ x: .5, y: .5 })
  const [replaySelecting, setReplaySelecting] = useState(false), [replayStart, setReplayStart] = useState<string>()
  const olderBefore = useRef<number | null>(null)
  const cellRuns = useRef<Record<string, { key: string; controller: AbortController; unsubscribe: () => void }>>({})
  const drawingHistory = useRef<Record<string, { past: Drawing[][]; future: Drawing[][] }>>({})
  const activeState = cells[activeCell] ?? createChartCell()
  const { symbol, timeframe, candles, drawings, indicators, chartType, settings, loading, status } = activeState
  const updateCell = (id: string, update: (cell: ChartCellState) => ChartCellState) => setCells(current => ({ ...current, [id]: update(current[id] ?? createChartCell()) }))
  const updateActiveCell = (update: (cell: ChartCellState) => ChartCellState) => updateCell(activeCell, update)
  const setTimeframe = (next: Timeframe) => updateActiveCell(cell => ({ ...cell, timeframe: instruments.find(item => item.symbol === cell.symbol)?.provider === 'FRANKFURTER' ? '1d' : next }))
  const setDrawings = (update: Drawing[] | ((current: Drawing[]) => Drawing[])) => setCells(current => { const cell = current[activeCell] ?? createChartCell(), next = typeof update === 'function' ? update(cell.drawings) : update; if (JSON.stringify(next) === JSON.stringify(cell.drawings)) return current; const history = drawingHistory.current[activeCell] ?? { past: [], future: [] }; history.past.push(cell.drawings); history.future = []; drawingHistory.current[activeCell] = history; return { ...current, [activeCell]: { ...cell, drawings: next } } })
  const updateDrawingsTransient = (update: Drawing[] | ((current: Drawing[]) => Drawing[])) => updateActiveCell(cell => ({ ...cell, drawings: typeof update === 'function' ? update(cell.drawings) : update }))
  const setIndicators = (update: IndicatorConfig[] | ((current: IndicatorConfig[]) => IndicatorConfig[])) => updateActiveCell(cell => ({ ...cell, indicators: typeof update === 'function' ? update(cell.indicators) : update }))
  const setChartType = (next: ChartType) => updateActiveCell(cell => ({ ...cell, chartType: next }))
  const selectCell = (id: string) => { setCells(current => current[id] ? current : { ...current, [id]: createChartCell() }); setActiveCell(id) }
  const activeInstrument = instruments.find(item => item.symbol === symbol) ?? { symbol, displaySymbol: displayMarketSymbol(symbol), name: symbol, assetClass: 'CRYPTO' as const, exchangeTimezone: undefined, provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: settings.priceIncrement ?? .01, pricePrecision: settings.pricePrecision ?? 2, modes: ['HISTORICAL', 'REALTIME'] as const }
  useEffect(() => { setReplaySelecting(false); setReplayStart(undefined) }, [symbol, timeframe])
  const updateSettings = (next: ChartSettings) => updateActiveCell(cell => ({ ...cell, settings: next }))
  const undoDrawing = () => setCells(current => { const cell = current[activeCell] ?? createChartCell(), history = drawingHistory.current[activeCell]; const previous = history?.past.pop(); if (!previous) return current; history.future.push(cell.drawings); return { ...current, [activeCell]: { ...cell, drawings: previous } } })
  const redoDrawing = () => setCells(current => { const cell = current[activeCell] ?? createChartCell(), history = drawingHistory.current[activeCell]; const next = history?.future.pop(); if (!next) return current; history.past.push(cell.drawings); return { ...current, [activeCell]: { ...cell, drawings: next } } })

  useEffect(() => {
    if (unitTestDefaultProvider || provider.searchPage) return
    const controller = new AbortController()
    const load = async () => {
      if (provider.listInstruments) {
        const items = await provider.listInstruments(controller.signal)
        if (items.length) { setInstrumentCatalog(items); setInstruments(items) }
      } else if (provider.listProducts) {
        const items = await provider.listProducts(controller.signal)
        if (items.length) { const mapped = items.map(item => DEFAULT_INSTRUMENTS.find(defaultItem => defaultItem.symbol === item) ?? { symbol: item, displaySymbol: displayMarketSymbol(item), name: item, assetClass: 'CRYPTO', provider: 'COINBASE', feed: 'PUBLIC', priceIncrement: .01, pricePrecision: 2, modes: ['HISTORICAL', 'REALTIME'] } as Instrument); setInstrumentCatalog(mapped); setInstruments(mapped) }
      }
    }
    void load().catch(() => { /* Default entitled symbols remain available offline. */ })
    return () => controller.abort()
  }, [provider, unitTestDefaultProvider])

  useEffect(() => {
    if (!symbolSearchOpen || provider.searchPage) return
    if (!symbolSearch.trim()) { setInstruments(instrumentCatalog); return }
    if (!provider.searchInstruments) return
    const controller = new AbortController()
    void provider.searchInstruments(symbolSearch, controller.signal).then(items => { if (items.length) setInstruments(items) }).catch(() => { /* Search remains local when provider search is unavailable. */ })
    return () => controller.abort()
  }, [instrumentCatalog, provider, symbolSearch, symbolSearchOpen])

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
    const ids = chartIdsForLayout(layout)
    setCells(current => {
      const seed = current.c1 ?? createChartCell()
      let changed = false
      const next = { ...current }
      ids.forEach(id => { if (!next[id]) { next[id] = createChartCell(seed); changed = true } })
      return changed ? next : current
    })
  }, [layout])

  useEffect(() => {
    if (unitTestDefaultProvider) return
    const ids = chartIdsForLayout(layout)
    Object.keys(cellRuns.current).forEach(id => {
      if (!ids.includes(id)) { cellRuns.current[id].controller.abort(); cellRuns.current[id].unsubscribe(); delete cellRuns.current[id] }
    })
    ids.forEach(id => {
      const cell = cells[id]
      if (!cell) return
      const runKey = `${cell.symbol}|${cell.timeframe}|${attempt}`
      const existingRun = cellRuns.current[id]
      if (existingRun?.key === runKey && !existingRun.controller.signal.aborted) return
      existingRun?.controller.abort()
      existingRun?.unsubscribe()
      const controller = new AbortController()
      const run = { key: runKey, controller, unsubscribe: () => {} }
      cellRuns.current[id] = run
      const cellSymbol = cell.symbol, cellTimeframe = cell.timeframe
      const cachedHistory = historyCache.get(cacheKey(cellSymbol, cellTimeframe)) ?? []
      setCells(current => current[id] ? { ...current, [id]: { ...current[id], loading: !cachedHistory.length, error: '', status: 'CONNECTING', candles: cachedHistory, firstEventAt: undefined, lastUpdate: undefined } } : current)
      const setCell = (update: (current: ChartCellState) => ChartCellState) => setCells(current => {
        const existing = current[id]
        if (!existing || controller.signal.aborted || cellRuns.current[id] !== run || existing.symbol !== cellSymbol || existing.timeframe !== cellTimeframe) return current
        return { ...current, [id]: update(existing) }
      })
      const mergeHistory = async (keepCurrent: boolean) => {
        const key = cacheKey(cellSymbol, cellTimeframe), history = await loadHistorical(provider, { symbol: cellSymbol, interval: cellTimeframe, limit: INITIAL_HISTORY_BARS, signal: controller.signal }, key)
        if (controller.signal.aborted || cellRuns.current[id]?.key !== runKey) return null
        historyCache.set(key, history.slice(-MAX_CACHED_BARS))
        setCell(current => ({ ...current, candles: keepCurrent ? current.candles.reduce(mergeCandles, history).slice(-MAX_CACHED_BARS) : history.slice(-MAX_CACHED_BARS), error: '' }))
        return history
      }
      const start = async () => {
        if (id === activeCell) { setSelectedDrawing(null); setTool('cursor'); olderBefore.current = null }
        let deadline: ReturnType<typeof setTimeout> | undefined
        try {
          deadline = setTimeout(() => {
            if (!controller.signal.aborted) setCell(current => current.candles.length ? { ...current, loading: false } : { ...current, loading: false, error: 'Market data request timed out. Retry the chart.', status: 'DISCONNECTED' })
          }, HISTORY_REQUEST_TIMEOUT_MS)
          const cachedSeed = historyCache.get(cacheKey(cellSymbol, cellTimeframe))?.at(-1)
          run.unsubscribe = provider.subscribeCandles({ symbol: cellSymbol, interval: cellTimeframe, seed: cachedSeed }, {
            onCandle: candle => setCell(current => { if (candle.symbol !== cellSymbol || candle.interval !== cellTimeframe) return current; const next = mergeCandles(current.candles, candle).slice(-MAX_CACHED_BARS), receivedAt = Date.now(); historyCache.set(cacheKey(cellSymbol, cellTimeframe), next); return { ...current, candles: next, firstEventAt: current.firstEventAt ?? receivedAt, lastUpdate: receivedAt, status: 'LIVE' } }),
            onStatus: next => setCell(current => ({ ...current, status: next === 'LIVE' && !current.lastUpdate ? current.status === 'RECONNECTING' ? 'RECONNECTING' : 'CONNECTING' : next })),
            onReconnect: () => { void mergeHistory(true).catch(() => setCell(current => ({ ...current, error: 'Live stream reconnected, but latest history could not be refreshed.', status: 'DISCONNECTED' }))) },
          })
          const history = await mergeHistory(true)
          if (!history || controller.signal.aborted) return
        } catch (cause) {
          if (!controller.signal.aborted) setCell(current => ({ ...current, error: cause instanceof Error ? cause.message : 'Failed to load market data.', status: 'DISCONNECTED' }))
        } finally {
          if (deadline) clearTimeout(deadline)
          if (!controller.signal.aborted) setCell(current => ({ ...current, loading: false }))
        }
      }
      void start()
    })
  }, [activeCell, attempt, cells, layout, provider, unitTestDefaultProvider])

  useEffect(() => () => { Object.values(cellRuns.current).forEach(run => { run.controller.abort(); run.unsubscribe() }) }, [])

  const loadOlder = async () => {
    const before = candles[0]?.openTime
    if (!before || olderLoading || candles.length >= MAX_CACHED_BARS || olderBefore.current === before) return
    const ownerCell = activeCell, ownerRun = cellRuns.current[activeCell]
    olderBefore.current = before; setOlderLoading(true)
    try {
      const key = cacheKey(symbol, timeframe, before), older = await loadHistorical(provider, { symbol, interval: timeframe, limit: HISTORY_PAGE_SIZE, before: before - 1, signal: ownerRun?.controller.signal }, key)
      if (cellRuns.current[ownerCell] !== ownerRun || ownerRun?.controller.signal.aborted) return
      historyCache.set(key, older)
      if (older.length) setCells(current => {
        const cell = current[ownerCell]
        if (!cell || cell.symbol !== symbol || cell.timeframe !== timeframe || cellRuns.current[ownerCell] !== ownerRun) return current
        const next = older.reduce(mergeCandles, cell.candles).slice(-MAX_CACHED_BARS)
        historyCache.set(cacheKey(symbol, timeframe), next)
        return { ...current, [ownerCell]: { ...cell, candles: next } }
      })
    } catch (cause) {
      if (cellRuns.current[ownerCell] === ownerRun && !ownerRun?.controller.signal.aborted && !(cause instanceof DOMException && cause.name === 'AbortError')) updateActiveCell(current => ({ ...current, error: cause instanceof Error ? cause.message : 'Failed to load older market candles.' }))
    } finally { setOlderLoading(false) }
  }

  const page = useMemo(() => ({ dataset: { symbol: activeInstrument.displaySymbol ?? displayMarketSymbol(symbol) }, items: candles.map(asChartCandle) }), [activeInstrument.displaySymbol, candles, symbol])
  const latest = candles.at(-1)
  const locked = drawings.length > 0 && drawings.every(drawing => drawing.locked)
  const hidden = drawings.length > 0 && drawings.every(drawing => drawing.visible === false)
  const removeSelected = () => { if (selectedDrawing) { setDrawings(items => items.filter(item => item.id !== selectedDrawing)); setSelectedDrawing(null) } }
  const sendFullChart = async (blob: Blob) => { if (!candles.length) throw new Error('No chart is available to capture.'); const from = new Date(candles[0].openTime).toISOString(), to = new Date(candles.at(-1)!.openTime).toISOString(); await sendChartCaptureToAssistant({ blob, prompt: 'Please inspect this full active chart and explain the visible evidence.', context: { symbol, provider: activeInstrument.provider, timeframe: timeframeLabel(timeframe), visibleTimeRange: { from, to }, capturedTimeRange: { from, to }, approximateCapturedPriceRange: { lower: Math.min(...candles.map(candle => Number(candle.low))), upper: Math.max(...candles.map(candle => Number(candle.high))) }, currentPrice: Number(candles.at(-1)!.close), selectedDrawingIds: selectedDrawing ? [selectedDrawing] : [] }, region: { x: 0, y: 0, width: 1, height: 1 }, fullChart: true }) }
  const selectInstrument = (instrument: Instrument) => { setInstrumentCatalog(current => [...current.filter(i => i.symbol !== instrument.symbol), instrument]); setInstruments(current => [...current.filter(i => i.symbol !== instrument.symbol), instrument]); updateActiveCell(cell => ({ ...cell, symbol: instrument.symbol, timeframe: instrument.provider === 'FRANKFURTER' ? '1d' : cell.timeframe, settings: { ...cell.settings, priceIncrement: instrument.priceIncrement, pricePrecision: instrument.pricePrecision, exchangeTimezone: instrument.exchangeTimezone, timezone: cell.settings.timezone === 'EXCHANGE' && !instrument.exchangeTimezone ? 'UTC' : cell.settings.timezone } })); setSymbolSearchOpen(false); setSymbolSearch('') }

  const resetSplitter = (axis: 'x' | 'y') => setSplit(value => ({ ...value, [axis]: .5 }))
  const beginSplitter = (axis: 'x' | 'y', event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault(); event.stopPropagation(); const grid = event.currentTarget.parentElement?.getBoundingClientRect(), start = axis === 'x' ? event.clientX : event.clientY, initial = split[axis], size = axis === 'x' ? grid?.width ?? window.innerWidth : grid?.height ?? window.innerHeight, move = (next: PointerEvent) => { setSplit(value => ({ ...value, [axis]: Math.max(.25, Math.min(.75, initial + ((axis === 'x' ? next.clientX : next.clientY) - start) / Math.max(size, 1))) })) }, stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', stop)
  }
  const chartCount = layout === '1' ? 1 : layout === '2H' || layout === '2V' ? 2 : layout === '4' ? 4 : 8
  const gridClass = layout === '2H' ? 'grid-cols-2 grid-rows-1' : layout === '2V' ? 'grid-cols-1 grid-rows-2' : layout === '4' ? 'grid-cols-2 grid-rows-2' : layout === '8' ? 'grid-cols-4 grid-rows-2' : 'grid-cols-1 grid-rows-1'
  const gridStyle = { gridTemplateColumns: layout === '2H' || layout === '4' ? `${split.x}fr ${1 - split.x}fr` : layout === '2V' ? '1fr' : layout === '8' ? 'repeat(4, minmax(0, 1fr))' : '1fr', gridTemplateRows: layout === '2V' || layout === '4' || layout === '8' ? `${split.y}fr ${1 - split.y}fr` : '1fr' }

  const chartSource = status === 'LIVE' && activeState.lastUpdate ? 'LIVE' : 'Market data'
  const startReplay = () => {
    if (!openReplay || !replayStart || !latest) return
    openReplay({ provider: activeInstrument.provider, instrument: activeInstrument.providerSymbol ?? symbol, timeframe, from: replayStart, to: new Date(latest.closeTime).toISOString(), initialBalance: '10000', commissionBps: '0', slippageBps: '0' })
    setReplaySelecting(false)
  }
  return <section aria-label="Chart" data-testid="chart-view" className="relative flex h-full min-h-0 flex-col overflow-hidden">
    <header data-testid="chart-toolbar" className="flex min-h-10 shrink-0 flex-wrap items-center gap-1 sm:flex-nowrap border-b border-slate-800 bg-slate-925 px-2 py-1">
      <div data-testid="chart-main-controls" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto chart-tools">
        <div className="flex h-8 shrink-0 items-center gap-1.5"><button type="button" aria-label="Symbol" aria-haspopup="dialog" aria-expanded={symbolSearchOpen} title="Search symbols" onClick={() => setSymbolSearchOpen(true)} className={`${toolbarTrigger} max-w-36`}><span className="truncate">{displayMarketSymbol(symbol)}</span><Icon name="chevron" className="h-3.5 w-3.5 shrink-0" /></button></div>
        <span role="separator" aria-orientation="vertical" className="mx-1 h-5 w-px shrink-0 bg-slate-700" />
        <RealtimeStatus timezone={settings.timezone === 'EXCHANGE' ? settings.exchangeTimezone ?? activeInstrument.exchangeTimezone ?? 'UTC' : settings.timezone} status={status} firstEventAt={activeState.firstEventAt} lastUpdate={activeState.lastUpdate} activeCandleTime={activeState.lastUpdate ? candles.at(-1)?.openTime : undefined} partial={activeState.lastUpdate ? candles.at(-1)?.partial : undefined} timeframe={timeframe}/>
        <TimeframePopover value={timeframe} eod={activeInstrument.provider === 'FRANKFURTER'} onChange={setTimeframe} />
        {latest && <span aria-label="Current market price" className="hidden whitespace-nowrap px-1 font-mono text-xs font-semibold text-slate-100 sm:inline">{formatMarketPrice(Number(latest.close), activeInstrument.priceIncrement, activeInstrument.pricePrecision)}</span>}
        <span role="separator" aria-orientation="vertical" className="mx-1 h-5 w-px shrink-0 bg-slate-700" />
        <details className="relative shrink-0"><summary aria-label="Chart type" title="Chart type" className={iconButton}><Icon name="candle" className="h-4 w-4" /></summary><div className="absolute left-0 top-9 z-40 w-40 rounded-lg border border-slate-700 bg-slate-900 p-1.5 shadow-2xl"><p className="px-2 py-1 text-[9px] uppercase tracking-wider text-slate-600">Chart type</p>{(['candles', 'bars', 'line', 'area'] as const).map(type => <button key={type} type="button" className={`flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs capitalize ${chartType === type ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'}`} onClick={event => { setChartType(type); event.currentTarget.closest('details')?.removeAttribute('open') }}>{type}{chartType === type && <span className="ml-auto">✓</span>}</button>)}</div></details>
        <details className="relative shrink-0"><summary aria-label="Chart layout" title="Chart layout" className={iconButton}><Icon name="layout" className="h-4 w-4" /></summary><div className="absolute left-0 top-9 z-40 w-52 rounded-lg border border-slate-700 bg-slate-900 p-1.5 shadow-2xl"><p className="px-2 py-1 text-[9px] uppercase tracking-wider text-slate-600">Layout</p><div className="grid grid-cols-5 gap-1">{(['1', '2H', '2V', '4', '8'] as const).map(value => <button key={value} type="button" aria-label={`Layout ${value}`} aria-pressed={layout === value} className={`grid min-h-9 place-items-center rounded-md border text-[10px] ${layout === value ? 'border-slate-400 bg-slate-700 text-white' : 'border-slate-800 text-slate-400 hover:bg-slate-800'}`} onClick={event => { setLayout(value); selectCell('c1'); event.currentTarget.closest('details')?.removeAttribute('open') }}>{value}</button>)}</div></div></details>
        <button type="button" aria-label="Indicators" aria-haspopup="dialog" aria-expanded={indicatorOpen} title="Indicators · select multiple" onClick={() => setIndicatorOpen(true)} className={`icon-tool inline-flex h-8 w-auto shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-transparent bg-transparent px-2 text-slate-500 transition hover:bg-slate-800/60 hover:text-slate-100 focus-visible:bg-slate-800/60 focus-visible:ring-2 focus-visible:ring-slate-300 ${indicators.length ? 'text-slate-100' : ''}`}><Icon name="indicator" className="h-4 w-4 shrink-0" /><span className="text-[10px] font-semibold leading-none">Indicators</span><span data-testid="indicator-chevron" aria-hidden="true" className="flex items-center"><Icon name="chevron" className="h-3.5 w-3.5 text-slate-400" /></span></button>
        <span role="separator" aria-orientation="vertical" className="mx-1 h-5 w-px shrink-0 bg-slate-700" />
        <button type="button" aria-label="Undo drawing" title="Undo drawing · Ctrl/Cmd+Z" disabled={!drawingHistory.current[activeCell]?.past.length} onClick={undoDrawing} className={iconButton}><Icon name="undo" className="h-4 w-4" /></button><button type="button" aria-label="Redo drawing" title="Redo drawing · Ctrl/Cmd+Shift+Z" disabled={!drawingHistory.current[activeCell]?.future.length} onClick={redoDrawing} className={iconButton}><Icon name="redo" className="h-4 w-4" /></button>
      </div>
      {openReplay && <ReplayLauncher selecting={replaySelecting} selectedTime={replayStart} onSelectStart={() => setReplaySelecting(true)} onCancel={() => { setReplaySelecting(false); setReplayStart(undefined) }} />}
      <div data-testid="chart-right-cluster" className="ml-auto flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto"><span role="separator" aria-orientation="vertical" className="mx-1 h-5 w-px bg-slate-700" />{workspaceNavigation}<button type="button" aria-label="Chart settings" title="Chart settings" onClick={() => setSettingsOpen(true)} className={iconButton}><Icon name="settings" className="h-4 w-4" /></button><ChartClock exchangeTimezone={activeInstrument.exchangeTimezone ?? settings.exchangeTimezone} timezone={settings.timezone} onChange={value => updateSettings({ ...settings, timezone: value })} /><ChartUtilities hasChart={page.items.length > 0 || unitTestDefaultProvider} onRefresh={() => setAttempt(value => value + 1)} refreshing={loading} onSendAssistant={sendFullChart} /></div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      <ChartToolsRail positionSetup={<PositionSetupPopover instrument={activeInstrument} candle={latest} timeframe={timeframe} onApply={drawing => { setDrawings(items => [...items.filter(item => !item.id.startsWith('position-setup-')), drawing]); setSelectedDrawing(drawing.id); setTool('cursor') }} />} selected={tool} onSelect={setTool} canDelete={!!selectedDrawing} hasDrawings={drawings.length > 0} onDelete={removeSelected} onClear={() => { setDrawings([]); setSelectedDrawing(null) }} magnet={magnet} onMagnetChange={setMagnet} stayInMode={stayInMode} onToggleStay={() => setStayInMode(value => !value)} allDrawingsLocked={locked} onToggleLockAll={() => setDrawings(items => items.map(item => ({ ...item, locked: !locked })))} allDrawingsHidden={hidden} onToggleHideAll={() => setDrawings(items => items.map(item => ({ ...item, visible: hidden })))} />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {(replaySelecting || replayStart) && <div role="region" aria-label="Replay candle selection" className="absolute left-1/2 top-2 z-40 flex max-w-[calc(100%-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-blue-500/60 bg-slate-950/95 px-3 py-2 text-xs text-slate-200 shadow-xl" onClick={event => event.stopPropagation()}><span>{replaySelecting ? 'Select the Replay starting candle on the active chart.' : `Replay start: ${new Date(replayStart!).toLocaleString()}`}</span>{replayStart && !replaySelecting && <button type="button" className="rounded border border-blue-500 bg-blue-500/15 px-2 py-1 font-semibold text-blue-100 hover:bg-blue-500/25" onClick={startReplay}>Start Replay</button>}<button type="button" className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-800" onClick={() => setReplaySelecting(true)}>{replayStart ? 'Choose another candle' : 'Select candle'}</button><button type="button" className="rounded border border-slate-700 px-2 py-1 hover:bg-slate-800" onClick={() => { setReplaySelecting(false); setReplayStart(undefined) }}>Cancel</button></div>}
        {olderLoading && <p role="status" className="pointer-events-none absolute left-2 top-2 z-30 rounded bg-slate-900/90 px-2 py-1 text-[10px] text-slate-500">Loading older candles…</p>}
        <div className={`relative grid min-h-0 flex-1 gap-px bg-slate-800 ${gridClass}`} style={gridStyle} data-testid="chart-grid" data-chart-export>{Array.from({ length: chartCount }, (_, index) => { const id = `c${index + 1}`, active = id === activeCell, cell = cells[id] ?? createChartCell(activeState), cellInstrument = instruments.find(item => item.symbol === cell.symbol) ?? activeInstrument, cellPage = { dataset: { symbol: cell.symbol }, items: cell.candles.map(asChartCandle) }, dataSource = cell.status === 'LIVE' && cell.lastUpdate ? 'live market' : 'market data'; return <div key={id} role="button" tabIndex={0} aria-label={`Chart cell ${index + 1}`} aria-pressed={active} onClick={() => selectCell(id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCell(id) } }} className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#141518] ${active ? 'ring-1 ring-inset ring-slate-400' : ''}`}><div className="pointer-events-none absolute right-2 top-1 z-20 rounded bg-slate-950/70 px-1.5 py-0.5 text-[9px] text-slate-500">{id}{active ? ' · active' : ''}</div>{cell.loading && !cell.candles.length ? <div role="status" className="m-auto max-w-[16rem] px-4 text-center text-xs text-slate-400">Loading {displayMarketSymbol(cell.symbol)} {timeframeLabel(cell.timeframe)} data…</div> : cell.error && !cell.candles.length ? <div className="m-auto max-w-[18rem] px-4 text-center"><p role="alert" className="text-xs text-rose-300">{cell.error}</p><button type="button" className="mt-3 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700" onClick={event => { event.stopPropagation(); setAttempt(value => value + 1) }}>Retry market data</button></div> : cell.candles.length > 0 ? <CandleChart instrument={cellInstrument} page={cellPage} dataSource={dataSource} sourceLabel={active ? chartSource : cell.status === 'LIVE' && cell.lastUpdate ? 'LIVE' : 'Market data'} timeframe={timeframeLabel(cell.timeframe)} settings={{ ...cell.settings, exchangeTimezone: cellInstrument.exchangeTimezone ?? cell.settings.exchangeTimezone, chartType: cell.chartType }} indicators={active ? indicators : cell.indicators} activeTool={active ? tool : 'cursor'} drawings={active ? drawings : cell.drawings} selectedDrawingId={active ? selectedDrawing : null} magnet={magnet} stayInMode={stayInMode} onSelectDrawing={active ? setSelectedDrawing : undefined} onDeleteSelected={active ? removeSelected : undefined} onDeleteDrawing={active ? id => { setDrawings(items => items.filter(item => item.id !== id)); setSelectedDrawing(null) } : undefined} onUndo={active ? undoDrawing : undefined} onRedo={active ? redoDrawing : undefined} onCancelTool={() => setTool('cursor')} onUpdateDrawing={active ? drawing => updateDrawingsTransient(items => items.map(item => item.id === drawing.id ? drawing : item)) : undefined} onCommitDrawingEdit={active ? (before, after) => { updateDrawingsTransient(items => items.map(item => item.id === after.id ? after : item)); setCells(current => { const cell = current[activeCell] ?? createChartCell(), history = drawingHistory.current[activeCell] ?? { past: [], future: [] }; history.past.push(cell.drawings.map(item => item.id === after.id ? before : item)); history.future = []; drawingHistory.current[activeCell] = history; return { ...current } }) } : undefined} onAddDrawing={active ? drawing => { setDrawings(items => [...items, drawing]); setSelectedDrawing(drawing.id) } : undefined} onToggleIndicator={active ? id => setIndicators(items => items.map(item => item.id === id ? { ...item, visible: !item.visible } : item)) : undefined} onRemoveIndicator={active ? id => setIndicators(items => items.filter(item => item.id !== id)) : undefined} onOpenIndicators={active ? () => setIndicatorOpen(true) : undefined} onOpenSettings={active ? () => setSettingsOpen(true) : undefined} onRequestOlder={active ? () => void loadOlder() : undefined} replaySelecting={active && replaySelecting} replayCutTime={active ? replayStart : undefined} onSelectReplayTime={active ? time => { setReplayStart(time); setReplaySelecting(false) } : undefined} /> : <div role="status" className="m-auto px-4 text-center text-xs text-slate-600">Waiting for market data…</div>}</div> })}{layout !== '1' && layout !== '2V' && layout !== '8' && <div role="separator" aria-label="Vertical chart splitter" tabIndex={0} className="absolute top-0 z-30 h-full w-1 -translate-x-1/2 cursor-col-resize bg-slate-700/60 hover:bg-slate-400" style={{ left: `${split.x * 100}%` }} onPointerDown={event => beginSplitter('x', event)} onDoubleClick={() => resetSplitter('x')} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); resetSplitter('x') } }} />}{layout === '2V' || layout === '4' || layout === '8' ? <div role="separator" aria-label="Horizontal chart splitter" tabIndex={0} className="absolute left-0 z-30 h-1 w-full -translate-y-1/2 cursor-row-resize bg-slate-700/60 hover:bg-slate-400" style={{ top: `${split.y * 100}%` }} onPointerDown={event => beginSplitter('y', event)} onDoubleClick={() => resetSplitter('y')} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); resetSplitter('y') } }} /> : null}</div>
      </div>
    </div>
    {symbolSearchOpen && provider.searchPage ? <SymbolCatalogSearch provider={provider} onSelect={selectInstrument} onClose={() => setSymbolSearchOpen(false)} /> : <SymbolSearchModal open={symbolSearchOpen} query={symbolSearch} instruments={instruments} onQueryChange={setSymbolSearch} onSelect={selectInstrument} onClose={() => setSymbolSearchOpen(false)} />}
    <IndicatorLibraryModal open={indicatorOpen} search={indicatorSearch} active={indicators} onSearchChange={setIndicatorSearch} onAdd={option => { setIndicators(items => [...items, createIndicator(option, items.length)]); setIndicatorOpen(false) }} onClose={() => setIndicatorOpen(false)} />
    <ChartSettingsModal open={settingsOpen} settings={settings} onChange={updateSettings} onClose={() => setSettingsOpen(false)} />
  </section>
}
