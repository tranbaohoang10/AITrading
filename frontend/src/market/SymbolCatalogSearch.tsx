import { canonicalCatalog } from './canonicalCatalog'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { hasApprovedSymbolIcon, SymbolIcon } from '../components/SymbolIcon'
import type { Instrument, MarketDataProvider } from './liveMarket'
import type { CatalogPage, CatalogProvider } from './providerCatalog'

type Category = 'ALL' | 'STOCK' | 'ETF' | 'CRYPTO' | 'FUTURES' | 'FOREX' | 'COMMODITY'
const categories: Array<{ value: Category; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'STOCK', label: 'Stocks' },
  { value: 'ETF', label: 'ETFs' },
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'FUTURES', label: 'Futures' },
  { value: 'FOREX', label: 'Forex' },
  { value: 'COMMODITY', label: 'Commodities' },
]
const normalizedClass = (value: string) => value === 'FX_REFERENCE' ? 'FOREX' : value === 'US_EQUITY' ? 'STOCK' : value

export function SymbolCatalogSearch({ provider, onSelect, onClose }: { provider: Pick<MarketDataProvider, 'searchPage' | 'catalogProviders'>; onSelect: (instrument: Instrument) => void; onClose: () => void }) {
  const [sources, setSources] = useState<CatalogProvider[]>([]), [query, setQuery] = useState(''), [category, setCategory] = useState<Category>('ALL')
  const [page, setPage] = useState<CatalogPage>({ items: [], nextCursor: null }), [busy, setBusy] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const dialog = useRef<HTMLDivElement>(null), previousFocus = useRef(document.activeElement)
  const activeSources = useMemo(() => sources.filter(source => category === 'ALL' || source.assetClasses.some(assetClass => normalizedClass(assetClass) === category)), [category, sources])

  useEffect(() => {
    const controller = new AbortController()
    void provider.catalogProviders?.(controller.signal).then(items => { if (!controller.signal.aborted) setSources(items.filter(item => item.realtime)) }).catch(() => { if (!controller.signal.aborted) setError('Live symbols are temporarily unavailable. Retry.') }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [provider, retry])
  useEffect(() => () => { (previousFocus.current as HTMLElement | null)?.focus() }, [])

  useEffect(() => {
    if (!activeSources.length) { setPage({ items: [], nextCursor: null }); setBusy(false); setError(''); return }
    const controller = new AbortController(); setBusy(true); setError(''); setPage({ items: [], nextCursor: null })
    const timer = setTimeout(() => {
      const requests = activeSources.map(async source => {
        const items: Instrument[] = [], cursors = new Set<string>()
        let cursor: string | undefined
        do {
          const next = await provider.searchPage?.({ provider: source.providerId, query: '', assetClass: category === 'ALL' ? '' : category, cursor, signal: controller.signal })
          if (!next || controller.signal.aborted) break
          items.push(...next.items)
          if (next.nextCursor && cursors.has(next.nextCursor)) throw new Error('Repeated catalog cursor')
          cursor = next.nextCursor ?? undefined
          if (cursor) cursors.add(cursor)
          if (cursors.size >= 400) throw new Error('Catalog limit exceeded')
        } while (cursor)
        return { items, nextCursor: null }
      })
      void Promise.allSettled(requests).then(results => {
        if (controller.signal.aborted) return
        const pages = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
        if (!pages.length) throw new Error('All provider catalogs failed')
        const catalog = canonicalCatalog(pages.flatMap(next => next.items))
        const items = catalog.flatMap(instrument => {
          const route = instrument.routes.find(item => item.modes.includes('REALTIME') && hasApprovedSymbolIcon(item) && (category === 'ALL' || String(item.assetClass) === category))
          return route ? [route] : []
        })
        setPage({ items, nextCursor: null })
      }).catch(() => { if (!controller.signal.aborted) setError('Live symbols are temporarily unavailable. Retry.') }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [activeSources, category, provider, retry])

  const normalizedQuery = query.trim().toLowerCase().replace(/[-/\s_]/g, '')
  const visibleItems = useMemo(() => page.items.filter(item => !normalizedQuery || `${item.symbol} ${item.displaySymbol ?? ''} ${item.name} ${item.base ?? ''} ${item.quote ?? ''}`.toLowerCase().replace(/[-/\s_]/g, '').includes(normalizedQuery)), [normalizedQuery, page.items])
  const field = 'rounded border border-slate-600 bg-slate-950 p-2 text-xs text-slate-200'
  return createPortal(<div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-3 pt-16" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}><div ref={dialog} role="dialog" aria-modal="true" aria-label="Symbol Search" className="flex max-h-[calc(100dvh-5rem)] w-full max-w-2xl flex-col rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-200 shadow-2xl" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose() }
    if (event.key === 'Tab') { const items = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input')]; if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() } else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus() } }
  }}><div className="flex items-center justify-between"><strong>Symbol Search</strong><button aria-label="Close Symbol Search" className={field} onClick={onClose}>×</button></div>
    <input autoFocus aria-label="Search symbols" maxLength={64} placeholder="Search symbol..." value={query} onChange={event => setQuery(event.target.value)} className={`${field} mt-3`} />
    <div role="tablist" aria-label="Symbol categories" className="my-2 flex gap-1 overflow-x-auto border-b border-slate-800 pb-2">{categories.map(item => <button key={item.value} type="button" role="tab" aria-selected={category === item.value} onClick={() => setCategory(item.value)} className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${category === item.value ? 'bg-slate-100 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}>{item.label}</button>)}</div>
    {error ? <div role="alert" className="p-3 text-xs text-amber-300">{error}<button className={`${field} ml-2`} onClick={() => setRetry(value => value + 1)}>Retry</button></div> : busy ? <p role="status" className="p-3 text-xs">Loading live symbols…</p> : !visibleItems.length ? <p role="status" className="p-3 text-xs">No live instruments available.</p> : null}
    <div className="min-h-0 overflow-auto">{visibleItems.map(instrument => <button key={instrument.instrumentId ?? `${instrument.provider}:${instrument.symbol}`} onClick={() => onSelect(instrument)} className="flex min-h-14 w-full items-center gap-3 rounded px-2 text-left hover:bg-slate-800"><SymbolIcon instrument={instrument}/><span className="min-w-0 flex-1"><span className="block truncate text-sm">{instrument.displaySymbol ?? instrument.symbol}</span><span className="block truncate text-xs text-slate-400">{instrument.name}</span></span></button>)}</div>
  </div></div>, document.body)
}
