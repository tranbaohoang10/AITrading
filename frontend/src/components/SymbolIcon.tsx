import { useState } from 'react'
import type { Instrument } from '../market/liveMarket'

export const approvedCryptoIconBases = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'AVAX', 'LTC', 'BCH', 'USDT', 'DOT', 'SUI', 'UNI', 'AAVE', 'XLM', 'HBAR'] as const
const localIcons = new Set<string>(approvedCryptoIconBases)
const commodityIcons: Record<string, string> = { XAU: 'gold', XAG: 'silver', USOIL: 'oil' }
const equityIcons: Record<string, string> = { AAPL: 'apple', NVDA: 'nvidia', MSFT: 'microsoft', TSLA: 'tesla', AMZN: 'amazon', META: 'meta', GOOGL: 'google', GOOG: 'google', AMD: 'amd', SPY: 'spy', QQQ: 'qqq', IWM: 'iwm', DIA: 'dia' }
export const approvedEquityIconBases = Object.freeze(Object.keys(equityIcons))
const flags: Record<string, string> = { AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', NZD: '🇳🇿', USD: '🇺🇸' }
const instrumentBase = (instrument: Pick<Instrument, 'symbol' | 'base'>) => (instrument.base ?? instrument.symbol.split(/[-/]/)[0]).toUpperCase()
export function hasApprovedSymbolIcon(instrument: Pick<Instrument, 'symbol' | 'base' | 'quote' | 'assetClass'>): boolean {
  const base = instrumentBase(instrument)
  return instrument.assetClass === 'COMMODITY' ? Boolean(commodityIcons[base]) : instrument.assetClass === 'CRYPTO' ? localIcons.has(base) : instrument.assetClass === 'FOREX' ? Boolean(flags[base] && flags[instrument.quote ?? '']) : ['STOCK', 'ETF'].includes(instrument.assetClass) ? Boolean(equityIcons[base]) : false
}
export function SymbolIcon({ instrument }: { instrument: Pick<Instrument, 'symbol' | 'base' | 'quote' | 'assetClass' | 'name'> }) {
  const base = instrumentBase(instrument)
  const [failed, setFailed] = useState('')
  if (instrument.assetClass === 'COMMODITY' && commodityIcons[base] && failed !== base) return <img alt={`${instrument.name} icon`} src={`/symbol-icons/${commodityIcons[base]}.svg`} onError={() => setFailed(base)} className="h-7 w-7 shrink-0" width="28" height="28" />
  if (instrument.assetClass === 'CRYPTO' && localIcons.has(base) && failed !== base) return <img alt={`${instrument.name} icon`} title="CC0-1.0 · spothq/cryptocurrency-icons" src={`/symbol-icons/${base.toLowerCase()}.svg`} onError={() => setFailed(base)} className="h-7 w-7 shrink-0" width="28" height="28" />
  if (['STOCK', 'ETF'].includes(instrument.assetClass) && equityIcons[base] && failed !== base) return <img alt={`${instrument.name} icon`} title="Local approved instrument icon" src={`/symbol-icons/${equityIcons[base]}.svg`} onError={() => setFailed(base)} className="h-7 w-7 shrink-0 rounded-md" width="28" height="28" />
  const text = instrument.assetClass === 'FOREX' && flags[base] && flags[instrument.quote ?? ''] ? `${flags[base]}${flags[instrument.quote!]}` : base.replace(/[^A-Z0-9]/g, '').slice(0, 3) || '?'
  return <span role="img" aria-label={instrument.assetClass === 'FOREX' && flags[base] && flags[instrument.quote ?? ''] ? `${base} and ${instrument.quote} currency flags` : `${instrument.name} symbol fallback`} title={`${instrument.assetClass} · symbol fallback (logo unavailable)`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-600 bg-slate-800 text-[9px] font-semibold text-slate-200">{text}</span>
}
