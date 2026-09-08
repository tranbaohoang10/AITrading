import { Icon } from '../components/Icon'
import type { ReplayLaunch } from './ReplayLauncher'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CandleChart } from '../market/CandleChart'
import { ApiError } from '../auth/api'
import { IndicatorLibraryModal, createIndicator } from '../components/ChartWorkspacePanels'
import type { Drawing, IndicatorConfig } from '../market/chartTypes'
import { read, write, view, type Capability, type ReplayView } from './api'

const inputClass = 'min-w-0 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200'
const buttonClass = 'rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40'
export function ReplayWorkspace({ account, onClose, onCloseBlocked, launch }: { launch?: ReplayLaunch; account: string; onClose: () => void; onCloseBlocked?: (blocked: boolean) => void }) {
  const [entryMode, setEntryMode] = useState<'CURRENT' | 'PRICE'>('CURRENT')
  const [positionOpen, setPositionOpen] = useState(true)
  const [caps, setCaps] = useState<Capability[]>([]), [provider, setProvider] = useState(launch?.provider ?? 'COINBASE'), [symbol, setSymbol] = useState(launch?.instrument ?? 'BTC-USD'), [timeframe, setTimeframe] = useState(launch?.timeframe ?? '1h')
  const [start, setStart] = useState(() => launch?.from.slice(0, 10) ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)), [end, setEnd] = useState(() => launch?.to.slice(0, 10) ?? new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
  const [capital, setCapital] = useState('10000'), [session, setSession] = useState<ReplayView | null>(null), [sessions, setSessions] = useState<{ id: string; instrument: string; provider: string }[]>([])
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [coverage, setCoverage] = useState(''), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1000)
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG'), [entry, setEntry] = useState(''), [stop, setStop] = useState(''), [target, setTarget] = useState(''), [mode, setMode] = useState('RISK_PERCENT'), [size, setSize] = useState('1')
  const [targetMode, setTargetMode] = useState('PRICE'), [targetValue, setTargetValue] = useState('2'), [commission, setCommission] = useState('0'), [slippage, setSlippage] = useState('0')
  const [indicators, setIndicators] = useState<IndicatorConfig[]>([]), [indicatorOpen, setIndicatorOpen] = useState(false), [indicatorSearch, setIndicatorSearch] = useState('')
  const uncertain = useRef<{ path: string; body: unknown } | null>(null), flight = useRef(false), alive = useRef(true)
  useEffect(() => { onCloseBlocked?.(busy || !!uncertain.current) }, [busy, error, onCloseBlocked])
  function accept(next: ReplayView) {
    setSession(next)
    const position = next.trades.find(t => t.state === 'OPEN' || t.state === 'PENDING_ENTRY')
    if (position) { setTargetMode('PRICE'); setSide(position.side); setEntry(String(position.entry ?? position.intendedEntry)); setStop(String(position.stop)); setTarget(String(position.target)) }
  }
  useEffect(() => {
    alive.current = true
    void Promise.all([read(account, '/market/providers/capabilities'), read(account, '/replay')]).then(([providers, saved]) => {
      if (!alive.current) return
      setCaps((providers as { items: Capability[] }).items); setSessions(saved as typeof sessions)
    }).catch(e => { if (alive.current) setError(String(e.message)) })
    return () => { alive.current = false }
  }, [account])
  async function send(path: string, body: unknown) {
    if (flight.current) return
    flight.current = true; setBusy(true); onCloseBlocked?.(true); setError(''); uncertain.current = { path, body }
    try {
      const next = view(await write(account, path, body, path.endsWith('/commands') ? session?.cursor : undefined), session)
      if (alive.current) { accept(next); uncertain.current = null }
    } catch (e) { if (alive.current) { if (e instanceof ApiError && e.status < 500) uncertain.current = null; setError(e instanceof Error ? e.message : 'Replay unavailable'); setPlaying(false) } }
    finally { flight.current = false; if (alive.current) setBusy(false) }
  }
  const launched = useRef(false)
  useEffect(() => {
    if (launch && !launched.current) { launched.current = true; void send('/replay', { requestId: crypto.randomUUID(), ...launch }) }
  }, [launch])
  function command(action: string, extra = {}) {
    if (!session || uncertain.current) return
    return send(`/replay/${session.id}/commands`, { requestId: crypto.randomUUID(), expectedVersion: session.version, action, ...extra })
  }
  useEffect(() => {
    if (!playing || busy || !session || session.status !== 'ACTIVE') return
    const timer = setTimeout(() => { void command('STEP') }, speed)
    return () => clearTimeout(timer)
    // Session version schedules the next step only after the previous response.
  }, [playing, busy, session, speed])
  const active = session?.trades.find(t => t.state === 'OPEN' || t.state === 'PENDING_ENTRY')
  const controlsLocked = busy || !!uncertain.current || active?.state === 'PENDING_ENTRY'
  const risk = Math.abs(Number(entry) - Number(stop)), reward = Math.abs(Number(target) - Number(entry)), balance = session?.balance ?? Number(capital)
  const rawQuantity = mode === 'QUANTITY' ? Number(size) : (mode === 'RISK_PERCENT' ? balance * Number(size) / 100 : Number(size)) / risk
  const increment = session?.metadata.quantityIncrement ?? 1e-8
  const quantity = active ? active.quantity : Math.floor((rawQuantity + 1e-12) / increment) * increment
  useEffect(() => {
    if (targetMode === 'PRICE' || controlsLocked) return
    const value = Number(targetValue)
    const distance = targetMode === 'R' ? risk * value : (targetMode === 'PERCENT' ? balance * value / 100 : value) / quantity
    if (Number.isFinite(distance) && distance > 0) setTarget((Number(entry) + (side === 'LONG' ? distance : -distance)).toFixed(8))
  }, [targetMode, targetValue, risk, balance, quantity, entry, side, controlsLocked])
  const valid = Number(entry) > 0 && Number(stop) > 0 && Number(target) > 0 && (side === 'LONG' ? Number(stop) < Number(entry) && Number(entry) < Number(target) : Number(target) < Number(entry) && Number(entry) < Number(stop)) && quantity > 0 && Number.isFinite(quantity) && quantity * Number(entry) <= balance
  const chartPage = useMemo(() => session ? { dataset: { symbol: `${session.provider} · ${session.metadata.displaySymbol}` }, items: session.candles } : null, [session])
  const drawing = useMemo<Drawing[]>(() => {
    if (!session || !entry || !stop || !target) return []
    const time = session.candles[Math.max(0, session.cursor - 5)]?.time, later = session.candles[session.cursor]?.time
    return [{ id: 'replay-position', type: side === 'LONG' ? 'longPosition' : 'shortPosition', points: [{ time, price: Number(entry) }, { time: later, price: Number(stop) }, { time: later, price: Number(target) }] }]
  }, [session, entry, stop, target, side])
  function chooseSide(next: 'LONG' | 'SHORT') {
    if (!session || active) return
    const price = Number(session.candles[session.cursor].close)
    setEntryMode('CURRENT'); setSide(next); setEntry(price.toFixed(8)); setStop((price * (next === 'LONG' ? .99 : 1.01)).toFixed(8)); setTarget((price * (next === 'LONG' ? 1.02 : .98)).toFixed(8))
  }
  useEffect(() => {
    if (!session || active || entryMode !== 'CURRENT') return
    const price = Number(session.candles[session.cursor].close), previous = Number(entry)
    const stopPercent = previous > 0 ? Math.abs(Number(stop) - previous) / previous : .01
    const targetPercent = previous > 0 ? Math.abs(Number(target) - previous) / previous : .02
    const sign = side === 'LONG' ? 1 : -1
    setEntry(price.toFixed(8)); setStop((price * (1 - sign * stopPercent)).toFixed(8)); setTarget((price * (1 + sign * targetPercent)).toFixed(8))
  }, [session?.cursor, session?.id, entryMode, side])
  function updateDrawing(d: Drawing) {
    setTargetMode('PRICE')
    if (!active) { setEntryMode('PRICE'); setEntry(d.points[0].price.toFixed(8)) }
    setStop(d.points[1].price.toFixed(8)); setTarget(d.points[2].price.toFixed(8))
  }
  return <section aria-label="Replay Trading" className="flex h-full min-h-0 flex-col bg-[#141518] text-slate-200">
    <header className="flex flex-wrap items-center gap-2 border-b border-slate-800 p-2"><strong className="text-sm">Replay Trading</strong><span className="text-xs text-violet-300">SIMULATION</span><button disabled={busy || !!uncertain.current} className={`${buttonClass} ml-auto`} onClick={() => { setPlaying(false); onClose() }}>Back to chart</button></header>
    {error && <p role="alert" className="p-2 text-xs text-rose-300">{error}</p>}
    {error && session && !uncertain.current && <button className={buttonClass} onClick={async () => { try { accept(view(await read(account, `/replay/${session.id}`))); setError('') } catch (e) { setError(String((e as Error).message)) } }}>Reload saved session</button>}
    {uncertain.current && !busy && <button className={buttonClass} onClick={() => { const intent = uncertain.current; if (intent) void send(intent.path, intent.body) }}>Retry exact request</button>}
    {!session && launch && busy ? <p role="status" className="p-4 text-sm">Starting verified Replay {launch.provider} · {launch.instrument} · {launch.from}…</p> : !session ? <div className="overflow-auto p-4"><div className="grid max-w-2xl grid-cols-2 gap-3">
      <label className="grid gap-1 text-xs">Data source<select aria-label="Data source" className={inputClass} value={provider} onChange={e => { setProvider(e.target.value); setSymbol(e.target.value === 'BINANCE' ? 'BTCUSDT' : 'BTC-USD'); setCoverage('') }}>{caps.filter(c => c.configured && c.historicalReplaySupported).map(c => <option key={c.providerId} value={c.providerId}>{c.displayName}</option>)}</select></label>
      <label className="grid gap-1 text-xs">Provider symbol<input className={inputClass} value={symbol} onChange={e => { setSymbol(e.target.value); setCoverage('') }}/></label>
      <label className="grid gap-1 text-xs">Timeframe<select aria-label="Replay timeframe" className={inputClass} value={timeframe} onChange={e => { setTimeframe(e.target.value); setCoverage('') }}>{(caps.find(c => c.providerId === provider)?.supportedTimeframes ?? ['1h']).map(tf => <option key={tf}>{tf}</option>)}</select></label>
      <label className="grid gap-1 text-xs">Initial capital · quote currency<input className={inputClass} value={capital} onChange={e => setCapital(e.target.value)}/></label>
      <label className="grid gap-1 text-xs">Start UTC<input type="date" max={new Date().toISOString().slice(0, 10)} className={inputClass} value={start} onChange={e => { setStart(e.target.value); setCoverage('') }}/></label>
      <label className="grid gap-1 text-xs">End UTC<input type="date" min={start} max={new Date().toISOString().slice(0, 10)} className={inputClass} value={end} onChange={e => { setEnd(e.target.value); setCoverage('') }}/></label>
      <label className="grid gap-1 text-xs">Commission · basis points<input className={inputClass} value={commission} onChange={e => setCommission(e.target.value)}/></label>
      <label className="grid gap-1 text-xs">Adverse slippage · basis points<input className={inputClass} value={slippage} onChange={e => setSlippage(e.target.value)}/></label>
    </div><p className="my-3 text-xs text-slate-400">Provider history remains separate. Frankfurter reference rates do not support trading Replay. No live broker orders.</p>
      <button disabled={busy} className={buttonClass} onClick={async () => { setBusy(true); setError(''); try { const c = await read(account, `/market/providers/${provider}/coverage?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&from=${start}T00:00:00Z&to=${end}T00:00:00Z`) as { status: string; verifiedFromUtc: string; verifiedThroughUtc: string }; setCoverage(`${c.status}: ${c.verifiedFromUtc ?? 'unknown'} — ${c.verifiedThroughUtc ?? 'unknown'}`) } catch (e) { setError(String((e as Error).message)) } finally { setBusy(false) } }}>Check available history</button>
      <p className="my-2 text-xs">{coverage || 'Historical coverage has not been checked.'}</p>
      <button disabled={busy || !coverage.startsWith('PARTIAL') || !!uncertain.current} className={buttonClass} onClick={() => void send('/replay', { requestId: crypto.randomUUID(), provider, instrument: symbol, timeframe, from: `${start}T00:00:00Z`, to: `${end}T00:00:00Z`, initialBalance: capital, commissionBps: commission, slippageBps: slippage })}>Start Replay</button>
      <p className="my-3 text-xs text-slate-400">100 basis points = 1%. Market entry fills at the next revealed open; gaps can exceed intended risk.</p>
      {sessions.map(s => <button key={s.id} className={`${buttonClass} mt-2 block`} onClick={async () => { try { accept(view(await read(account, `/replay/${s.id}`))) } catch (e) { setError(String((e as Error).message)) } }}>Resume {s.provider} · {s.instrument}</button>)}
    </div> : <>
      <div className="flex flex-wrap items-center gap-2 p-2 text-xs"><span>{session.provider} · {session.instrument} · {session.timeframe}</span><span>Starting {session.initialBalance} · Balance {session.balance.toFixed(2)} · Equity {session.equity.toFixed(2)} {session.currency}</span><span>Realized {session.realizedPnl.toFixed(2)} · Open {session.openPnl.toFixed(2)}</span></div>
      <div className="flex flex-wrap gap-2 px-2"><button className={buttonClass} disabled={busy || session.status !== 'ACTIVE'} onClick={() => setPlaying(v => !v)}>{playing ? 'Pause' : 'Play'}</button><button className={buttonClass} disabled={busy || playing} onClick={() => void command('STEP')}>Step Forward</button><select aria-label="Replay speed" className={inputClass} value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={2000}>0.5x</option><option value={1000}>1x</option><option value={250}>4x</option></select><button disabled={!active || busy} className={buttonClass} onClick={() => void command('CLOSE')}>Close position</button><button disabled={busy || session.status !== 'ACTIVE'} className={buttonClass} onClick={() => { setPlaying(false); void command('END') }}>End Replay</button></div>
      <button className={`${buttonClass} self-start mx-3 mb-2`} onClick={() => setIndicatorOpen(true)}>Indicators</button>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto sm:flex-row"><aside aria-label="Replay tools" className="flex shrink-0 gap-1 border-slate-800 p-1 sm:w-11 sm:flex-col sm:border-r"><button aria-label="More chart controls" title="Indicators" className="grid h-8 w-8 place-items-center rounded hover:bg-slate-800" onClick={() => setIndicatorOpen(true)}><Icon name="more" className="h-4 w-4" /></button><button aria-label="Open Position Setup" title="Position Setup" aria-expanded={positionOpen} className="grid h-8 w-8 shrink-0 place-items-center rounded hover:bg-slate-800" onClick={() => setPositionOpen(v => !v)}><Icon name="longPosition" className="h-4 w-4" /></button></aside><div className="flex min-h-[300px] flex-1 flex-col">{chartPage && <CandleChart indicators={indicators} onOpenIndicators={() => setIndicatorOpen(true)} onToggleIndicator={id => setIndicators(items => items.map(item => item.id === id ? { ...item, visible: !item.visible } : item))} onRemoveIndicator={id => setIndicators(items => items.filter(item => item.id !== id))} positionLabel={valid ? `${side} · Risk ${(quantity * risk).toFixed(2)} ${session.currency} · R:R ${(reward / risk).toFixed(2)}` : undefined} fitDrawingPrices lockedDrawingHandles={controlsLocked || playing ? [0, 1, 2] : active ? [0] : []} page={chartPage} timeframe={session.timeframe} dataSource="historical simulation" drawings={drawing} selectedDrawingId="replay-position" onUpdateDrawing={updateDrawing} onCommitDrawingEdit={(_, d) => { if (active?.state === 'OPEN') void command('LEVELS', { stop: d.points[1].price.toFixed(8), target: d.points[2].price.toFixed(8) }) }}/>}</div>
        {positionOpen && <aside aria-label="Position Setup" className="grid content-start gap-2 border-l border-slate-800 p-3 w-full sm:w-64 sm:shrink-0"><strong className="text-xs">Position Setup · {active ? `${active.side} · ${active.state}` : `${side} · Draft`}</strong>
          <div className="flex gap-2"><button disabled={!!active || controlsLocked} className={buttonClass} aria-pressed={side === 'LONG'} onClick={() => chooseSide('LONG')}>Long</button><button disabled={!!active || controlsLocked} className={buttonClass} aria-pressed={side === 'SHORT'} onClick={() => chooseSide('SHORT')}>Short</button></div>
          <p className="text-xs">Available balance {session.balance.toFixed(2)} {session.currency}</p>
          <p className="text-xs text-slate-400">Quantity only: lot metadata unavailable. No verified contract lot size.</p>
          <label className="grid gap-1 text-xs">Entry mode<select aria-label="Entry mode" className={inputClass} value={entryMode} disabled={!!active || controlsLocked || playing} onChange={event => { setEntryMode(event.target.value as 'CURRENT' | 'PRICE'); if (event.target.value === 'CURRENT') chooseSide(side) }}><option value="CURRENT">Current revealed price</option><option value="PRICE">Manual price</option></select></label>
          {(['Stop Loss', 'Take Profit'] as const).map(label => <label key={label} className="grid gap-1 text-xs">{label} %<input type="number" min="0" step="any" aria-label={`${label} %`} className={inputClass} disabled={controlsLocked || playing} value={Number(entry) > 0 ? Number((Math.abs(Number(label === 'Stop Loss' ? stop : target) - Number(entry)) / Number(entry) * 100).toFixed(8)) : ''} onChange={event => { setTargetMode('PRICE'); const sign = (side === 'LONG' ? 1 : -1) * (label === 'Stop Loss' ? -1 : 1); (label === 'Stop Loss' ? setStop : setTarget)((Number(entry) * (1 + sign * Number(event.target.value) / 100)).toFixed(8)) }} /></label>)}
          {[['Entry', entry, setEntry], ['Stop Loss', stop, setStop], ['Take Profit', target, setTarget]].map(([label, value, setter]) => <label key={String(label)} className="grid gap-1 text-xs">{String(label)}<input className={inputClass} value={String(value)} disabled={controlsLocked || playing || label === 'Entry' && !!active} onChange={e => { if (label === 'Entry') setEntryMode('PRICE'); (setter as (s: string) => void)(e.target.value) }}/></label>)}
          <select aria-label="Target mode" disabled={controlsLocked || playing} className={inputClass} value={targetMode} onChange={e => setTargetMode(e.target.value)}><option value="PRICE">Target price</option><option value="AMOUNT">Target {session.currency}</option><option value="PERCENT">Target account %</option><option value="R">Target R multiple</option></select>
          {targetMode !== 'PRICE' && <label className="grid gap-1 text-xs">Target value<input disabled={controlsLocked || playing} className={inputClass} value={targetValue} onChange={e => { setTargetValue(e.target.value); const v = Number(e.target.value); const distance = targetMode === 'R' ? risk * v : (targetMode === 'PERCENT' ? balance * v / 100 : v) / quantity; if (Number.isFinite(distance) && distance > 0) setTarget((Number(entry) + (side === 'LONG' ? distance : -distance)).toFixed(8)) }}/></label>}
          <select aria-label="Sizing mode" disabled={!!active || controlsLocked} className={inputClass} value={mode} onChange={e => setMode(e.target.value)}><option value="RISK_PERCENT">Risk %</option><option value="RISK_AMOUNT">Risk {session.currency}</option><option value="QUANTITY">Manual quantity</option></select><input aria-label="Position size" disabled={!!active || controlsLocked} className={inputClass} value={size} onChange={e => setSize(e.target.value)}/>
          <p className="text-xs text-slate-400">Quantity {valid ? quantity.toFixed(8) : '—'}<br/>Risk {valid ? (quantity * risk).toFixed(2) : '—'} {session.currency}<br/>Reward {valid ? (quantity * reward).toFixed(2) : '—'} {session.currency}<br/>R:R {valid ? (reward / risk).toFixed(2) : '—'}</p>
          {valid && quantity * risk / balance > .1 && <p className="text-xs text-amber-300">Risk exceeds 10% of balance.</p>}
          <button disabled={!valid || !!active || busy || !!uncertain.current} className={buttonClass} onClick={() => { setPlaying(false); void command('CONFIRM', { order: { side, entry, stop, target, sizingMode: mode, size } }) }}>Confirm simulation</button>
          {active?.state === 'OPEN' && <button disabled={!valid || controlsLocked || playing} className={buttonClass} onClick={() => void command('LEVELS', { stop, target })}>Update SL/TP</button>}
          {session.trades.filter(t => t.state === 'CLOSED').map(t => <p key={t.id} className="text-xs">{t.side} {t.netPnl?.toFixed(2)} · Saved to Journal{t.ambiguity && <span className="block text-amber-300">Both touched: stop first.</span>}</p>)}
          {session.trades.filter(t => t.state === 'CANCELLED').map(t => <p key={t.id} role="status" className="text-xs text-amber-300">{t.side} · Cancelled: {t.exitReason === 'INSUFFICIENT_BALANCE' ? 'the next open price and fees exceeded available balance. Reduce position size before trying again.' : 'order cancelled before execution.'}</p>)}
        </aside>}</div>
    </>}
    <IndicatorLibraryModal open={indicatorOpen} search={indicatorSearch} active={indicators} onSearchChange={setIndicatorSearch} onAdd={option => { setIndicators(items => [...items, createIndicator(option, items.length)]); setIndicatorOpen(false) }} onClose={() => setIndicatorOpen(false)}/>
  </section>
}
