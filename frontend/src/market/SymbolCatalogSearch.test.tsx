import { fireEvent, render, screen } from '@testing-library/react'
import { SymbolCatalogSearch } from './SymbolCatalogSearch'
import { DEFAULT_INSTRUMENTS, type Instrument } from './liveMarket'
it('uses trader categories, hides providers and lists only live symbols with approved icons', async () => {
  const historicalOnly = { ...DEFAULT_INSTRUMENTS[1], symbol: 'BTC-USDT', displaySymbol: 'BTC/USDT', provider: 'BINANCE', modes: ['HISTORICAL'] as Instrument['modes'] }
  const noApprovedIcon = { ...DEFAULT_INSTRUMENTS[4], base: 'UNKNOWN', symbol: 'UNKNOWN-USD', displaySymbol: 'UNKNOWN/USD' }
  const searchPage = vi.fn(async ({ query }: { query: string }) => ({ items: query === '' ? [...DEFAULT_INSTRUMENTS.filter(item => item.assetClass === 'CRYPTO'), historicalOnly, noApprovedIcon] : query === 'ETH' ? [DEFAULT_INSTRUMENTS[1]] : query === 'SOL' ? [DEFAULT_INSTRUMENTS[2]] : query === 'XRP' ? [DEFAULT_INSTRUMENTS[3]] : [], nextCursor: null }))
  const select = vi.fn()
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [{ providerId: 'COINBASE', displayName: 'Coinbase', assetClasses: ['CRYPTO'], realtime: true }], searchPage }} onSelect={select} onClose={() => {}} />)
  expect(await screen.findByText('Bitcoin / US Dollar')).toBeVisible()
  for (const category of ['All', 'Stocks', 'ETFs', 'Crypto', 'Futures', 'Forex', 'Commodities']) expect(screen.getByRole('tab', { name: category })).toBeInTheDocument()
  expect(screen.queryByLabelText('Symbol provider')).not.toBeInTheDocument()
  expect(screen.queryByText(/Provider catalogs only|Coinbase|Binance|PUBLIC · HISTORICAL/i)).not.toBeInTheDocument()
  expect(screen.queryByText('BTC/USDT')).not.toBeInTheDocument()
  expect(screen.queryByText('UNKNOWN/USD')).not.toBeInTheDocument()
  expect(screen.getByText('ADA/USD')).toBeVisible()
  expect(screen.getByText('DOGE/USD')).toBeVisible()
  fireEvent.change(screen.getByLabelText('Search symbols'), { target: { value: 'ETHUSD' } })
  expect(await screen.findByText('Ethereum / US Dollar')).toBeVisible()
  expect(searchPage).toHaveBeenCalledWith(expect.objectContaining({ query: '' }))
  fireEvent.click(screen.getByRole('tab', { name: 'Forex' }))
  expect(await screen.findByText('No live instruments available.')).toBeVisible()
})

it('discovers approved live instruments on later catalog pages', async () => {
  const searchPage = vi.fn(async ({ cursor }: { cursor?: string }) => cursor ? { items: [DEFAULT_INSTRUMENTS[5]], nextCursor: null } : { items: [{ ...DEFAULT_INSTRUMENTS[0], base: 'UNKNOWN' }], nextCursor: 'next' })
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [{ providerId: 'COINBASE', displayName: 'Coinbase', assetClasses: ['CRYPTO'], realtime: true }], searchPage }} onSelect={() => {}} onClose={() => {}} />)
  expect(await screen.findByText('DOGE/USD')).toBeVisible()
  expect(searchPage).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'next' }))
})

it('keeps All symbols from healthy providers when another live provider fails', async () => {
  const searchPage = vi.fn(async ({ provider }: { provider: string }) => {
    if (provider === 'ALPACA') throw new Error('ALPACA_AUTH_FAILED')
    return { items: DEFAULT_INSTRUMENTS.filter(item => item.assetClass === 'CRYPTO'), nextCursor: null }
  })
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [
    { providerId: 'COINBASE', displayName: 'Coinbase', assetClasses: ['CRYPTO'], realtime: true },
    { providerId: 'ALPACA', displayName: 'Alpaca · IEX', assetClasses: ['STOCK', 'ETF'], realtime: true },
  ], searchPage }} onSelect={() => {}} onClose={() => {}} />)
  expect(await screen.findByText('Bitcoin / US Dollar')).toBeVisible()
  expect(screen.getByText('Ethereum / US Dollar')).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
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

it('stops a repeated catalog cursor rather than looping requests', async () => {
  const searchPage = vi.fn(async () => ({ items: [], nextCursor: 'repeat' }))
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [{ providerId: 'COINBASE', displayName: 'Coinbase', assetClasses: ['CRYPTO'], realtime: true }], searchPage }} onSelect={() => {}} onClose={() => {}} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable')
  expect(searchPage).toHaveBeenCalledTimes(2)
})
