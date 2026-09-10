import { canonicalCatalog } from './canonicalCatalog'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { approvedEquityIconBases, SymbolIcon } from '../components/SymbolIcon'
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
export const COINBASE_CATALOG_MAX_PAGES = 20
export const SYMBOL_CATALOG_TIMEOUT_MS = 20_000
export const featuredCryptoBases = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'LTC', 'BCH', 'DOT', 'SUI', 'UNI', 'AAVE', 'XLM', 'HBAR', 'ATOM', 'NEAR', 'ICP', 'FIL', 'APT', 'ARB', 'OP', 'INJ', 'POL', 'TON', 'SHIB', 'PEPE', 'BONK', 'WIF', 'FLOKI'] as const
const featuredCryptoSet = new Set<string>(featuredCryptoBases)
const cryptoNames: Record<string, string> = { BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', XRP: 'XRP', DOGE: 'Dogecoin', ADA: 'Cardano', AVAX: 'Avalanche', LINK: 'Chainlink', LTC: 'Litecoin', BCH: 'Bitcoin Cash', DOT: 'Polkadot', SUI: 'Sui', UNI: 'Uniswap', AAVE: 'Aave', XLM: 'Stellar', HBAR: 'Hedera', ATOM: 'Cosmos', NEAR: 'NEAR Protocol', ICP: 'Internet Computer', FIL: 'Filecoin', APT: 'Aptos', ARB: 'Arbitrum', OP: 'Optimism', INJ: 'Injective', POL: 'Polygon Ecosystem Token', TON: 'Toncoin', SHIB: 'Shiba Inu', PEPE: 'Pepe', BONK: 'Bonk', WIF: 'dogwifhat', FLOKI: 'FLOKI' }
const featuredRank = new Map<string, number>([
  ...featuredCryptoBases.map((base, index) => [`CRYPTO:${base}`, index] as const),
  ...approvedEquityIconBases.flatMap((base, index) => ([`STOCK:${base}`, `ETF:${base}`] as const).map(key => [key, featuredCryptoBases.length + index] as const)),
])
const assetRank = new Map<Category, number>((['CRYPTO', 'STOCK', 'ETF', 'FOREX', 'COMMODITY', 'FUTURES'] as Category[]).map((assetClass, index) => [assetClass, index]))
const instrumentBase = (instrument: Instrument) => (instrument.base ?? instrument.symbol.split(/[-/]/)[0]).toUpperCase()
const instrumentIdentity = (instrument: Instrument) => instrument.instrumentId ?? `${instrument.provider}:${instrument.providerSymbol ?? instrument.symbol}`

export async function loadCatalogSource(provider: Pick<MarketDataProvider, 'searchPage'>, source: CatalogProvider, query: string, assetClass: string, signal: AbortSignal): Promise<Instrument[]> {
  const referenceForex = source.providerId === 'FRANKFURTER' && Boolean(source.historical || source.delayed || source.eod)
  if (!provider.searchPage || source.configured === false || (!source.realtime && !referenceForex)) return []
  if (!query && source.providerId === 'ALPACA') {
    const results = await Promise.allSettled(approvedEquityIconBases.map(featuredQuery => provider.searchPage!({ provider: source.providerId, query: featuredQuery, assetClass, signal })))
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const pages = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    if (!pages.length) throw new Error('Provider catalog unavailable')
    return pages.flatMap((page, index) => page.items.filter(instrument => (instrument.providerSymbol ?? instrument.symbol).toUpperCase() === approvedEquityIconBases[index]))
  }
  const items: Instrument[] = [], seenCursors = new Set<string>()
  let cursor: string | undefined
  const maxPages = source.providerId === 'COINBASE' ? COINBASE_CATALOG_MAX_PAGES : 1
  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const page = await provider.searchPage({ provider: source.providerId, query, assetClass, cursor, signal })
    items.push(...page.items)
    if (!page.nextCursor || seenCursors.has(page.nextCursor)) break
    seenCursors.add(page.nextCursor)
    cursor = page.nextCursor
  }
  return items
}

