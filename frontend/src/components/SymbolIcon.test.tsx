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
