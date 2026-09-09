import { fireEvent, render, screen } from '@testing-library/react'
import { createElement, type FunctionComponent } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { LiveChart } from './LiveChart'
import { DEFAULT_INSTRUMENTS, type CandleSubscription, type MarketDataProvider } from './liveMarket'

const provider: MarketDataProvider = {
  listInstruments: vi.fn(async () => DEFAULT_INSTRUMENTS),
  getHistoricalCandles: vi.fn(async request => [{ symbol: request.symbol, interval: request.interval, openTime: 1_788_566_400_000, closeTime: 1_788_652_799_999, open: '1.1622', high: '1.1622', low: '1.1622', close: '1.1622', volume: '0', closed: true }]),
  subscribeCandles: vi.fn((_request, subscription: CandleSubscription) => { subscription.onStatus('DELAYED'); return vi.fn() }),
}
const Fixture = LiveChart as FunctionComponent<{ provider: MarketDataProvider }>

describe('LiveChart Forex reference mode', () => {
  it('renders recognizable vector crypto logos in the symbol picker', async () => {
    render(createElement(Fixture, { provider }))
    await screen.findByRole('img', { name: /market data candlesticks/i })
    fireEvent.click(screen.getByLabelText('Symbol'))
    const ethereum = screen.getByRole('img', { name: 'Ethereum / US Dollar icon' })
    expect(ethereum).toHaveAttribute('src', '/symbol-icons/eth.svg')
    expect(ethereum.getAttribute('title')).toContain('CC0-1.0')
    expect(ethereum).not.toHaveTextContent('Ξ')
  })

  it('keeps historical-only Forex pairs out of the normal live symbol picker', async () => {
    render(createElement(Fixture, { provider }))
    await screen.findByRole('img', { name: /market data candlesticks/i })
    fireEvent.click(screen.getByLabelText('Symbol'))
    fireEvent.click(screen.getByRole('tab', { name: 'Forex' }))
    expect(screen.getByText('No live symbol matches this search.')).toBeVisible()
    expect(screen.queryByRole('img', { name: 'EUR and USD currency flags' })).not.toBeInTheDocument()
    expect(provider.getHistoricalCandles).not.toHaveBeenCalledWith(expect.objectContaining({ symbol: 'EUR-USD' }))
  })
})