function preferUsdAndSort(instruments: Instrument[]): Instrument[] {
  const named = instruments.map(instrument => instrument.assetClass === 'CRYPTO' && instrument.quote === 'USD' && cryptoNames[instrumentBase(instrument)] ? { ...instrument, name: `${cryptoNames[instrumentBase(instrument)]} / US Dollar` } : instrument)
  const unique = [...new Map(named.map(instrument => [instrumentIdentity(instrument), instrument])).values()]
  const usdCryptoBases = new Set(unique.filter(instrument => instrument.assetClass === 'CRYPTO' && instrument.quote === 'USD').map(instrumentBase))
  return unique.filter(instrument => instrument.assetClass !== 'CRYPTO' || instrument.quote === 'USD' || !usdCryptoBases.has(instrumentBase(instrument))).sort((left, right) => {
    const leftRank = featuredRank.get(`${left.assetClass}:${instrumentBase(left)}`) ?? Number.MAX_SAFE_INTEGER
    const rightRank = featuredRank.get(`${right.assetClass}:${instrumentBase(right)}`) ?? Number.MAX_SAFE_INTEGER
    return leftRank - rightRank || (assetRank.get(left.assetClass) ?? 99) - (assetRank.get(right.assetClass) ?? 99) || (left.displaySymbol ?? left.symbol).localeCompare(right.displaySymbol ?? right.symbol)
  })
}

function routeForCategory(routes: Instrument[], category: Category): Instrument | undefined {
  const matching = routes.filter(route => category === 'ALL' || route.assetClass === category)
  return matching.find(route => route.modes.includes('REALTIME'))
    ?? matching.find(route => ['FOREX', 'COMMODITY'].includes(route.assetClass) && route.modes.includes('HISTORICAL') && route.modes.includes('DELAYED'))
}

function curatedEmptyQuery(instruments: Instrument[], query: string): Instrument[] {
  if (query.trim()) return instruments
  return instruments.filter(instrument => instrument.assetClass !== 'CRYPTO' || featuredCryptoSet.has(instrumentBase(instrument)))
}

function emptyState(category: Category, sources: CatalogProvider[]): string {
  if (category === 'FUTURES') return 'Futures market data is NOT_READY. No approved realtime futures catalog is configured.'
  if (category === 'FOREX') {
    const reference = sources.some(source => source.providerId === 'FRANKFURTER' && source.configured !== false && (source.historical || source.delayed || source.eod))
    const ctraderReady = sources.some(source => source.providerId === 'CTRADER' && source.configured !== false && source.realtime)
    if (!ctraderReady) return `Realtime Forex is NOT_READY. cTrader is not configured${reference ? '; Frankfurter is historical/delayed reference data only.' : '.'}`
  }
  if (category === 'COMMODITY' && !sources.some(source => ['CTRADER', 'OANDA'].includes(source.providerId) && source.configured !== false && source.realtime)) return 'Realtime commodities are NOT_READY. Daily precious-metal reference data appears only when Frankfurter is available; USOIL is not fabricated.'
  return 'No live instruments available.'
}

