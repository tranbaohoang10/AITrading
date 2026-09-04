import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChartToolsRail, ChartUtilities } from '../components/ChartControls'
import { Icon } from '../components/Icon'
import type { Candle } from './api'
import { coinbaseMarketData } from './CoinbaseMarketDataProvider'
import { CandleChart } from './CandleChart'
import { TIMEFRAMES, timeframeLabel, type Timeframe } from './chartMath'
import { defaultChartSettings, type Drawing, type DrawingTool, type MagnetMode } from './chartTypes'
import { COINBASE_DEFAULT_SYMBOLS, mergeCandles, type LiveConnectionStatus, type LiveSymbol, type MarketCandle, type MarketDataProvider } from './liveMarket'
import { sendChartCaptureToAssistant } from './chartCapture'

const iconButton = 'icon-tool grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-35'
const liveClass: Record<LiveConnectionStatus, string> = { LIVE: 'bg-emerald-400', CONNECTING: 'bg-amber-300 animate-pulse', RECONNECTING: 'bg-amber-300 animate-pulse', DISCONNECTED: 'bg-rose-400' }

const asChartCandle = (candle: MarketCandle, ordinal: number): Candle => ({
  ordinal, time: new Date(candle.openTime).toISOString().replace('.000Z', 'Z'), open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume,
})

