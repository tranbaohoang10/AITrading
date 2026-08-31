import { useEffect, useRef, useState } from 'react'
import { buttonClass, inputClass } from '../auth/AuthForm'
import type { ImportDraft } from './api'
import { useMarket } from './MarketContext'

const header = 'timestamp,open,high,low,close,volume\n'
export function syntheticCsv() {
  const rows = Array.from({ length: 360 }, (_, i) => {
    const open = 100 + i * .03 + Math.sin(i / 8) * 3, close = open + Math.sin(i * .7) * .9
    return [new Date(Date.UTC(2024, 0, 1, i)).toISOString().replace('.000Z', 'Z'), open.toFixed(2),
      (Math.max(open, close) + .5).toFixed(2), (Math.min(open, close) - .5).toFixed(2), close.toFixed(2), String(100 + (i * 37) % 300)].join(',')
  })
  return header + rows.join('\n') + '\n'
}
export function ImportForm({ onComplete, onClose }: { onComplete: () => void; onClose: () => void }) {
  const market = useMarket()!
  const [draft, setDraft] = useState<ImportDraft>({ name: '', symbol: '', timeframe: '1h', sourceKind: 'USER_UPLOAD', sourceLabel: '', csv: '' })
  const [fileError, setFileError] = useState(''), [reading, setReading] = useState(false)
  const reader = useRef<FileReader | null>(null)
  useEffect(() => () => { if (reader.current?.readyState === FileReader.LOADING) reader.current.abort() }, [])
  const disabled = market.busy || market.uncertain || reading
  const update = (key: keyof ImportDraft, value: string) => setDraft(old => ({ ...old, [key]: value }))
  const file = (chosen?: File) => {
    setFileError('')
    if (!chosen) return
    if (!chosen.name.toLowerCase().endsWith('.csv') || chosen.size > 1024 * 1024 || chosen.size === 0) { setFileError('Choose a nonempty UTF-8 .csv file up to 1 MiB.'); return }
    if (reader.current?.readyState === FileReader.LOADING) reader.current.abort()
    const next = new FileReader(); reader.current = next; setReading(true)
    next.onload = () => {
      try {
        const csv = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(next.result as ArrayBuffer)
        setDraft(old => ({ ...old, csv, name: old.name || chosen.name.slice(0, -4).slice(0, 120) }))
      } catch { setFileError('The file is not valid UTF-8 CSV.') }
      setReading(false)
    }
    next.onerror = () => { setFileError('The file could not be read. Choose it again.'); setReading(false) }
    next.onabort = () => setReading(false)
    next.readAsArrayBuffer(chosen)
  }
  return <form className="mx-auto max-h-[94vh] w-[min(720px,94vw)] space-y-4 overflow-y-auto border border-slate-700 bg-slate-950 p-5 text-slate-100" onSubmit={async event => {
    event.preventDefault(); setFileError('')
    if (new TextEncoder().encode(draft.csv).length > 1024 * 1024) { setFileError('CSV must be at most 1 MiB.'); return }
    if (await market.importData(market.uncertain ? undefined : draft)) onComplete()
  }}>
    <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Import market data</h2><button type="button" className={buttonClass} disabled={market.busy || market.uncertain} onClick={onClose}>Close import</button></div>
    <p className="text-xs leading-5 text-slate-400">Owned CSV dataset · UTC closed candles · up to 5,000 rows / 1 MiB. The platform does not verify your declared data source.</p>
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs">Dataset name<input className={inputClass} required maxLength={120} value={draft.name} onChange={event => update('name', event.target.value)} /></label>
        <label className="space-y-1 text-xs">Market symbol<input className={inputClass} required maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,31}" value={draft.symbol} onChange={event => update('symbol', event.target.value)} /></label>
        <label className="space-y-1 text-xs">Candle timeframe<select className={inputClass} value={draft.timeframe} onChange={event => update('timeframe', event.target.value)}>{['1m', '5m', '15m', '30m', '1h', '4h', '1d'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="space-y-1 text-xs">Source kind<select className={inputClass} value={draft.sourceKind} onChange={event => update('sourceKind', event.target.value)}><option value="USER_UPLOAD">User upload · unverified</option><option value="SYNTHETIC">Synthetic / generated data</option></select></label>
      </div>
      <label className="block space-y-1 text-xs">Source description<input className={inputClass} required maxLength={120} value={draft.sourceLabel} onChange={event => update('sourceLabel', event.target.value)} /></label>
      <label className="block space-y-1 text-xs">Choose CSV file<input type="file" accept=".csv,text/csv" className="block w-full text-xs file:mr-3 file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200" onChange={event => file(event.target.files?.[0])} /></label>
      <label className="block space-y-1 text-xs">CSV data<textarea className={`${inputClass} min-h-36 font-mono text-xs`} required spellCheck={false} value={draft.csv} onChange={event => update('csv', event.target.value)} placeholder={header + '2024-01-01T00:00:00Z,100,102,99,101,200'} /></label>
      <p className="break-all font-mono text-[11px] text-slate-500">Header: timestamp,open,high,low,close,volume</p>
      <button type="button" className={buttonClass} onClick={() => setDraft({ name: 'Synthetic research sample', symbol: 'DEMO_USD', timeframe: '1h', sourceKind: 'SYNTHETIC', sourceLabel: 'Bundled deterministic synthetic sample — not market prices', csv: syntheticCsv() })}>Load synthetic sample</button>
    </fieldset>
    {reading && <p role="status" className="text-sm text-slate-400">Reading CSV file…</p>}
    {fileError && <p role="alert" className="text-sm text-rose-300">{fileError}</p>}
    {market.mutationError && <p role="alert" className="text-sm text-rose-300">{market.mutationError}</p>}
    {market.uncertain && <p className="text-xs text-amber-200">The import outcome is uncertain. Retry uses the same saved request and cannot duplicate the dataset.</p>}
    <button className={buttonClass} disabled={market.busy || reading} type="submit">{market.busy ? 'Importing…' : market.uncertain ? 'Retry import' : 'Import dataset'}</button>
  </form>
}
