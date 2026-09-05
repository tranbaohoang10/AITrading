import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  it('shows currency icons, chooses a Forex reference pair, and locks the chart to daily data', async () => {
    render(createElement(Fixture, { provider }))
    await screen.findByRole('img', { name: /live Coinbase candlesticks/i })
    fireEvent.click(screen.getByLabelText('Symbol'))
    fireEvent.click(screen.getByRole('tab', { name: 'Forex' }))
    expect(screen.getByRole('img', { name: 'EUR and USD currency flags' })).toBeInTheDocument()
    expect(screen.getAllByText('ECB · EOD')).toHaveLength(7)
    fireEvent.click(screen.getByRole('button', { name: /EUR\/USD Euro \/ U\.S\. Dollar/ }))
    await waitFor(() => expect(provider.getHistoricalCandles).toHaveBeenLastCalledWith(expect.objectContaining({ symbol: 'EUR-USD', interval: '1d' })))
    expect(screen.getByLabelText('FRANKFURTER · ECB · EOD · DELAYED')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Timeframe'))
    expect(screen.getByRole('menuitemradio', { name: '1m' })).toBeDisabled()
    expect(screen.getByRole('menuitemradio', { name: '1D' })).toHaveAttribute('aria-checked', 'true')
  })
})