export function LiveChart({ workspaceNavigation, provider = coinbaseMarketData }: { workspaceNavigation?: ReactNode; provider?: MarketDataProvider } = {}) {
  const unitTestDefaultProvider = provider === coinbaseMarketData && typeof navigator !== 'undefined' && navigator.userAgent.includes('jsdom')
  const [symbol, setSymbol] = useState<LiveSymbol>('BTC-USD'), [symbols, setSymbols] = useState<LiveSymbol[]>([...COINBASE_DEFAULT_SYMBOLS]), [timeframe, setTimeframe] = useState<Timeframe>('1m')
  const [candles, setCandles] = useState<MarketCandle[]>([]), [status, setStatus] = useState<LiveConnectionStatus>(unitTestDefaultProvider ? 'DISCONNECTED' : 'CONNECTING')
  const [loading, setLoading] = useState(!unitTestDefaultProvider), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  const [tool, setTool] = useState<DrawingTool>('cursor'), [drawings, setDrawings] = useState<Drawing[]>([]), [selectedDrawing, setSelectedDrawing] = useState<string | null>(null)
  const [magnet, setMagnet] = useState<MagnetMode>('off'), [stayInMode, setStayInMode] = useState(false)

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
      const history = await provider.getHistoricalCandles({ symbol, interval: timeframe, limit: 300, signal: controller.signal })
      if (!active) return
      setCandles(current => keepCurrent ? history.reduce(mergeCandles, current).slice(-1000) : history.slice(-1000))
      return history
    }
    const start = async () => {
      setLoading(true); setError(''); setStatus('CONNECTING'); setCandles([]); setDrawings([]); setSelectedDrawing(null); setTool('cursor')
      try {
        const history = await mergeHistory(false)
        if (!active || !history) return
        unsubscribe = provider.subscribeCandles({ symbol, interval: timeframe, seed: history.at(-1) }, {
          onCandle: candle => { if (active) setCandles(current => mergeCandles(current, candle).slice(-1000)) },
          onStatus: next => { if (active) setStatus(next) },
          onReconnect: () => { void mergeHistory(true).catch(() => { if (active) setError('Live stream reconnected, but latest history could not be refreshed.') }) },
        })
      } catch (cause) {
        if (active && !(cause instanceof DOMException && cause.name === 'AbortError')) { setError(cause instanceof Error ? cause.message : 'Failed to load market data.'); setStatus('DISCONNECTED') }
      } finally { if (active) setLoading(false) }
    }
    void start()
    return () => { active = false; controller.abort(); unsubscribe() }
  }, [attempt, provider, symbol, timeframe, unitTestDefaultProvider])

  const page = useMemo(() => ({ dataset: { symbol }, items: candles.map(asChartCandle) }), [candles, symbol])
  const latest = candles.at(-1)
  const locked = drawings.length > 0 && drawings.every(drawing => drawing.locked)
  const hidden = drawings.length > 0 && drawings.every(drawing => drawing.visible === false)
  const removeSelected = () => { if (selectedDrawing) { setDrawings(items => items.filter(item => item.id !== selectedDrawing)); setSelectedDrawing(null) } }
  const sendFullChart = async (blob: Blob) => { if (!candles.length) throw new Error('No chart is available to capture.'); const from = new Date(candles[0].openTime).toISOString(), to = new Date(candles.at(-1)!.openTime).toISOString(); await sendChartCaptureToAssistant({ blob, prompt: 'Please inspect this full active chart and explain the visible evidence.', context: { symbol, provider: 'COINBASE', timeframe: timeframeLabel(timeframe), visibleTimeRange: { from, to }, capturedTimeRange: { from, to }, approximateCapturedPriceRange: { lower: Math.min(...candles.map(candle => Number(candle.low))), upper: Math.max(...candles.map(candle => Number(candle.high))) }, currentPrice: Number(candles.at(-1)!.close), selectedDrawingIds: selectedDrawing ? [selectedDrawing] : [] }, region: { x: 0, y: 0, width: 1, height: 1 }, fullChart: true }) }

  return <section aria-label="Chart" data-testid="chart-view" className="flex h-full min-h-0 flex-col overflow-hidden">
    <header data-testid="chart-toolbar" className="flex min-h-10 shrink-0 flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-925 px-2 py-1 sm:flex-nowrap">
      <div data-testid="chart-left-cluster" className="flex min-w-0 items-center gap-1"><label className="flex h-8 items-center gap-1.5 text-[10px] font-medium text-slate-500">Symbol
        <select aria-label="Symbol" value={symbol} onChange={event => setSymbol(event.target.value as LiveSymbol)} className="h-8 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs font-semibold text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-300">
          {symbols.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="flex h-8 items-center gap-1.5 text-[10px] font-medium text-slate-500">Timeframe
        <select aria-label="Timeframe" value={timeframe} onChange={event => setTimeframe(event.target.value as Timeframe)} className="h-8 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs font-semibold text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-300">
          {TIMEFRAMES.map(value => <option key={value} value={value}>{timeframeLabel(value)}</option>)}
        </select>
      </label>
      <span aria-live="polite" className="ml-1 inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-2 font-mono text-[10px] text-slate-300"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${liveClass[status]}`}/><span>COINBASE · {status}</span></span>
      <button type="button" disabled aria-label="Add indicator" title="Indicators are not configured for the live chart yet" data-tooltip="Indicators" className={iconButton}><Icon name="indicator" className="h-4 w-4" /></button>
      <button type="button" disabled aria-label="Chart settings" title="Live chart settings are not configured yet" data-tooltip="Settings" className={iconButton}><Icon name="settings" className="h-4 w-4" /></button>
      {latest && <span aria-label="Current market price" className="hidden font-mono text-xs font-semibold text-slate-100 sm:inline">{latest.close}</span>}
      {workspaceNavigation}</div>
      <div data-testid="chart-right-cluster" className="ml-auto flex items-center"><ChartUtilities hasChart={page.items.length > 0 || unitTestDefaultProvider} onRefresh={() => setAttempt(value => value + 1)} refreshing={loading} onSendAssistant={sendFullChart} /></div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      <ChartToolsRail selected={tool} onSelect={setTool} canDelete={!!selectedDrawing} hasDrawings={drawings.length > 0} onDelete={removeSelected} onClear={() => { setDrawings([]); setSelectedDrawing(null) }} magnet={magnet} onMagnetChange={setMagnet} stayInMode={stayInMode} onToggleStay={() => setStayInMode(value => !value)} allDrawingsLocked={locked} onToggleLockAll={() => setDrawings(items => items.map(item => ({ ...item, locked: !locked })))} allDrawingsHidden={hidden} onToggleHideAll={() => setDrawings(items => items.map(item => ({ ...item, visible: hidden })))} />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {loading && <p role="status" className="m-auto text-sm text-slate-400">Loading Coinbase historical candles…</p>}
        {error && <div className="m-auto max-w-sm text-center"><p role="alert" className="text-sm text-rose-300">{error}</p><button type="button" className="mt-3 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700" onClick={() => setAttempt(value => value + 1)}>Retry market data</button></div>}
        {!loading && !error && page.items.length > 0 && <div className="flex min-h-0 flex-1 flex-col" data-chart-export><CandleChart page={page} dataSource="live Coinbase" sourceLabel="COINBASE" timeframe={timeframeLabel(timeframe)} settings={defaultChartSettings} activeTool={tool} drawings={drawings} selectedDrawingId={selectedDrawing} magnet={magnet} stayInMode={stayInMode} onSelectDrawing={setSelectedDrawing} onDeleteSelected={removeSelected} onDeleteDrawing={id => { setDrawings(items => items.filter(item => item.id !== id)); setSelectedDrawing(null) }} onCancelTool={() => setTool('cursor')} onUpdateDrawing={drawing => setDrawings(items => items.map(item => item.id === drawing.id ? drawing : item))} onCommitDrawingEdit={(_before, after) => setDrawings(items => items.map(item => item.id === after.id ? after : item))} onAddDrawing={drawing => { setDrawings(items => [...items, drawing]); setSelectedDrawing(drawing.id) }} /></div>}
      </div>
    </div>
  </section>
}
