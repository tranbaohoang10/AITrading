import { act, fireEvent, render, screen } from '@testing-library/react'
import { COINBASE_CATALOG_MAX_PAGES, featuredCryptoBases, loadCatalogSource, SYMBOL_CATALOG_TIMEOUT_MS, SymbolCatalogSearch } from './SymbolCatalogSearch'
import { DEFAULT_INSTRUMENTS, type Instrument } from './liveMarket'
import type { CatalogProvider } from './providerCatalog'

const coinbase: CatalogProvider = { providerId: 'COINBASE', displayName: 'Coinbase', assetClasses: ['CRYPTO'], configured: true, historical: true, realtime: true, delayed: false, eod: false }

it('keeps the loading state until provider capabilities resolve', async () => {
  let resolveSources!: (sources: CatalogProvider[]) => void
  const catalogProviders = vi.fn(() => new Promise<CatalogProvider[]>(resolve => { resolveSources = resolve }))
  const searchPage = vi.fn(async () => ({ items: [DEFAULT_INSTRUMENTS[0]], nextCursor: null }))
  render(<SymbolCatalogSearch provider={{ catalogProviders, searchPage }} onSelect={() => {}} onClose={() => {}} />)
  expect(screen.getByText('Loading market symbols…')).toBeVisible()
  expect(screen.queryByText('No live instruments available.')).not.toBeInTheDocument()
  await act(async () => { resolveSources([coinbase]) })
  expect(await screen.findByText('Bitcoin / US Dollar')).toBeVisible()
})

it('uses trader categories, keeps the category bar visible and curates empty-query crypto', async () => {
  const historicalOnly = { ...DEFAULT_INSTRUMENTS[1], symbol: 'BTC-USDT', displaySymbol: 'BTC/USDT', provider: 'BINANCE', modes: ['HISTORICAL'] as Instrument['modes'] }
  const noApprovedIcon = { ...DEFAULT_INSTRUMENTS[4], base: 'UNKNOWN', symbol: 'UNKNOWN-USD', displaySymbol: 'UNKNOWN/USD' }
  const searchPage = vi.fn(async ({ query }: { query: string }) => ({ items: query === '' ? [...DEFAULT_INSTRUMENTS.filter(item => item.assetClass === 'CRYPTO'), historicalOnly, noApprovedIcon] : query.includes('ETH') ? [DEFAULT_INSTRUMENTS[1]] : query.includes('SOL') ? [DEFAULT_INSTRUMENTS[2]] : query.includes('XRP') ? [DEFAULT_INSTRUMENTS[3]] : [], nextCursor: null }))
  const select = vi.fn()
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [coinbase], searchPage }} onSelect={select} onClose={() => {}} />)
  expect(await screen.findByText('Bitcoin / US Dollar')).toBeVisible()
  for (const category of ['All', 'Stocks', 'ETFs', 'Crypto', 'Futures', 'Forex', 'Commodities']) expect(screen.getByRole('tab', { name: category })).toBeInTheDocument()
  expect(screen.queryByLabelText('Symbol provider')).not.toBeInTheDocument()
  expect(screen.queryByText(/Provider catalogs only|Coinbase|Binance|PUBLIC · HISTORICAL/i)).not.toBeInTheDocument()
  expect(screen.getByRole('tablist', { name: 'Symbol categories' })).toHaveClass('min-h-10', 'shrink-0')
  expect(screen.queryByText('BTC/USDT')).not.toBeInTheDocument()
  expect(screen.queryByText('UNKNOWN/USD')).not.toBeInTheDocument()
  expect(screen.getByText('ADA/USD')).toBeVisible()
  expect(screen.getByText('DOGE/USD')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Search symbols'), { target: { value: 'ETHUSD' } })
  expect(await screen.findByText('Ethereum / US Dollar')).toBeVisible()
  expect(searchPage).toHaveBeenCalledWith(expect.objectContaining({ query: 'ETH' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Forex' }))
  expect(await screen.findByText(/Realtime Forex is NOT_READY.*cTrader is not configured/)).toBeVisible()
})

it('keeps only approved-icon crypto for empty query but searches the full provider catalog when typed', async () => {
  const obscure = { ...DEFAULT_INSTRUMENTS[0], instrumentId: 'COINBASE:OBSCURE-USD', symbol: 'OBSCURE-USD', providerSymbol: 'OBSCURE-USD', displaySymbol: 'OBSCURE/USD', base: 'OBSCURE', name: 'Obscure token' }
  const bonk = { ...DEFAULT_INSTRUMENTS[0], instrumentId: 'COINBASE:BONK-USD', symbol: 'BONK-USD', providerSymbol: 'BONK-USD', displaySymbol: 'BONK/USD', base: 'BONK', name: 'BONK-USD' }
  const searchPage = vi.fn(async ({ query }: { query: string }) => ({ items: query ? [obscure] : [DEFAULT_INSTRUMENTS[0], bonk, obscure], nextCursor: null }))
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [coinbase], searchPage }} onSelect={() => {}} onClose={() => {}} />)
  expect(await screen.findByText('BTC/USD')).toBeVisible()
  expect(screen.queryByText('BONK/USD')).not.toBeInTheDocument()
  expect(screen.queryByText('OBSCURE/USD')).not.toBeInTheDocument()
  expect(featuredCryptoBases.length).toBeLessThanOrEqual(20)
  fireEvent.change(screen.getByLabelText('Search symbols'), { target: { value: 'OBSCURE' } })
  expect(await screen.findByText('OBSCURE/USD')).toBeVisible()
  expect(searchPage).toHaveBeenCalledWith(expect.objectContaining({ query: 'OBSCURE' }))
})

