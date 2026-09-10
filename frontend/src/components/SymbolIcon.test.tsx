import { fireEvent, render, screen } from '@testing-library/react'
import { SymbolIcon } from './SymbolIcon'
it('uses pinned local licensed icons, fails to a deterministic symbol and never fetches arbitrary URLs', () => {
  const view = render(<SymbolIcon instrument={{ symbol: 'BTC-USD', base: 'BTC', name: 'Bitcoin', assetClass: 'CRYPTO' }} />)
  const img = screen.getByRole('img')
  expect(img).toHaveAttribute('src', '/symbol-icons/btc.svg')
  fireEvent.error(img)
  expect(screen.getByRole('img')).toHaveTextContent('BTC')
  view.rerender(<SymbolIcon instrument={{ symbol: '../../host', name: 'Missing', assetClass: 'STOCK' }} />)
  expect(screen.getByRole('img')).not.toHaveAttribute('src')
})

it('distinguishes gold, silver and oil with original local illustrations', () => {
  const view = render(<SymbolIcon instrument={{ symbol: 'XAU-USD', base: 'XAU', name: 'Gold', assetClass: 'COMMODITY' }} />)
  expect(screen.getByRole('img')).toHaveAttribute('src', '/symbol-icons/gold.svg')
  view.rerender(<SymbolIcon instrument={{ symbol: 'XAG-USD', base: 'XAG', name: 'Silver', assetClass: 'COMMODITY' }} />)
  expect(screen.getByRole('img')).toHaveAttribute('src', '/symbol-icons/silver.svg')
  view.rerender(<SymbolIcon instrument={{ symbol: 'USOIL', base: 'USOIL', name: 'Oil', assetClass: 'COMMODITY' }} />)
  expect(screen.getByRole('img')).toHaveAttribute('src', '/symbol-icons/oil.svg')
})

it('uses expanded approved local icons and keeps a deterministic fallback for unavailable logos', () => {
  const view = render(<SymbolIcon instrument={{ symbol: 'DOT-USD', base: 'DOT', name: 'Polkadot', assetClass: 'CRYPTO' }} />)
  expect(screen.getByRole('img')).toHaveAttribute('src', '/symbol-icons/dot.svg')
  view.rerender(<SymbolIcon instrument={{ symbol: 'SHIB-USD', base: 'SHIB', name: 'Shiba Inu', assetClass: 'CRYPTO' }} />)
  expect(screen.getByRole('img')).toHaveTextContent('SHI')
})

it('uses approved local stock and ETF assets instead of monograms', () => {
  const view = render(<SymbolIcon instrument={{ symbol: 'AAPL', base: 'AAPL', name: 'Apple Inc.', assetClass: 'STOCK' }} />)
  expect(screen.getByRole('img')).toHaveAttribute('src', '/symbol-icons/apple.svg')
  view.rerender(<SymbolIcon instrument={{ symbol: 'SPY', base: 'SPY', name: 'SPDR S&P 500 ETF Trust', assetClass: 'ETF' }} />)
  expect(screen.getByRole('img')).toHaveAttribute('src', '/symbol-icons/spy.svg')
})
