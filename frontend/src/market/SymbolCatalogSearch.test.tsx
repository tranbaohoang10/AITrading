import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SymbolCatalogSearch } from './SymbolCatalogSearch'
import { DEFAULT_INSTRUMENTS } from './liveMarket'
it('debounces provider search, paginates and preserves source identity', async () => {
  const searchPage = vi.fn().mockResolvedValueOnce({ items: [DEFAULT_INSTRUMENTS[0]], nextCursor: 'page2' }).mockResolvedValue({ items: [DEFAULT_INSTRUMENTS[1]], nextCursor: null })
  const select = vi.fn()
  render(<SymbolCatalogSearch provider={{ catalogProviders: async () => [{ providerId: 'COINBASE', displayName: 'Coinbase', assetClasses: ['CRYPTO'] }], searchPage }} onSelect={select} onClose={() => {}} />)
  expect(await screen.findByText('Bitcoin / US Dollar')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Next symbols' }))
  expect(await screen.findByText('Ethereum / US Dollar')).toBeVisible()
  expect(searchPage).toHaveBeenLastCalledWith(expect.objectContaining({ provider: 'COINBASE', cursor: 'page2' }))
  expect(screen.queryByText('Bitcoin / US Dollar')).toBeNull()
  expect(screen.queryByRole('option', { name: 'Futures' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Search symbols'), { target: { value: 'ETH' } })
  await waitFor(() => expect(searchPage).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'ETH', cursor: undefined })))
})
