import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChartToolsRail, ChartUtilities } from '../components/ChartControls'
import { Icon } from '../components/Icon'
import type { Candle } from './api'
import { coinbaseMarketData } from './CoinbaseMarketDataProvider'
import { CandleChart } from './CandleChart'
import { TIMEFRAMES, timeframeLabel, type Timeframe } from './chartMath'
import { defaultChartSettings, type ChartType, type Drawing, type DrawingTool, type IndicatorConfig, type MagnetMode } from './chartTypes'
import { COINBASE_DEFAULT_SYMBOLS, mergeCandles, type LiveConnectionStatus, type LiveSymbol, type MarketCandle, type MarketDataProvider } from './liveMarket'
import { sendChartCaptureToAssistant } from './chartCapture'

const iconButton = 'icon-tool grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-35'
const liveClass: Record<LiveConnectionStatus, string> = { LIVE: 'bg-emerald-400', CONNECTING: 'bg-amber-300 animate-pulse', RECONNECTING: 'bg-amber-300 animate-pulse', DISCONNECTED: 'bg-rose-400' }
const INITIAL_HISTORY_BARS = 900, HISTORY_PAGE_SIZE = 300, MAX_CACHED_BARS = 20_000
const historyCache = new Map<string, MarketCandle[]>()
const cacheKey = (symbol: LiveSymbol, timeframe: Timeframe, before?: number) => `${symbol}|${timeframe}|${before ?? 'latest'}`
const indicatorOptions: Array<{ type: IndicatorConfig['type']; label: string; search: string; period: number }> = [
  { type: 'sma', label: 'Simple Moving Average (SMA)', search: 'sma simple moving average', period: 50 },
  { type: 'ema', label: 'Exponential Moving Average (EMA)', search: 'ema exponential moving average', period: 20 },
  { type: 'bollinger', label: 'Bollinger Bands (BB)', search: 'bollinger bands bb volatility', period: 20 },
  { type: 'vwap', label: 'Volume Weighted Average Price (VWAP)', search: 'vwap volume weighted average price', period: 1 },
  { type: 'rsi', label: 'Relative Strength Index (RSI)', search: 'rsi relative strength index', period: 14 },
  { type: 'macd', label: 'Moving Average Convergence Divergence (MACD)', search: 'macd moving average convergence divergence', period: 26 },
  { type: 'atr', label: 'Average True Range (ATR)', search: 'atr average true range volatility', period: 14 },
]

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
}

const createChartCell = (): ChartCellState => ({ symbol: 'BTC-USD', timeframe: '1m', candles: [], drawings: [], indicators: [], chartType: 'candles' })

