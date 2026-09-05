import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'
import { displayMarketSymbol, type Instrument } from '../market/liveMarket'
import type { ChartSettings, IndicatorConfig, IndicatorType } from '../market/chartTypes'

const panel = 'absolute right-2 top-2 z-50 w-[min(30rem,calc(100%-1rem))] rounded-xl border border-slate-700 bg-slate-925 p-3 shadow-2xl'
const symbolPanel = 'absolute left-1/2 top-3 z-50 w-[min(44rem,calc(100%-1.5rem))] -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-925 p-3 shadow-2xl'
const field = 'h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-300'

const currencyFlag: Record<string, string> = { AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', NZD: '🇳🇿', USD: '🇺🇸' }
const cryptoMark: Record<string, { mark: string; className: string }> = {
  BTC: { mark: '₿', className: 'bg-amber-500 text-white' }, ETH: { mark: 'Ξ', className: 'bg-slate-500 text-white' }, SOL: { mark: 'S', className: 'bg-fuchsia-600 text-white' }, XRP: { mark: 'X', className: 'bg-sky-600 text-white' }, ADA: { mark: 'A', className: 'bg-blue-600 text-white' }, DOGE: { mark: 'Ð', className: 'bg-amber-700 text-white' }, LTC: { mark: 'Ł', className: 'bg-slate-400 text-slate-950' }, BCH: { mark: 'B', className: 'bg-emerald-600 text-white' }, LINK: { mark: 'L', className: 'bg-blue-500 text-white' }, AVAX: { mark: 'A', className: 'bg-rose-600 text-white' }, POL: { mark: 'P', className: 'bg-violet-600 text-white' },
}

function InstrumentIcon({ instrument }: { instrument: Instrument }) {
  if (instrument.assetClass === 'FOREX') {
    const base = currencyFlag[instrument.base ?? ''] ?? '¤', quote = currencyFlag[instrument.quote ?? ''] ?? '¤'
    return <span role="img" aria-label={`${instrument.base ?? 'base'} and ${instrument.quote ?? 'quote'} currency flags`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-800 text-[11px] tracking-[-0.2em]">{base}{quote}</span>
  }
  if (instrument.assetClass === 'CRYPTO') {
    const mark = cryptoMark[instrument.base ?? instrument.symbol.split('-')[0]] ?? { mark: (instrument.base ?? instrument.symbol).slice(0, 1), className: 'bg-slate-700 text-slate-100' }
    return <span role="img" aria-label={`${instrument.name} icon`} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base font-semibold ${mark.className}`}>{mark.mark}</span>
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