it('interleaves the All preview across available asset classes', async () => {
  const reference: CatalogProvider = { providerId: 'FRANKFURTER', displayName: 'Frankfurter', assetClasses: ['FX_REFERENCE', 'COMMODITY'], configured: true, historical: true, realtime: false, delayed: true, eod: true }
  const alpaca: CatalogProvider = { providerId: 'ALPACA', displayName: 'Alpaca', assetClasses: ['STOCK', 'ETF'], configured: true, realtime: true }
  const rows: Instrument[] = [
    DEFAULT_INSTRUMENTS[0],
    { ...DEFAULT_INSTRUMENTS[0], instrumentId: 'ALPACA:AAPL', symbol: 'AAPL', displaySymbol: 'AAPL', base: 'AAPL', name: 'Apple Inc.', assetClass: 'STOCK', provider: 'ALPACA' },
    { ...DEFAULT_INSTRUMENTS[0], instrumentId: 'ALPACA:SPY', symbol: 'SPY', displaySymbol: 'SPY', base: 'SPY', name: 'SPDR S&P 500 ETF Trust', assetClass: 'ETF', provider: 'ALPACA' },
    DEFAULT_INSTRUMENTS.find(item => item.symbol === 'EUR-USD')!,
    DEFAULT_INSTRUMENTS.find(item => item.symbol === 'XAU-USD')!,
  ]
  const searchPage = vi.fn(async ({ provider }: { provider: string }) => ({ items: rows.filter(row => row.provider === provider), nextCursor: null }))
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [coinbase, alpaca, reference], searchPage }} onSelect={() => {}} onClose={() => {}} />)
  const visible = await Promise.all(['BTC/USD', 'AAPL', 'SPY', 'EUR/USD', 'XAU/USD'].map(label => screen.findByText(label)))
  for (let index = 0; index < visible.length - 1; index += 1) expect(visible[index].compareDocumentPosition(visible[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('shows real Frankfurter daily-reference Forex without labeling it realtime', async () => {
  const reference: CatalogProvider = { providerId: 'FRANKFURTER', displayName: 'Frankfurter', assetClasses: ['FX_REFERENCE'], configured: true, historical: true, realtime: false, delayed: true, eod: true }
  const euro = DEFAULT_INSTRUMENTS.find(item => item.symbol === 'EUR-USD')!
  const searchPage = vi.fn(async ({ provider }: { provider: string }) => ({ items: provider === 'FRANKFURTER' ? [euro] : [], nextCursor: null }))
  const select = vi.fn()
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [reference], searchPage }} onSelect={select} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Forex' }))
  const row = await screen.findByRole('button', { name: /EUR\/USD.*Daily reference/ })
  expect(row).toBeVisible()
  expect(screen.queryByText(/Realtime Forex is NOT_READY/)).not.toBeInTheDocument()
  fireEvent.click(row)
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'EUR-USD', modes: ['HISTORICAL', 'DELAYED'] }))
})

