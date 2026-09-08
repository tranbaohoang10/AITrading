import { useState } from 'react'
import type { Instrument } from '../market/liveMarket'

const localIcons = new Set(['BTC', 'ETH', 'SOL', 'XRP'])
const flags: Record<string, string> = { AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', NZD: '🇳🇿', USD: '🇺🇸' }
export function SymbolIcon({ instrument }: { instrument: Pick<Instrument, 'symbol' | 'base' | 'quote' | 'assetClass' | 'name'> }) {
  const base = (instrument.base ?? instrument.symbol.split(/[-/]/)[0]).toUpperCase()
  const [failed, setFailed] = useState('')
  if (instrument.assetClass === 'CRYPTO' && localIcons.has(base) && failed !== base) return <img alt={`${instrument.name} icon`} title="CC0-1.0 · spothq/cryptocurrency-icons" src={`/symbol-icons/${base.toLowerCase()}.svg`} onError={() => setFailed(base)} className="h-7 w-7 shrink-0" width="28" height="28" />
  const text = instrument.assetClass === 'FOREX' && flags[base] && flags[instrument.quote ?? ''] ? `${flags[base]}${flags[instrument.quote!]}` : base.replace(/[^A-Z0-9]/g, '').slice(0, 3) || '?'
  return <span role="img" aria-label={instrument.assetClass === 'FOREX' && flags[base] && flags[instrument.quote ?? ''] ? `${base} and ${instrument.quote} currency flags` : `${instrument.name} symbol fallback`} title={`${instrument.assetClass} · symbol fallback (logo unavailable)`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-600 bg-slate-800 text-[9px] font-semibold text-slate-200">{text}</span>
}