export function LiveChart({ workspaceNavigation, provider = coinbaseMarketData }: { workspaceNavigation?: ReactNode; provider?: MarketDataProvider } = {}) {
  const unitTestDefaultProvider = provider === coinbaseMarketData && typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom')
  const [cells, setCells] = useState<Record<string, ChartCellState>>({ c1: createChartCell() }), [symbols, setSymbols] = useState<LiveSymbol[]>([...COINBASE_DEFAULT_SYMBOLS])
  const [status, setStatus] = useState<LiveConnectionStatus>(unitTestDefaultProvider ? 'DISCONNECTED' : 'CONNECTING')
  const [loading, setLoading] = useState(!unitTestDefaultProvider), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  const [tool, setTool] = useState<DrawingTool>('cursor'), [selectedDrawing, setSelectedDrawing] = useState<string | null>(null)
  const [magnet, setMagnet] = useState<MagnetMode>('off'), [stayInMode, setStayInMode] = useState(false)
  const [indicatorOpen, setIndicatorOpen] = useState(false), [indicatorSearch, setIndicatorSearch] = useState('')
  const [layout, setLayout] = useState<'1' | '2H' | '2V' | '4' | '8'>('1'), [activeCell, setActiveCell] = useState('c1'), [olderLoading, setOlderLoading] = useState(false)
  const olderBefore = useRef<number | null>(null)
  const activeState = cells[activeCell] ?? createChartCell()
  const { symbol, timeframe, candles, drawings, indicators, chartType } = activeState
  const updateCell = (id: string, update: (cell: ChartCellState) => ChartCellState) => setCells(current => ({ ...current, [id]: update(current[id] ?? createChartCell()) }))
  const updateActiveCell = (update: (cell: ChartCellState) => ChartCellState) => updateCell(activeCell, update)
  const setSymbol = (next: LiveSymbol) => updateActiveCell(cell => ({ ...cell, symbol: next }))
  const setTimeframe = (next: Timeframe) => updateActiveCell(cell => ({ ...cell, timeframe: next }))
  const setCandles = (update: MarketCandle[] | ((current: MarketCandle[]) => MarketCandle[])) => updateActiveCell(cell => ({ ...cell, candles: typeof update === 'function' ? update(cell.candles) : update }))
  const setDrawings = (update: Drawing[] | ((current: Drawing[]) => Drawing[])) => updateActiveCell(cell => ({ ...cell, drawings: typeof update === 'function' ? update(cell.drawings) : update }))
  const setIndicators = (update: IndicatorConfig[] | ((current: IndicatorConfig[]) => IndicatorConfig[])) => updateActiveCell(cell => ({ ...cell, indicators: typeof update === 'function' ? update(cell.indicators) : update }))
  const setChartType = (next: ChartType) => updateActiveCell(cell => ({ ...cell, chartType: next }))
  const selectCell = (id: string) => { setCells(current => current[id] ? current : { ...current, [id]: createChartCell() }); setActiveCell(id) }

  useEffect(() => {
    if (!provider.listProducts || unitTestDefaultProvider) return
    const controller = new AbortController()
    void provider.listProducts(controller.signal).then(items => {
      if (items.length) setSymbols(items)
    }).catch(() => { /* The default BTC/ETH selection remains available offline. */ })
    return () => controller.abort()
  }, [provider, unitTestDefaultProvider])

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
      const key = cacheKey(symbol, timeframe), cached = historyCache.get(key)
      const history = cached?.length ? cached : await provider.getHistoricalCandles({ symbol, interval: timeframe, limit: INITIAL_HISTORY_BARS, signal: controller.signal })
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
      const key = cacheKey(symbol, timeframe, before), cached = historyCache.get(key)
      const older = cached?.length ? cached : await provider.getHistoricalCandles({ symbol, interval: timeframe, limit: HISTORY_PAGE_SIZE, before: before - 1 })
      historyCache.set(key, older)
      if (older.length) setCandles(current => { const next = older.reduce(mergeCandles, current).slice(0, MAX_CACHED_BARS); historyCache.set(cacheKey(symbol, timeframe), next); return next })
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'Failed to load older Coinbase candles.')
    } finally { setOlderLoading(false) }
  }

  const page = useMemo(() => ({ dataset: { symbol }, items: candles.map(asChartCandle) }), [candles, symbol])
  const latest = candles.at(-1)
  const locked = drawings.length > 0 && drawings.every(drawing => drawing.locked)
  const hidden = drawings.length > 0 && drawings.every(drawing => drawing.visible === false)
  const removeSelected = () => { if (selectedDrawing) { setDrawings(items => items.filter(item => item.id !== selectedDrawing)); setSelectedDrawing(null) } }
  const sendFullChart = async (blob: Blob) => { if (!candles.length) throw new Error('No chart is available to capture.'); const from = new Date(candles[0].openTime).toISOString(), to = new Date(candles.at(-1)!.openTime).toISOString(); await sendChartCaptureToAssistant({ blob, prompt: 'Please inspect this full active chart and explain the visible evidence.', context: { symbol, provider: 'COINBASE', timeframe: timeframeLabel(timeframe), visibleTimeRange: { from, to }, capturedTimeRange: { from, to }, approximateCapturedPriceRange: { lower: Math.min(...candles.map(candle => Number(candle.low))), upper: Math.max(...candles.map(candle => Number(candle.high))) }, currentPrice: Number(candles.at(-1)!.close), selectedDrawingIds: selectedDrawing ? [selectedDrawing] : [] }, region: { x: 0, y: 0, width: 1, height: 1 }, fullChart: true }) }
  const chartCount = layout === '1' ? 1 : layout === '2H' || layout === '2V' ? 2 : layout === '4' ? 4 : 8
  const gridClass = layout === '2H' ? 'grid-cols-2' : layout === '2V' ? 'grid-rows-2' : layout === '4' ? 'grid-cols-2 grid-rows-2' : layout === '8' ? 'grid-cols-4 grid-rows-2' : 'grid-cols-1'

  return <section aria-label="Chart" data-testid="chart-view" className="flex h-full min-h-0 flex-col overflow-hidden">
    <header data-testid="chart-toolbar" className="flex min-h-10 shrink-0 flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-925 px-2 py-1 sm:flex-nowrap">
      <div data-testid="chart-left-cluster" className="flex min-w-0 items-center gap-1"><label className="flex h-8 min-w-0 items-center gap-1.5"><span className="sr-only">Symbol</span><select aria-label="Symbol" value={symbol} onChange={event => setSymbol(event.target.value as LiveSymbol)} className="h-8 max-w-36 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs font-semibold text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-300">{symbols.map(value => <option key={value} value={value}>{value}</option>)}</select><span aria-label={`Coinbase · ${status}`} title={`Coinbase · ${status}`} className={`h-1.5 w-1.5 shrink-0 rounded-full ${liveClass[status]}`} /></label><label className="flex h-8 items-center"><span className="sr-only">Timeframe</span><select aria-label="Timeframe" value={timeframe} onChange={event => setTimeframe(event.target.value as Timeframe)} className="h-8 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs font-semibold text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-300">{TIMEFRAMES.map(value => <option key={value} value={value}>{timeframeLabel(value)}</option>)}</select></label>{latest && <span aria-label="Current market price" className="hidden font-mono text-xs font-semibold text-slate-100 sm:inline">{latest.close}</span>}</div>
      <div data-testid="chart-right-cluster" className="ml-auto flex min-w-0 items-center gap-1"><details className="relative"><summary aria-label="Chart type" title="Chart type" className={iconButton}><Icon name="candle" className="h-4 w-4" /></summary><div className="absolute right-0 top-9 z-40 w-40 rounded-lg border border-slate-700 bg-slate-900 p-1.5 shadow-2xl"><p className="px-2 py-1 text-[9px] uppercase tracking-wider text-slate-600">Chart type</p>{(['candles', 'bars', 'line', 'area'] as const).map(type => <button key={type} type="button" className={`flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs capitalize ${chartType === type ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800'}`} onClick={event => { setChartType(type); event.currentTarget.closest('details')?.removeAttribute('open') }}>{type}{chartType === type && <span className="ml-auto">✓</span>}</button>)}</div></details>
        <details className="relative"><summary aria-label="Chart layout" title="Chart layout" className={iconButton}><Icon name="layout" className="h-4 w-4" /></summary><div className="absolute right-0 top-9 z-40 w-52 rounded-lg border border-slate-700 bg-slate-900 p-1.5 shadow-2xl"><p className="px-2 py-1 text-[9px] uppercase tracking-wider text-slate-600">Layout</p><div className="grid grid-cols-5 gap-1">{(['1', '2H', '2V', '4', '8'] as const).map(value => <button key={value} type="button" aria-label={`Layout ${value}`} aria-pressed={layout === value} className={`grid min-h-9 place-items-center rounded-md border text-[10px] ${layout === value ? 'border-slate-400 bg-slate-700 text-white' : 'border-slate-800 text-slate-400 hover:bg-slate-800'}`} onClick={event => { setLayout(value); selectCell('c1'); event.currentTarget.closest('details')?.removeAttribute('open') }}>{value}</button>)}</div></div></details>
        <details open={indicatorOpen} onToggle={event => setIndicatorOpen(event.currentTarget.open)} className="relative"><summary aria-label="Indicators" title="Indicators" className={`${iconButton} ${indicators.length ? 'text-slate-100' : ''}`}><Icon name="indicator" className="h-4 w-4" /></summary><div className="absolute right-0 top-9 z-40 w-72 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-2xl"><input autoFocus={indicatorOpen} aria-label="Search indicators" placeholder="Search indicators…" value={indicatorSearch} onChange={event => setIndicatorSearch(event.target.value)} className="mb-2 h-8 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none"/><p className="px-1 pb-1 text-[9px] uppercase tracking-wider text-slate-600">Coinbase candle studies</p>{indicatorOptions.filter(option => option.search.includes(indicatorSearch.trim().toLowerCase())).map(option => <button key={option.type} type="button" className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-slate-300 hover:bg-slate-800" onClick={() => { setIndicators(items => [...items, { id: `${option.type}-${Date.now()}-${items.length}`, type: option.type, period: option.period, ...(option.type === 'bollinger' ? { deviation: 2 } : option.type === 'macd' ? { fast: 12, slow: 26, signal: 9 } : {}), color: ['#60a5fa', '#f59e0b', '#a78bfa', '#34d399', '#fb7185', '#c084fc', '#fbbf24'][items.length % 7], visible: true }]); setIndicatorOpen(false) }}><Icon name="plus" className="h-3.5 w-3.5"/><span>{option.label}</span></button>)}{!indicatorSearch && <p className="mt-1 px-1 text-[10px] text-slate-600">Studies are calculated locally from Coinbase OHLCV candles.</p>}</div></details>
        {workspaceNavigation}<span className="mx-1 h-5 w-px shrink-0 bg-slate-800" aria-hidden="true"/><ChartUtilities hasChart={page.items.length > 0 || unitTestDefaultProvider} onRefresh={() => setAttempt(value => value + 1)} refreshing={loading} onSendAssistant={sendFullChart} /></div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      <ChartToolsRail selected={tool} onSelect={setTool} canDelete={!!selectedDrawing} hasDrawings={drawings.length > 0} onDelete={removeSelected} onClear={() => { setDrawings([]); setSelectedDrawing(null) }} magnet={magnet} onMagnetChange={setMagnet} stayInMode={stayInMode} onToggleStay={() => setStayInMode(value => !value)} allDrawingsLocked={locked} onToggleLockAll={() => setDrawings(items => items.map(item => ({ ...item, locked: !locked })))} allDrawingsHidden={hidden} onToggleHideAll={() => setDrawings(items => items.map(item => ({ ...item, visible: hidden })))} />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading && <p role="status" className="m-auto text-sm text-slate-400">Loading Coinbase historical candles…</p>}
        {olderLoading && <p role="status" className="pointer-events-none absolute left-2 top-2 z-30 rounded bg-slate-900/90 px-2 py-1 text-[10px] text-slate-500">Loading older candles…</p>}
        {error && <div className="m-auto max-w-sm text-center"><p role="alert" className="text-sm text-rose-300">{error}</p><button type="button" className="mt-3 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700" onClick={() => setAttempt(value => value + 1)}>Retry market data</button></div>}
        {!error && (page.items.length > 0 || Object.values(cells).some(cell => cell.candles.length > 0)) && <div className={`grid min-h-0 flex-1 gap-px bg-slate-800 ${gridClass}`} data-testid="chart-grid" data-chart-export>{Array.from({ length: chartCount }, (_, index) => { const id = `c${index + 1}`, active = id === activeCell, cell = cells[id] ?? createChartCell(), cellPage = { dataset: { symbol: cell.symbol }, items: cell.candles.map(asChartCandle) }; return <div key={id} role="button" tabIndex={0} aria-label={`Chart cell ${index + 1}`} aria-pressed={active} onClick={() => selectCell(id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectCell(id) } }} className={`relative min-h-0 min-w-0 overflow-hidden bg-[#141518] ${active ? 'ring-1 ring-inset ring-slate-400' : ''}`}><div className="pointer-events-none absolute right-2 top-1 z-20 rounded bg-slate-950/70 px-1.5 py-0.5 text-[9px] text-slate-500">{id}{active ? ' · active' : ''}</div>{cell.candles.length > 0 ? <CandleChart page={cellPage} dataSource="live Coinbase" sourceLabel="COINBASE" timeframe={timeframeLabel(cell.timeframe)} settings={{ ...defaultChartSettings, chartType: cell.chartType }} indicators={active ? indicators : cell.indicators} activeTool={active ? tool : 'cursor'} drawings={active ? drawings : cell.drawings} selectedDrawingId={active ? selectedDrawing : null} magnet={magnet} stayInMode={stayInMode} onSelectDrawing={active ? setSelectedDrawing : undefined} onDeleteSelected={active ? removeSelected : undefined} onDeleteDrawing={active ? id => { setDrawings(items => items.filter(item => item.id !== id)); setSelectedDrawing(null) } : undefined} onCancelTool={() => setTool('cursor')} onUpdateDrawing={active ? drawing => setDrawings(items => items.map(item => item.id === drawing.id ? drawing : item)) : undefined} onCommitDrawingEdit={active ? (_before, after) => setDrawings(items => items.map(item => item.id === after.id ? after : item)) : undefined} onAddDrawing={active ? drawing => { setDrawings(items => [...items, drawing]); setSelectedDrawing(drawing.id) } : undefined} onToggleIndicator={active ? id => setIndicators(items => items.map(item => item.id === id ? { ...item, visible: !item.visible } : item)) : undefined} onRemoveIndicator={active ? id => setIndicators(items => items.filter(item => item.id !== id)) : undefined} onOpenIndicators={active ? () => setIndicatorOpen(true) : undefined} onRequestOlder={active ? () => void loadOlder() : undefined} /> : <p className="grid h-full place-items-center text-[10px] text-slate-600">Select this cell to load its chart</p>}</div> })}</div>}
      </div>
    </div>
  </section>
}
