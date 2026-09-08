import { useRef, useState } from 'react'
import { AnchoredPopover } from '../components/AnchoredPopover'
import { read } from './api'

export type ReplayLaunch = { provider: string; instrument: string; timeframe: string; from: string; to: string; initialBalance: string; commissionBps: string; slippageBps: string }
export function replayRange(mode: 'DAY' | 'MONTH', value: string) {
  if (!(mode === 'DAY' ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/).test(value)) return null
  const day = mode === 'MONTH' ? `${value}-01` : value, from = new Date(`${day}T00:00:00Z`)
  if (!Number.isFinite(from.getTime()) || from.toISOString().slice(0, 10) !== day) return null
  const to = new Date(from)
  if (mode === 'MONTH') to.setUTCMonth(to.getUTCMonth() + 1); else to.setUTCDate(to.getUTCDate() + 1)
  return { from: from.toISOString().replace('.000Z', 'Z'), to: to.toISOString().replace('.000Z', 'Z') }
}
export function ReplayLauncher({ account, provider, symbol, timeframe, onLaunch }: { account: string; provider: string; symbol: string; timeframe: string; onLaunch: (draft?: ReplayLaunch) => void }) {
  return <AnchoredPopover label="Open Bar Replay" title="Bar Replay" width={340} triggerContent={<svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 4v16M8 16V9m4 7V5m4 8V7M8 20h7"/><path d="m17 14 5 3.5-5 3.5Z"/></svg>}>
    {close => <ReplayStartForm key={`${provider}:${symbol}:${timeframe}`} account={account} provider={provider} symbol={symbol} timeframe={timeframe} onLaunch={draft => { onLaunch(draft); close() }} />}
  </AnchoredPopover>
}
function ReplayStartForm({ account, provider, symbol, timeframe, onLaunch }: { account: string; provider: string; symbol: string; timeframe: string; onLaunch: (draft?: ReplayLaunch) => void }) {
  const [mode, setMode] = useState<'DAY' | 'MONTH'>('DAY'), [value, setValue] = useState(new Date(Date.now() - 86400000 * 30).toISOString().slice(0, 10))
  const [coverage, setCoverage] = useState(''), [ready, setReady] = useState(false), [busy, setBusy] = useState(false)
  const version = useRef(0)
  const range = replayRange(mode, value)
  const valid = !!range && Date.parse(range.to) <= Date.now() && Date.parse(range.from) >= Date.parse('2000-01-01') && (Date.parse(range.to) - Date.parse(range.from)) / ({ '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000, '1h': 3600000, '4h': 14400000, '1d': 86400000 }[timeframe] ?? 1) <= 20000 && provider !== 'FRANKFURTER'
  const invalidate = () => { version.current++; setReady(false); setCoverage('') }
  const button = 'rounded border border-slate-600 px-3 py-2 text-xs hover:bg-slate-800 disabled:opacity-40'
  return <div className="grid gap-3 text-xs"><strong>Bar Replay · Simulation</strong><p>{provider} · {symbol} · {timeframe}</p><div className="flex gap-2">{(['DAY', 'MONTH'] as const).map(item => <button className={button} aria-pressed={mode === item} key={item} onClick={() => { invalidate(); setMode(item); setValue(item === 'MONTH' ? value.slice(0, 7) : `${value.slice(0, 7)}-01`) }}>{item === 'DAY' ? 'Day' : 'Month'}</button>)}</div>
    <label>{mode === 'DAY' ? 'Day' : 'Month'} UTC<input aria-label={mode === 'DAY' ? 'Replay day' : 'Replay month'} type={mode === 'DAY' ? 'date' : 'month'} value={value} onChange={event => { invalidate(); setValue(event.target.value) }} className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2" /></label>
    <p>{range ? `${range.from} → ${range.to} (exclusive)` : 'Choose a valid calendar range.'}</p>
    {!valid && <p role="status">Choose a completed historical range within 20,000 bars. ECB reference data cannot be traded in Replay.</p>}
    <button className={button} disabled={!valid || busy} onClick={async () => {
      if (!range) return
      const captured = ++version.current; setBusy(true); setReady(false); setCoverage('Checking coverage…')
      try { const result = await read(account, `/market/providers/${provider}/coverage?${new URLSearchParams({ symbol, timeframe, ...range })}`) as { status: string; verifiedFromUtc: string; verifiedThroughUtc: string }
        if (captured === version.current) { const usable = result.status === 'PARTIAL' && !!result.verifiedFromUtc && !!result.verifiedThroughUtc; setReady(usable); setCoverage(usable ? `Verified ${result.verifiedFromUtc} — ${result.verifiedThroughUtc}; missing buckets remain gaps.` : 'Historical coverage unknown or unavailable.') }
      } catch { if (captured === version.current) setCoverage('Coverage unavailable. Retry the selected range.') } finally { setBusy(false) }
    }}>Check available history</button><p role="status">{coverage || 'Historical coverage has not been checked.'}</p>
    <button className={button} disabled={!ready || !valid || busy} onClick={() => { if (range) onLaunch({ provider, instrument: symbol, timeframe, ...range, initialBalance: '10000', commissionBps: '0', slippageBps: '0' }) }}>Start Replay</button>
    <p>Initial simulation balance: 10,000 quote currency · fees/slippage: 0 bps.</p><button className={button} onClick={() => onLaunch()}>Resume saved Replay / advanced setup</button>
  </div>
}