export function SymbolCatalogSearch({ provider, onSelect, onClose }: { provider: Pick<MarketDataProvider, 'searchPage' | 'catalogProviders'>; onSelect: (instrument: Instrument) => void; onClose: () => void }) {
  const [sources, setSources] = useState<CatalogProvider[]>([]), [query, setQuery] = useState(''), [category, setCategory] = useState<Category>('ALL')
  const [page, setPage] = useState<CatalogPage>({ items: [], nextCursor: null }), [busy, setBusy] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0)
  const dialog = useRef<HTMLDivElement>(null), previousFocus = useRef(document.activeElement)
  const activeSources = useMemo(() => sources.filter(source => category === 'ALL' || source.assetClasses.some(assetClass => normalizedClass(assetClass) === category)), [category, sources])
  const searchableSources = useMemo(() => activeSources.filter(source => source.configured !== false && (source.realtime || source.providerId === 'FRANKFURTER' && Boolean(source.historical || source.delayed || source.eod))), [activeSources])

  useEffect(() => {
    const controller = new AbortController()
    void provider.catalogProviders?.(controller.signal).then(items => { if (!controller.signal.aborted) setSources(items) }).catch(() => { if (!controller.signal.aborted) setError('Live symbols are temporarily unavailable. Retry.') }).finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [provider, retry])
  useEffect(() => () => { (previousFocus.current as HTMLElement | null)?.focus() }, [])

  useEffect(() => {
    if (!searchableSources.length) { setPage({ items: [], nextCursor: null }); setBusy(false); setError(''); return }
    const controller = new AbortController(); let disposed = false; setBusy(true); setError(''); setPage({ items: [], nextCursor: null })
    const requestTimeout = setTimeout(() => controller.abort('timeout'), SYMBOL_CATALOG_TIMEOUT_MS)
    const timer = setTimeout(() => {
      const compactQuery = query.trim().toLowerCase().replace(/[-/\s_]/g, '')
      const serverQuery = (compactQuery.endsWith('usd') && compactQuery.length > 3 ? compactQuery.slice(0, -3).toUpperCase() : query.trim()).slice(0, 64)
      const requests = searchableSources.map(source => loadCatalogSource(provider, source, serverQuery, category === 'ALL' ? '' : category, controller.signal))
      void Promise.allSettled(requests).then(results => {
        if (disposed) return
        const providerItems = results.flatMap(result => result.status === 'fulfilled' ? result.value : [])
        if (!providerItems.length && results.every(result => result.status === 'rejected')) throw new Error('All provider catalogs failed')
        const catalog = canonicalCatalog(providerItems)
        const items = curatedEmptyQuery(preferUsdAndSort(catalog.flatMap(instrument => {
          const route = routeForCategory(instrument.routes, category)
          return route ? [route] : []
        })), query)
        setPage({ items, nextCursor: null })
      }).catch(() => { if (!disposed) setError(controller.signal.aborted ? 'Symbol catalog request timed out. Retry.' : 'Live symbols are temporarily unavailable. Retry.') }).finally(() => { if (!disposed) { clearTimeout(requestTimeout); setBusy(false) } })
    }, 250)
    return () => { disposed = true; clearTimeout(timer); clearTimeout(requestTimeout); controller.abort() }
  }, [category, provider, query, retry, searchableSources])

  const normalizedQuery = query.trim().toLowerCase().replace(/[-/\s_]/g, '')
  const visibleItems = useMemo(() => page.items.filter(item => !normalizedQuery || `${item.symbol} ${item.displaySymbol ?? ''} ${item.name} ${item.base ?? ''} ${item.quote ?? ''}`.toLowerCase().replace(/[-/\s_]/g, '').includes(normalizedQuery)), [normalizedQuery, page.items])
  const field = 'rounded border border-slate-600 bg-slate-950 p-2 text-xs text-slate-200'
  return createPortal(<div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-3 pt-16" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}><div ref={dialog} role="dialog" aria-modal="true" aria-label="Symbol Search" className="flex max-h-[calc(100dvh-5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-200 shadow-2xl" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose() }
    if (event.key === 'Tab') { const items = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input')]; if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus() } else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus() } }
  }}><div className="flex items-center justify-between"><strong>Symbol Search</strong><button aria-label="Close Symbol Search" className={field} onClick={onClose}>×</button></div>
    <input autoFocus aria-label="Search symbols" maxLength={64} placeholder="Search symbol..." value={query} onChange={event => setQuery(event.target.value)} className={`${field} mt-3`} />
    <div role="tablist" aria-label="Symbol categories" className="my-2 flex min-h-10 shrink-0 gap-1 overflow-x-auto border-b border-slate-800 pb-2">{categories.map(item => <button key={item.value} type="button" role="tab" aria-selected={category === item.value} onClick={() => setCategory(item.value)} className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${category === item.value ? 'bg-slate-100 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}>{item.label}</button>)}</div>
    {error ? <div role="alert" className="shrink-0 p-3 text-xs text-amber-300">{error}<button className={`${field} ml-2`} onClick={() => setRetry(value => value + 1)}>Retry</button></div> : busy ? <p role="status" className="shrink-0 p-3 text-xs">Loading market symbols…</p> : !visibleItems.length ? <p role="status" className="shrink-0 p-3 text-xs">{emptyState(category, sources)}</p> : null}
    <div className="min-h-0 flex-1 overflow-auto">{visibleItems.map(instrument => <button key={instrument.instrumentId ?? `${instrument.provider}:${instrument.symbol}`} onClick={() => onSelect(instrument)} className="flex min-h-14 w-full items-center gap-3 rounded px-2 text-left hover:bg-slate-800"><SymbolIcon instrument={instrument}/><span className="min-w-0 flex-1"><span className="block truncate text-sm">{instrument.displaySymbol ?? instrument.symbol}</span><span className="block truncate text-xs text-slate-400">{instrument.name}</span></span>{!instrument.modes.includes('REALTIME') && instrument.modes.includes('DELAYED') ? <span className="shrink-0 rounded-full border border-amber-700/70 bg-amber-950/40 px-2 py-1 text-[10px] font-semibold text-amber-300">Daily reference</span> : null}</button>)}</div>
  </div></div>, document.body)
}
