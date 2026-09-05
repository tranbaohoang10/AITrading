import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { displayMarketSymbol, type Instrument } from '../market/liveMarket'
import type { ChartSettings, IndicatorConfig, IndicatorType } from '../market/chartTypes'

const panel = 'absolute right-2 top-2 z-50 w-[min(30rem,calc(100%-1rem))] rounded-xl border border-slate-700 bg-slate-925 p-3 shadow-2xl'
const symbolPanel = 'absolute left-1/2 top-3 z-50 w-[min(44rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-925 p-3 shadow-2xl'
const field = 'h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-300'

const currencyFlag: Record<string, string> = { AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', NZD: '🇳🇿', USD: '🇺🇸' }
function CryptoLogo({ symbol }: { symbol: string }) {
  const common = { viewBox: '0 0 32 32', 'aria-hidden': true, className: 'h-6 w-6' }
  switch (symbol) {
    case 'BTC': return <svg {...common}><circle cx="16" cy="16" r="15" fill="#f7931a" /><text x="16" y="22" textAnchor="middle" fill="white" fontSize="18" fontWeight="700">₿</text></svg>
    case 'ETH': return <svg {...common}><path d="m16 2-8 13.2L16 20l8-4.8L16 2Z" fill="#bfc5d1" /><path d="m16 2 8 13.2L16 16V2Z" fill="#77808f" /><path d="m16 30-8-13.3 8 4.7 8-4.7L16 30Z" fill="#bfc5d1" /><path d="m16 30 8-13.3-8 4.7V30Z" fill="#77808f" /></svg>
    case 'SOL': return <svg {...common}><defs><linearGradient id="sol-logo" x1="0" x2="1"><stop stopColor="#14f195" /><stop offset="1" stopColor="#9945ff" /></linearGradient></defs><path d="M7 7h18l-4 4H3l4-4Zm0 7h18l-4 4H3l4-4Zm0 7h18l-4 4H3l4-4Z" fill="url(#sol-logo)" /></svg>
    case 'XRP': return <svg {...common}><path d="M6 7c3.9 0 4.8 5.5 10 5.5S22.1 7 26 7M6 25c3.9 0 4.8-5.5 10-5.5S22.1 25 26 25" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3.2" /></svg>
    case 'ADA': return <svg {...common}><g fill="currentColor"><circle cx="16" cy="16" r="3" /><circle cx="16" cy="7" r="1.6" /><circle cx="16" cy="25" r="1.6" /><circle cx="8.2" cy="11.5" r="1.6" /><circle cx="23.8" cy="11.5" r="1.6" /><circle cx="8.2" cy="20.5" r="1.6" /><circle cx="23.8" cy="20.5" r="1.6" /><circle cx="11.7" cy="7.8" r="1" /><circle cx="20.3" cy="7.8" r="1" /><circle cx="11.7" cy="24.2" r="1" /><circle cx="20.3" cy="24.2" r="1" /></g></svg>
    case 'LINK': return <svg {...common}><path d="m16 3 10 5.8v14.4L16 29 6 23.2V8.8L16 3Zm0 4.1-6.4 3.7v10.4l6.4 3.7 6.4-3.7V10.8L16 7.1Z" fill="currentColor" /></svg>
    case 'AVAX': return <svg {...common}><path d="m16.1 4.5 8.9 17.1h-5.2l-3.7-7.2-3.8 7.2H7.1L16.1 4.5Zm7.1 20.2h4.2L25.3 29h-4.2l2.1-4.3Z" fill="currentColor" /></svg>
    case 'POL': return <svg {...common}><path d="m11 9 5-3 5 3v5l-5 3-3-1.8v-3.7L11 10.3v5.4l5 3 5-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" /><path d="m16 15 5 3v5l-5 3-5-3v-5l5-3Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2.4" /></svg>
    case 'DOGE': return <svg {...common}><circle cx="16" cy="16" r="14" fill="#c2a633" /><path d="M12 8h5.5a7 7 0 0 1 0 14H12V8Zm3.1 3v8h2.1a4 4 0 0 0 0-8h-2.1Z" fill="white" /></svg>
    case 'LTC': return <svg {...common}><circle cx="16" cy="16" r="14" fill="#bfbbbb" /><path d="m17.7 6-4 11.1h5.7l-1.1 3h-7.6L15.7 6h2Z" fill="white" /></svg>
    case 'BCH': return <svg {...common}><circle cx="16" cy="16" r="14" fill="#8dc351" /><path d="M11 8h6.1a3.4 3.4 0 0 1 2.5 5.7 3.8 3.8 0 0 1-2.6 6.3H11V8Zm3 3v2h2.7a1 1 0 1 0 0-2H14Zm0 5v2h3a1 1 0 0 0 0-2h-3Z" fill="white" /></svg>
    default: return <svg {...common}><circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M10 16h12M16 10v12" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>
  }
}

const cryptoColors: Record<string, string> = { BTC: 'text-amber-400', ETH: 'text-slate-300', SOL: 'text-fuchsia-300', XRP: 'text-sky-300', ADA: 'text-blue-300', DOGE: 'text-amber-300', LTC: 'text-slate-300', BCH: 'text-emerald-300', LINK: 'text-blue-400', AVAX: 'text-rose-400', POL: 'text-violet-400' }

function InstrumentIcon({ instrument }: { instrument: Instrument }) {
  if (instrument.assetClass === 'FOREX') {
    const base = currencyFlag[instrument.base ?? ''] ?? '¤', quote = currencyFlag[instrument.quote ?? ''] ?? '¤'
    return <span role="img" aria-label={`${instrument.base ?? 'base'} and ${instrument.quote ?? 'quote'} currency flags`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-800 text-[11px] tracking-[-0.2em]">{base}{quote}</span>
  }
  if (instrument.assetClass === 'CRYPTO') {
    const base = instrument.base ?? instrument.symbol.split('-')[0]
    return <span role="img" aria-label={`${instrument.name} icon`} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-800 ${cryptoColors[base] ?? 'text-slate-200'}`}><CryptoLogo symbol={base} /></span>
  }
  const future = instrument.assetClass === 'FUTURES'
  return <span role="img" aria-label={`${instrument.name} ${future ? 'futures' : 'equity'} icon`} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${future ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}><Icon name={future ? 'performance' : 'chart'} className="h-4 w-4" /></span>
}

export function SymbolSearchModal({ open, query, instruments, onQueryChange, onSelect, onClose }: { open: boolean; query: string; instruments: Instrument[]; onQueryChange: (value: string) => void; onSelect: (instrument: Instrument) => void; onClose: () => void }) {
  const [category, setCategory] = useState<'ALL' | Instrument['assetClass']>('ALL')
  const availableCategories = useMemo(() => ['ALL', ...(['STOCK', 'ETF', 'CRYPTO', 'FOREX', 'FUTURES'] as const).filter(value => instruments.some(item => item.assetClass === value))] as const, [instruments])
  useEffect(() => { if (category !== 'ALL' && !availableCategories.includes(category)) setCategory('ALL') }, [availableCategories, category])
  const filtered = useMemo(() => instruments.filter(item => (category === 'ALL' || item.assetClass === category) && `${item.symbol} ${item.name} ${item.base ?? ''} ${item.quote ?? ''} ${item.exchange ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [category, instruments, query])
  if (!open) return null
  return <div role="dialog" aria-modal="true" aria-label="Symbol Search" className={symbolPanel}>
    <div className="flex items-center justify-between border-b border-slate-800 pb-3"><div><h2 className="text-lg font-semibold text-slate-100">Symbol Search</h2><p className="mt-0.5 text-[10px] text-slate-500">Crypto live · Forex ECB reference EOD · stocks when Alpaca is configured</p></div><button type="button" aria-label="Close Symbol Search" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-white"><Icon name="close" className="h-4 w-4" /></button></div>
    <label className="relative mt-4 block"><Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input autoFocus aria-label="Search symbols" value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Search symbol…" className={`${field} h-11 w-full pl-9 text-sm`} /></label>
    <div role="tablist" aria-label="Symbol categories" className="mt-3 flex gap-2 overflow-x-auto border-b border-slate-800 pb-2">{availableCategories.map(value => { const label = value === 'ALL' ? 'All' : value === 'ETF' ? 'ETFs' : value === 'CRYPTO' ? 'Crypto' : value === 'STOCK' ? 'Stocks' : value === 'FOREX' ? 'Forex' : 'Futures'; return <button key={value} type="button" role="tab" aria-selected={category === value} onClick={() => setCategory(value)} className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${category === value ? 'bg-slate-100 text-slate-950' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}>{label}</button> })}</div>
    <div className="mt-2 max-h-[min(28rem,calc(100vh-16rem))] overflow-y-auto">{filtered.length ? filtered.map(item => <button key={`${item.provider}:${item.symbol}`} type="button" onClick={() => onSelect(item)} className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-slate-800"><InstrumentIcon instrument={item} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-100">{item.displaySymbol ?? displayMarketSymbol(item.symbol)}</span><span className="block truncate text-xs text-slate-500">{item.name}</span></span><span className="rounded border border-slate-700 px-2 py-1 text-right text-[9px] font-semibold uppercase tracking-wide text-slate-400">{item.feed ?? item.exchange ?? item.assetClass}</span></button>) : <p className="px-2 py-8 text-center text-xs text-slate-500">No configured symbol matches this search.</p>}</div>
  </div>
}

type IndicatorOption = { type: IndicatorType; label: string; aliases: string; period: number; category: 'Built-ins' | 'AI Quant' | 'Community'; favorite?: boolean }
export const indicatorLibrary: IndicatorOption[] = [
  { type: 'sma', label: 'Simple Moving Average (SMA)', aliases: 'sma simple moving average trend', period: 50, category: 'Built-ins', favorite: true },
  { type: 'ema', label: 'Exponential Moving Average (EMA)', aliases: 'ema exponential moving average trend', period: 20, category: 'Built-ins', favorite: true },
  { type: 'wma', label: 'Weighted Moving Average (WMA)', aliases: 'wma weighted moving average trend', period: 20, category: 'Built-ins' },
  { type: 'bollinger', label: 'Bollinger Bands (BB)', aliases: 'bollinger bands bb volatility', period: 20, category: 'Built-ins', favorite: true },
  { type: 'vwap', label: 'Volume Weighted Average Price (VWAP)', aliases: 'vwap volume weighted average price', period: 1, category: 'Built-ins' },
  { type: 'rsi', label: 'Relative Strength Index (RSI)', aliases: 'rsi relative strength index oscillator', period: 14, category: 'Built-ins', favorite: true },
  { type: 'macd', label: 'Moving Average Convergence Divergence (MACD)', aliases: 'macd moving average convergence divergence oscillator', period: 26, category: 'Built-ins', favorite: true },
  { type: 'atr', label: 'Average True Range (ATR)', aliases: 'atr average true range volatility', period: 14, category: 'Built-ins' },
  { type: 'stochastic', label: 'Stochastic Oscillator', aliases: 'stochastic k oscillator momentum', period: 14, category: 'Built-ins' },
  { type: 'cci', label: 'Commodity Channel Index (CCI)', aliases: 'cci commodity channel index oscillator', period: 20, category: 'Built-ins' },
  { type: 'obv', label: 'On-Balance Volume (OBV)', aliases: 'obv on balance volume', period: 1, category: 'Built-ins' },
]

export function createIndicator(option: IndicatorOption, index: number): IndicatorConfig {
  return { id: `${option.type}-${Date.now()}-${index}`, type: option.type, period: option.period, ...(option.type === 'bollinger' ? { deviation: 2 } : option.type === 'macd' ? { fast: 12, slow: 26, signal: 9 } : {}), color: ['#60a5fa', '#f59e0b', '#a78bfa', '#34d399', '#fb7185', '#c084fc', '#fbbf24'][index % 7], visible: true }
}

export function IndicatorLibraryModal({ open, search, active, onSearchChange, onAdd, onClose }: { open: boolean; search: string; active: IndicatorConfig[]; onSearchChange: (value: string) => void; onAdd: (option: IndicatorOption) => void; onClose: () => void }) {
  const [section, setSection] = useState<'Favorites' | 'My Indicators' | 'Built-ins' | 'AI Quant' | 'Community'>('Built-ins')
  const [favorites, setFavorites] = useState<string[]>(() => indicatorLibrary.filter(option => option.favorite).map(option => option.type))
  if (!open) return null
  const normalized = search.trim().toLowerCase()
  const options = indicatorLibrary.filter(option => (section === 'Favorites' ? favorites.includes(option.type) || option.favorite : section === 'My Indicators' ? false : option.category === section) && (!normalized || `${option.label} ${option.aliases}`.toLowerCase().includes(normalized)))
  return <div role="dialog" aria-modal="true" aria-label="Indicators" className={panel}>
    <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-100">Indicators</h2><p className="mt-0.5 text-[10px] text-slate-500">Local OHLCV studies · no untrusted scripts executed</p></div><button type="button" aria-label="Close Indicators" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-white"><Icon name="close" className="h-4 w-4" /></button></div>
    <input autoFocus aria-label="Search indicators" value={search} onChange={event => onSearchChange(event.target.value)} placeholder="Search indicators…" className={`${field} mt-3 w-full`} />
    <div role="tablist" aria-label="Indicator sections" className="mt-3 flex min-w-0 gap-1 overflow-x-auto border-b border-slate-800 pb-1">{(['Favorites', 'My Indicators', 'Built-ins', 'AI Quant', 'Community'] as const).map(value => <button key={value} type="button" role="tab" aria-selected={section === value} onClick={() => setSection(value)} className={`shrink-0 whitespace-nowrap rounded px-2 py-1 text-[10px] ${section === value ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}>{value}</button>)}</div>
    <div className="mt-2 max-h-64 overflow-y-auto">{options.length ? options.map(option => { const added = active.some(item => item.type === option.type); const favorite = favorites.includes(option.type); return <div key={option.type} className="flex min-h-10 items-center gap-2 rounded-lg px-2 hover:bg-slate-800"><button type="button" aria-label={`${favorite ? 'Remove' : 'Add'} ${option.label} favorite`} onClick={() => setFavorites(value => favorite ? value.filter(item => item !== option.type) : [...value, option.type])} className="text-sm text-amber-300">{favorite ? '★' : '☆'}</button><button type="button" disabled={added} onClick={() => onAdd(option)} className="flex min-h-9 min-w-0 flex-1 items-center gap-2 text-left text-xs text-slate-300 disabled:text-slate-600"><Icon name={added ? 'check' : 'plus'} className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{option.label}</span><span className="ml-auto text-[9px] text-slate-600">{added ? 'Added' : option.type.toUpperCase()}</span></button></div> }) : <p className="px-2 py-6 text-center text-xs text-slate-500">No indicators in this section.</p>}</div>
  </div>
}

const timezones: Array<{ value: ChartSettings['timezone']; label: string }> = [{ value: 'EXCHANGE', label: 'Exchange (UTC)' }, { value: 'LOCAL', label: 'Local browser time' }, { value: 'UTC', label: 'UTC' }, { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh' }, { value: 'America/New_York', label: 'America/New_York' }, { value: 'Europe/London', label: 'Europe/London' }, { value: 'Asia/Tokyo', label: 'Asia/Tokyo' }]
export function ChartSettingsModal({ open, settings, onChange, onClose }: { open: boolean; settings: ChartSettings; onChange: (next: ChartSettings) => void; onClose: () => void }) {
  if (!open) return null
  const update = (value: Partial<ChartSettings>) => onChange({ ...settings, ...value })
  return <div role="dialog" aria-modal="true" aria-label="Chart settings" className={panel}>
    <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-100">Chart settings</h2><p className="mt-0.5 text-[10px] text-slate-500">Display preferences are local to this chart cell</p></div><button type="button" aria-label="Close Chart settings" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-white"><Icon name="close" className="h-4 w-4" /></button></div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-300"><label className="col-span-2 flex items-center justify-between rounded-md bg-slate-900/60 px-2 py-1.5">Timezone<select aria-label="Chart timezone" value={settings.timezone} onChange={event => update({ timezone: event.target.value as ChartSettings['timezone'] })} className={`${field} ml-2 max-w-48`}>{timezones.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{(['showSymbol', 'showOhlc', 'showVolume', 'showPriceLine', 'showLastValue', 'showGrid', 'showCrosshair', 'showIndicatorTitles', 'showIndicatorValues', 'candleBorders', 'candleWicks'] as const).map(key => <label key={key} className="flex items-center gap-2 rounded-md bg-slate-900/60 px-2 py-1.5"><input type="checkbox" checked={settings[key]} onChange={event => update({ [key]: event.target.checked })} />{key.replace(/^show|([A-Z])/g, (_, upper: string) => upper ? ` ${upper}` : '').replace(/^./, value => value.toUpperCase())}</label>)}<label className="col-span-2 flex items-center gap-2 rounded-md bg-slate-900/60 px-2 py-1.5">Candle spacing<input type="range" min="35" max="100" value={settings.spacing} onChange={event => update({ spacing: Number(event.target.value) })} className="flex-1" /><span className="w-7 text-right font-mono">{settings.spacing}</span></label><label className="flex items-center justify-between rounded-md bg-slate-900/60 px-2 py-1.5">Price increment<input aria-label="Price increment" type="number" min="0.00000001" step="any" value={settings.priceIncrement ?? 0.01} onChange={event => update({ priceIncrement: Math.max(Number(event.target.value) || 0.01, 0.00000001) })} className={`${field} ml-2 w-24`} /></label><label className="flex items-center justify-between rounded-md bg-slate-900/60 px-2 py-1.5">Precision<input aria-label="Price precision" type="number" min="0" max="12" value={settings.pricePrecision ?? 2} onChange={event => update({ pricePrecision: Math.max(0, Math.min(12, Number(event.target.value) || 0)) })} className={`${field} ml-2 w-16`} /></label></div>
  </div>
}

function timezoneForClock(value: ChartSettings['timezone']) { return value === 'LOCAL' ? Intl.DateTimeFormat().resolvedOptions().timeZone : value === 'EXCHANGE' ? 'UTC' : value }
export function ChartClock({ timezone, onChange }: { timezone: ChartSettings['timezone']; onChange?: (value: ChartSettings['timezone']) => void }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(timer) }, [])
  return <details className="relative"><summary aria-label="Chart clock" title="Clock / timezone" className="grid h-7 cursor-pointer list-none place-items-center rounded-md px-1.5 text-[10px] text-slate-500 hover:bg-slate-800 hover:text-slate-100"><Icon name="clock" className="h-3.5 w-3.5" /></summary><div className="absolute bottom-9 right-0 z-40 w-56 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-2xl"><p className="font-mono text-sm text-slate-100">{new Intl.DateTimeFormat('en-GB', { timeZone: timezoneForClock(timezone), dateStyle: 'medium', timeStyle: 'medium', hour12: false }).format(now)}</p><p className="mt-1 text-[10px] text-slate-500">{timezone === 'EXCHANGE' ? 'Exchange time · UTC for Coinbase public feed' : timezone === 'LOCAL' ? 'Browser local time' : timezone}</p>{onChange && <select aria-label="Clock timezone" value={timezone} onChange={event => onChange(event.target.value as ChartSettings['timezone'])} className={`${field} mt-2 w-full`}>{timezones.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select>}</div></details>
}
