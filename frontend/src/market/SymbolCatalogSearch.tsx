import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { SymbolIcon } from '../components/SymbolIcon'
import type { Instrument, MarketDataProvider } from './liveMarket'
import type { CatalogPage, CatalogProvider } from './providerCatalog'

export function SymbolCatalogSearch({ provider, onSelect, onClose }: { provider: Pick<MarketDataProvider, 'searchPage' | 'catalogProviders'>; onSelect: (instrument: Instrument) => void; onClose: () => void }) {
  const [sources, setSources] = useState<CatalogProvider[]>([]), [source, setSource] = useState('COINBASE'), [query, setQuery] = useState(''), [category, setCategory] = useState('')
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]), [page, setPage] = useState<CatalogPage>({ items: [], nextCursor: null }), [busy, setBusy] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const dialog = useRef<HTMLDivElement>(null), previousFocus = useRef(document.activeElement)
  useEffect(() => {
    const controller = new AbortController()
    void provider.catalogProviders?.(controller.signal).then(items => { if (!controller.signal.aborted) { setSources(items); if (!items.some(i => i.providerId === source)) setSource(items[0]?.providerId ?? '') } }).catch(() => { if (!controller.signal.aborted) setError('Provider capabilities unavailable. Retry.') })
    return () => controller.abort()
  }, [provider, retry])
  useEffect(() => () => { (previousFocus.current as HTMLElement | null)?.focus() }, [])
  const cursor = cursors.at(-1)
  useEffect(() => {
    if (!sources.some(s => s.providerId === source)) return
    const controller = new AbortController(); setBusy(true); setError(''); setPage({ items: [], nextCursor: null })
    const timer = setTimeout(() => { void provider.searchPage?.({ provider: source, query, assetClass: category, cursor, signal: controller.signal }).then(next => { if (!controller.signal.aborted) setPage(next) }).catch(() => { if (!controller.signal.aborted) setError('Catalog unavailable for this provider. Retry or choose another source.') }).finally(() => { if (!controller.signal.aborted) setBusy(false) }) }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [provider, sources, source, query, category, cursor, retry])
  const reset = () => setCursors([undefined])
  const categories = sources.find(s => s.providerId === source)?.assetClasses.map(c => c === 'FX_REFERENCE' ? 'FOREX' : c) ?? []
  const field = 'rounded border border-slate-600 bg-slate-950 p-2 text-xs text-slate-200'
  return createPortal(<div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-3 pt-16" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}><div ref={dialog} role="dialog" aria-modal="true" aria-label="Symbol Search" className="flex max-h-[calc(100dvh-5rem)] w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-200 shadow-2xl" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose() }
    if (event.key === 'Tab') { const items = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input, select')]; if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() } else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus() } }
  }}><div className="flex items-center justify-between"><strong>Symbol Search</strong><button aria-label="Close Symbol Search" className={field} onClick={onClose}>×</button></div>
    <input autoFocus aria-label="Search symbols" maxLength={64} placeholder="Ticker, base, quote or exchange…" value={query} onChange={e => { setQuery(e.target.value); reset() }} className={`${field} mt-3`} />
    <div className="my-2 flex flex-wrap gap-2"><select aria-label="Symbol provider" className={`${field} min-w-0 flex-1`} value={source} onChange={e => { setSource(e.target.value); setCategory(''); reset() }}>{sources.map(s => <option key={s.providerId} value={s.providerId}>{s.displayName}</option>)}</select><select aria-label="Symbol category" className={field} value={category} onChange={e => { setCategory(e.target.value); reset() }}><option value="">All</option>{categories.map(c => <option key={c} value={c}>{c === 'FOREX' ? 'Forex · EOD' : c === 'CRYPTO' ? 'Crypto' : c === 'STOCK' ? 'Stocks' : c}</option>)}</select></div>
    <p className="mb-2 text-[10px] text-slate-400">Provider catalogs only. Futures require contract/terms verification; CFD unavailable. Alpaca requires credentials and display entitlement.</p>
    {error ? <div role="alert" className="p-3 text-xs text-amber-300">{error}<button className={`${field} ml-2`} onClick={() => setRetry(v => v + 1)}>Retry catalog</button></div> : busy ? <p role="status" className="p-3 text-xs">Loading provider catalog…</p> : !page.items.length ? <p role="status" className="p-3 text-xs">No configured symbol matches this search.</p> : null}
    <div className="min-h-0 overflow-auto">{page.items.map(i => <button key={i.instrumentId ?? `${i.provider}:${i.symbol}`} onClick={() => onSelect(i)} className="flex min-h-14 w-full items-center gap-3 rounded px-2 text-left hover:bg-slate-800"><SymbolIcon instrument={i}/><span className="min-w-0 flex-1"><span className="block truncate text-sm">{i.displaySymbol ?? i.symbol}</span><span className="block truncate text-xs text-slate-400">{i.name}</span></span><span className="max-w-32 text-right text-[9px] text-slate-400">{i.provider} · {i.exchange}<br/>{i.feed}</span></button>)}</div>
    <div className="mt-2 flex items-center justify-between text-xs"><button className={field} disabled={busy || cursors.length === 1} onClick={() => setCursors(c => c.slice(0, -1))}>Previous symbols</button><span>Page {cursors.length}</span><button className={field} disabled={busy || !page.nextCursor} onClick={() => setCursors(c => [...c, page.nextCursor!])}>Next symbols</button></div>
  </div></div>, document.body)
}
