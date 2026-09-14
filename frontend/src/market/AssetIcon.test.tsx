import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AssetIcon } from './AssetIcon'

describe('AssetIcon', () => {
  it('keeps forex pairs as currency flags instead of crypto fallbacks', () => {
    render(<AssetIcon symbol="EUR/USD" />)
    expect(screen.getByRole('img', { name: 'EUR and USD currency flags' })).toBeInTheDocument()
  })

  it('handles display labels that include a provider prefix', () => {
    render(<AssetIcon symbol="Frankfurter · GBP/USD" />)
    expect(screen.getByRole('img', { name: 'GBP and USD currency flags' })).toBeInTheDocument()
  })

  it('keeps crypto and commodity symbols on their approved icon paths', () => {
    const { rerender } = render(<AssetIcon symbol="BTC-USD" />)
    expect(screen.getByRole('img', { name: 'BTC icon' })).toHaveAttribute('src', '/symbol-icons/btc.svg')
    rerender(<AssetIcon symbol="XAU-USD" />)
    expect(screen.getByRole('img', { name: 'XAU icon' })).toHaveAttribute('src', '/symbol-icons/gold.svg')
  })
})
