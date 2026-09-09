import { expect, it } from 'vitest'
import { canonicalCatalog } from './canonicalCatalog'
import { DEFAULT_INSTRUMENTS } from './liveMarket'

it('retains distinct routes under one identity without mixing quote currencies', () => {
  const original = DEFAULT_INSTRUMENTS[0]
  const alternative = { ...original, provider: 'SECOND', providerSymbol: 'BTC_USD', modes: ['HISTORICAL'] as typeof original.modes }
  const result = canonicalCatalog([original, alternative, original, { ...original, symbol: 'BTC-USDT', displaySymbol: 'BTC/USDT', quote: 'USDT' }])
  expect(result).toHaveLength(2)
  expect(result[0].routes).toEqual([original, alternative])
  expect(result[1].canonicalId).toBe('CRYPTO:BTCUSDT')
  expect(original.modes).toContain('REALTIME')
})