it('shows provider-backed precious metals as daily reference commodities', async () => {
  const reference: CatalogProvider = { providerId: 'FRANKFURTER', displayName: 'Frankfurter', assetClasses: ['FX_REFERENCE', 'COMMODITY'], configured: true, historical: true, realtime: false, delayed: true, eod: true }
  const gold: Instrument = { ...DEFAULT_INSTRUMENTS[0], instrumentId: 'FRANKFURTER:XAU-USD', symbol: 'XAU-USD', providerSymbol: 'XAU-USD', displaySymbol: 'XAU/USD', base: 'XAU', quote: 'USD', name: 'Gold / U.S. Dollar · daily reference', assetClass: 'COMMODITY', provider: 'FRANKFURTER', feed: 'DAILY · REFERENCE', modes: ['HISTORICAL', 'DELAYED'] }
  const searchPage = vi.fn(async ({ assetClass }: { assetClass?: string }) => ({ items: assetClass === 'COMMODITY' ? [gold] : [], nextCursor: null }))
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [reference], searchPage }} onSelect={() => {}} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Commodities' }))
  expect(await screen.findByRole('button', { name: /Gold.*XAU\/USD.*Daily reference/ })).toBeVisible()
  expect(screen.queryByText(/USOIL/)).not.toBeInTheDocument()
})

it('paginates Coinbase discovery, deduplicates identities and stops repeated cursors', async () => {
  const searchPage = vi.fn(async ({ cursor }: { cursor?: string }) => cursor ? { items: [DEFAULT_INSTRUMENTS[0], DEFAULT_INSTRUMENTS[1]], nextCursor: 'same' } : { items: [DEFAULT_INSTRUMENTS[0]], nextCursor: 'same' })
  const items = await loadCatalogSource({ searchPage }, coinbase, '', '', new AbortController().signal)
  expect(searchPage).toHaveBeenCalledTimes(2)
  expect(new Set(items.map(item => item.symbol))).toEqual(new Set(['BTC-USD', 'ETH-USD']))
})

it('bounds Coinbase catalog pagination even when every page returns another cursor', async () => {
  const searchPage = vi.fn(async ({ cursor }: { cursor?: string }) => ({ items: [], nextCursor: String(Number(cursor ?? '0') + 1) }))
  await loadCatalogSource({ searchPage }, coinbase, '', '', new AbortController().signal)
  expect(searchPage).toHaveBeenCalledTimes(COINBASE_CATALOG_MAX_PAGES)
})

it('keeps the bounded Alpaca featured queries exact instead of accepting substring matches', async () => {
  const alpaca: CatalogProvider = { providerId: 'ALPACA', displayName: 'Alpaca · IEX', assetClasses: ['STOCK', 'ETF'], configured: true, historical: true, realtime: true }
  const featured = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'SPY', 'QQQ', 'IWM', 'DIA']
  const searchPage = vi.fn(async () => ({ items: featured.flatMap(symbol => [
    { ...DEFAULT_INSTRUMENTS[0], instrumentId: `ALPACA:${symbol}`, provider: 'ALPACA', providerSymbol: symbol, symbol, displaySymbol: symbol, base: symbol, assetClass: 'STOCK' as const },
    { ...DEFAULT_INSTRUMENTS[0], instrumentId: `ALPACA:${symbol}X`, provider: 'ALPACA', providerSymbol: `${symbol}X`, symbol: `${symbol}X`, displaySymbol: `${symbol}X`, base: `${symbol}X`, assetClass: 'STOCK' as const },
  ]), nextCursor: null }))
  const items = await loadCatalogSource({ searchPage }, alpaca, '', '', new AbortController().signal)
  expect(items.map(item => item.symbol)).toEqual(expect.arrayContaining(['AAPL', 'NVDA', 'SPY', 'QQQ']))
  expect(items.some(item => item.symbol.endsWith('X'))).toBe(false)
  expect(searchPage).toHaveBeenCalledTimes(1)
  expect(searchPage).toHaveBeenCalledWith(expect.objectContaining({ query: '' }))
})

it('aborts a stalled catalog request at the UI timeout', async () => {
  vi.useFakeTimers()
  try {
    const searchPage = vi.fn(({ signal }: { signal?: AbortSignal }) => new Promise<never>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })))
    render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [coinbase], searchPage }} onSelect={() => {}} onClose={() => {}} />)
    await act(async () => { await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(250) })
    await act(async () => { await vi.advanceTimersByTimeAsync(SYMBOL_CATALOG_TIMEOUT_MS) })
    expect(screen.getByRole('alert')).toHaveTextContent('timed out')
  } finally { vi.useRealTimers() }
})

