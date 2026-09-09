import { useEffect, useMemo, useState } from 'react'
import { AnchoredPopover } from '../components/AnchoredPopover'
import { Icon } from '../components/Icon'
import type { Drawing } from './chartTypes'
import { timeframeMilliseconds, type Timeframe } from './chartMath'
import { formatMarketPrice, type Instrument, type MarketCandle } from './liveMarket'

type PositionSide = 'LONG' | 'SHORT'
type SizingMode = 'ACCOUNT_PERCENT' | 'LOT_QUANTITY'

const inputClass = 'min-w-0 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100'
const buttonClass = 'rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40'

export function positionSetupValues({ side, entry, stopPercent, targetPercent, capital, sizingMode, size }: {
  side: PositionSide; entry: number; stopPercent: number; targetPercent: number; capital: number; sizingMode: SizingMode; size: number
}) {
  const direction = side === 'LONG' ? 1 : -1
  const stop = entry * (1 - direction * stopPercent / 100)
  const target = entry * (1 + direction * targetPercent / 100)
  const quantity = sizingMode === 'ACCOUNT_PERCENT' ? capital * size / 100 / entry : size
  const risk = quantity * Math.abs(entry - stop), reward = quantity * Math.abs(target - entry)
  return { stop, target, quantity, risk, reward, ratio: risk > 0 ? reward / risk : 0 }
}

export function PositionSetupPopover({ instrument, candle, timeframe, onApply }: {
  instrument: Instrument; candle?: MarketCandle; timeframe: Timeframe; onApply: (drawing: Drawing) => void
}) {
  const current = Number(candle?.close)
  const [side, setSide] = useState<PositionSide>('LONG'), [entry, setEntry] = useState(Number.isFinite(current) ? String(current) : '')
  const [stopPercent, setStopPercent] = useState('1'), [targetPercent, setTargetPercent] = useState('2')
  const [capital, setCapital] = useState('10000'), [sizingMode, setSizingMode] = useState<SizingMode>('ACCOUNT_PERCENT'), [size, setSize] = useState('1')
  useEffect(() => { if (Number.isFinite(current) && current > 0) setEntry(String(current)) }, [current, instrument.symbol])
  const values = useMemo(() => positionSetupValues({ side, entry: Number(entry), stopPercent: Number(stopPercent), targetPercent: Number(targetPercent), capital: Number(capital), sizingMode, size: Number(size) }), [capital, entry, side, size, sizingMode, stopPercent, targetPercent])
  const valid = [Number(entry), Number(stopPercent), Number(targetPercent), Number(capital), Number(size), values.stop, values.target, values.quantity].every(value => Number.isFinite(value) && value > 0)
  const price = (value: number) => formatMarketPrice(value, instrument.priceIncrement, instrument.pricePrecision)
  return <AnchoredPopover label="Open Position Setup" title="Position Setup" width={360} triggerContent={<Icon name="longPosition" className="h-4 w-4" />}>
    {close => <div className="grid gap-3 text-xs">
      <div><strong className="text-sm">Position Setup</strong><p className="mt-1 text-slate-400">Visual planning only. No broker order or Replay session is created.</p></div>
      <div className="grid grid-cols-2 gap-2">{(['LONG', 'SHORT'] as const).map(value => <button type="button" key={value} aria-pressed={side === value} className={`${buttonClass} ${side === value ? value === 'LONG' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-200' : 'border-rose-500 bg-rose-500/10 text-rose-200' : ''}`} onClick={() => setSide(value)}>{value === 'LONG' ? 'Long' : 'Short'}</button>)}</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">Entry<input aria-label="Position entry" type="number" min="0" step="any" className={inputClass} value={entry} onChange={event => setEntry(event.target.value)} /></label>
        <label className="grid gap-1">Default capital<input aria-label="Default capital" type="number" min="0" step="any" className={inputClass} value={capital} onChange={event => setCapital(event.target.value)} /></label>
        <label className="grid gap-1">Stop Loss %<input aria-label="Position Stop Loss %" type="number" min="0" step="any" className={inputClass} value={stopPercent} onChange={event => setStopPercent(event.target.value)} /></label>
        <label className="grid gap-1">Take Profit %<input aria-label="Position Take Profit %" type="number" min="0" step="any" className={inputClass} value={targetPercent} onChange={event => setTargetPercent(event.target.value)} /></label>
        <label className="col-span-2 grid gap-1">Position sizing<select aria-label="Position sizing mode" className={inputClass} value={sizingMode} onChange={event => setSizingMode(event.target.value as SizingMode)}><option value="ACCOUNT_PERCENT">Account %</option><option value="LOT_QUANTITY">Lot / quantity</option></select></label>
        <label className="col-span-2 grid gap-1">{sizingMode === 'ACCOUNT_PERCENT' ? 'Capital used %' : 'Lot / quantity'}<input aria-label="Position size" type="number" min="0" step="any" className={inputClass} value={size} onChange={event => setSize(event.target.value)} /></label>
      </div>
      <div aria-label="Position Setup summary" className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border border-slate-800 bg-slate-950/70 p-2 text-slate-300">
        <span>Entry</span><strong className="text-right">{valid ? price(Number(entry)) : '—'}</strong><span>Stop Loss</span><strong className="text-right text-rose-300">{valid ? price(values.stop) : '—'}</strong><span>Take Profit</span><strong className="text-right text-emerald-300">{valid ? price(values.target) : '—'}</strong><span>Quantity</span><strong className="text-right">{valid ? values.quantity.toFixed(8) : '—'}</strong><span>Risk / Reward</span><strong className="text-right">{valid ? `${values.risk.toFixed(2)} / ${values.reward.toFixed(2)} · 1:${values.ratio.toFixed(2)}` : '—'}</strong>
      </div>
      {sizingMode === 'LOT_QUANTITY' && <p className="text-slate-500">Where verified contract-lot metadata is unavailable, this value is treated as provider quantity rather than inventing a lot size.</p>}
      <button type="button" className={buttonClass} disabled={!valid || !candle} onClick={() => {
        if (!candle) return
        const start = new Date(candle.openTime).toISOString(), end = new Date(candle.openTime + timeframeMilliseconds(timeframe) * 12).toISOString()
        onApply({ id: `position-setup-${crypto.randomUUID()}`, type: side === 'LONG' ? 'longPosition' : 'shortPosition', text: `${side} · ${sizingMode === 'ACCOUNT_PERCENT' ? `${size}% capital` : `${size} qty`} · Risk ${values.risk.toFixed(2)} · R:R ${values.ratio.toFixed(2)}`, points: [{ time: start, price: Number(entry) }, { time: end, price: values.stop }, { time: end, price: values.target }] })
        close()
      }}>Show setup on chart</button>
    </div>}
  </AnchoredPopover>
}
