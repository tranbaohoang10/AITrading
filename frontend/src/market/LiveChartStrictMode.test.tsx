import { render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { expect, it, vi } from 'vitest'
import { LiveChart } from './LiveChart'
import type { MarketCandle, MarketDataProvider } from './liveMarket'

it('loads candles after StrictMode cancels the initial setup', async () => {
  let calls = 0
  const provider: MarketDataProvider = {
    getHistoricalCandles: vi.fn(request => {
      calls += 1
      if (calls === 1) return new Promise<MarketCandle[]>((_resolve, reject) => {
        request.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
      return Promise.resolve([{ symbol: request.symbol, interval: request.interval, openTime: 1_700_000_040_000, closeTime: 1_700_000_099_999, open: '100', high: '102', low: '99', close: '101', volume: '5', closed: true }])
    }),
    subscribeCandles: vi.fn((_request, subscription) => { subscription.onStatus('LIVE'); return vi.fn() }),
  }
  render(<StrictMode><LiveChart provider={provider} /></StrictMode>)
  expect(await screen.findByRole('img', { name: /BTC\/USD live Coinbase candlesticks, 1 candles/ })).toBeInTheDocument()
  expect(provider.getHistoricalCandles).toHaveBeenCalledTimes(2)
  expect(screen.queryByText(/Loading BTC\/USD/)).not.toBeInTheDocument()
})