it('keeps All symbols from healthy providers when another live provider fails', async () => {
  const searchPage = vi.fn(async ({ provider }: { provider: string }) => {
    if (provider === 'ALPACA') throw new Error('ALPACA_AUTH_FAILED')
    return { items: DEFAULT_INSTRUMENTS.filter(item => item.assetClass === 'CRYPTO'), nextCursor: null }
  })
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [
    coinbase,
    { providerId: 'ALPACA', displayName: 'Alpaca · IEX', assetClasses: ['STOCK', 'ETF'], realtime: true },
  ], searchPage }} onSelect={() => {}} onClose={() => {}} />)
  expect(await screen.findByText('Bitcoin / US Dollar')).toBeVisible()
  expect(screen.getByText('Ethereum / US Dollar')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('keeps featured equities while hiding non-curated crypto ticker collisions', async () => {
  const rows = [
    { ...DEFAULT_INSTRUMENTS[0], instrumentId: 'COINBASE:META-USD', symbol: 'META-USD', providerSymbol: 'META-USD', displaySymbol: 'META/USD', base: 'META', name: 'META-USD' },
    { ...DEFAULT_INSTRUMENTS[0], instrumentId: 'ALPACA:META', symbol: 'META', providerSymbol: 'META', displaySymbol: 'META', base: 'META', quote: 'USD', name: 'Meta Platforms, Inc.', assetClass: 'STOCK', provider: 'ALPACA', feed: 'IEX' },
  ] as Instrument[]
  const searchPage = vi.fn(async ({ provider }: { provider: string }) => ({ items: rows.filter(row => row.provider === provider), nextCursor: null }))
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [coinbase, { providerId: 'ALPACA', displayName: 'Alpaca · IEX', assetClasses: ['STOCK'], realtime: true }], searchPage }} onSelect={() => {}} onClose={() => {}} />)
  expect(await screen.findByRole('button', { name: /Meta Platforms, Inc\./ })).toBeVisible()
  expect(screen.queryByRole('button', { name: /META-USD symbol fallback/ })).not.toBeInTheDocument()
})

it('renders approved stock and ETF icons without exposing provider or feed text in normal rows', async () => {
  const equities: Instrument[] = [
    { ...DEFAULT_INSTRUMENTS[0], instrumentId: 'ALPACA:AAPL', symbol: 'AAPL', displaySymbol: 'AAPL', base: 'AAPL', quote: 'USD', name: 'Apple Inc.', assetClass: 'STOCK', provider: 'ALPACA', feed: 'IEX', modes: ['HISTORICAL', 'REALTIME'] },
    { ...DEFAULT_INSTRUMENTS[0], instrumentId: 'ALPACA:NVDA', symbol: 'NVDA', displaySymbol: 'NVDA', base: 'NVDA', quote: 'USD', name: 'NVIDIA Corporation', assetClass: 'STOCK', provider: 'ALPACA', feed: 'IEX', modes: ['HISTORICAL', 'REALTIME'] },
    { ...DEFAULT_INSTRUMENTS[0], instrumentId: 'ALPACA:SPY', symbol: 'SPY', displaySymbol: 'SPY', base: 'SPY', quote: 'USD', name: 'SPDR S&P 500 ETF Trust', assetClass: 'ETF', provider: 'ALPACA', feed: 'IEX', modes: ['HISTORICAL', 'REALTIME'] },
    { ...DEFAULT_INSTRUMENTS[0], instrumentId: 'ALPACA:QQQ', symbol: 'QQQ', displaySymbol: 'QQQ', base: 'QQQ', quote: 'USD', name: 'Invesco QQQ Trust', assetClass: 'ETF', provider: 'ALPACA', feed: 'IEX', modes: ['HISTORICAL', 'REALTIME'] },
  ]
  const searchPage = vi.fn(async ({ assetClass }: { assetClass?: string }) => ({ items: equities.filter(item => !assetClass || item.assetClass === assetClass), nextCursor: null }))
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [{ providerId: 'ALPACA', displayName: 'Alpaca · IEX', assetClasses: ['STOCK', 'ETF'], realtime: true }], searchPage }} onSelect={() => {}} onClose={() => {}} />)
  for (const name of ['Apple Inc.', 'NVIDIA Corporation', 'SPDR S&P 500 ETF Trust', 'Invesco QQQ Trust']) expect(await screen.findByRole('img', { name: `${name} icon` })).toBeVisible()
  expect(screen.queryByText(/Alpaca|IEX/)).not.toBeInTheDocument()
})

