import { AlpacaMarketDataProvider } from './AlpacaMarketDataProvider'

it('never substitutes historical polling for an unavailable Alpaca realtime stream', () => {
  const fetcher = vi.fn(), onCandle = vi.fn(), onStatus = vi.fn()
  const stop = new AlpacaMarketDataProvider(fetcher).subscribeCandles({ symbol: 'AAPL', interval: '1m' }, { onCandle, onStatus, onReconnect: vi.fn() })
  expect(onStatus).toHaveBeenCalledWith('DISCONNECTED')
  expect(onCandle).not.toHaveBeenCalled()
  expect(fetcher).not.toHaveBeenCalled()
  stop()
})