it('reports unavailable only when every active provider request fails', async () => {
  const searchPage = vi.fn(async () => { throw new Error('Provider unavailable') })
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [coinbase], searchPage }} onSelect={() => {}} onClose={() => {}} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable')
  expect(searchPage).toHaveBeenCalledTimes(1)
})

it('uses one unified catalog request and disables reference-only instruments', async () => {
  const routed: Instrument = { ...DEFAULT_INSTRUMENTS[0], instrumentId: '123e4567-e89b-12d3-a456-426614174000', symbol: 'AAPL', providerSymbol: 'AAPL', displaySymbol: 'AAPL', name: 'Apple Inc.', assetClass: 'STOCK', provider: 'ALPACA', exchange: 'NASDAQ', modes: ['HISTORICAL', 'REALTIME'] }
  const reference: Instrument = { ...routed, instrumentId: '223e4567-e89b-12d3-a456-426614174000', symbol: '7203', providerSymbol: '7203', displaySymbol: '7203', name: 'Toyota Motor Corp', provider: 'REFERENCE', exchange: 'TSE', modes: [] }
  const searchCatalogPage = vi.fn(async () => ({ items: [routed, reference], nextCursor: null }))
  const searchPage = vi.fn()
  render(<SymbolCatalogSearch provider={{ searchCatalogPage, searchPage }} onSelect={() => {}} onClose={() => {}} />)
  expect(await screen.findByRole('button', { name: /Apple Inc\./ })).toBeEnabled()
  expect(screen.getByRole('button', { name: /Toyota Motor Corp/ })).toBeDisabled()
  expect(screen.getByText('Reference only')).toBeVisible()
  expect(searchCatalogPage).toHaveBeenCalledTimes(1)
  expect(searchPage).not.toHaveBeenCalled()
})

it('deduplicates the All preview by display symbol and prefers a routable row', async () => {
  const reference: Instrument = { ...DEFAULT_INSTRUMENTS[0], instrumentId: '123e4567-e89b-12d3-a456-426614174010', symbol: 'SPY', providerSymbol: 'SPY', displaySymbol: 'SPY', name: 'SPDR reference', assetClass: 'ETF', provider: 'REFERENCE', exchange: 'BATS', modes: [] }
  const routed: Instrument = { ...reference, instrumentId: '123e4567-e89b-12d3-a456-426614174011', name: 'SPDR routable', provider: 'ALPACA', exchange: 'NYSE ARCA', modes: ['HISTORICAL', 'REALTIME'] }
  const commodityReference: Instrument = { ...reference, instrumentId: '123e4567-e89b-12d3-a456-426614174012', symbol: 'XAU-EUR', providerSymbol: 'XAU-EUR', displaySymbol: 'XAU/EUR', name: 'Gold / Euro', assetClass: 'COMMODITY', base: 'XAU', quote: 'EUR' }
  const commodityUsd: Instrument = { ...commodityReference, instrumentId: '123e4567-e89b-12d3-a456-426614174013', symbol: 'XAU-USD', providerSymbol: 'XAU-USD', displaySymbol: 'XAU/USD', name: 'Gold / U.S. Dollar', provider: 'FRANKFURTER', quote: 'USD', modes: ['HISTORICAL', 'DELAYED'] }
  const searchCatalogPage = vi.fn(async () => ({ items: [reference, routed, commodityReference, commodityUsd], nextCursor: null }))
  render(<SymbolCatalogSearch provider={{ searchCatalogPage }} onSelect={() => {}} onClose={() => {}} />)
  expect(await screen.findByRole('button', { name: /SPDR routable/ })).toBeEnabled()
  expect(screen.queryByText('SPDR reference')).not.toBeInTheDocument()
  const rows = screen.getAllByRole('button').map(button => button.textContent ?? '')
  expect(rows.findIndex(text => text.includes('XAU/USD'))).toBeLessThan(rows.findIndex(text => text.includes('XAU/EUR')))
})
