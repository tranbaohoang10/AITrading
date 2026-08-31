import type { Entry, Filter, Summary, Values } from './api'

export const key = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export function fixture(n = 1): Entry {
  return { id: key(n), version: 1, data: { symbol: 'TEST_USD', timeframe: '1h', settlementCurrency: 'USD', side: 'LONG', state: 'CLOSED', quantity: '0.3', entryPrice: '0.1', exitPrice: '0.2', entryFee: '0.001', exitFee: '0.002', entryTime: '2024-01-01T00:00:00Z', exitTime: '2024-01-02T00:00:00Z', entryReason: '<script>inert reason</script>', notes: 'Private notes', datasetId: null }, grossPnl: '0.03', netPnl: '0.027', createdAt: '2024-01-03T00:00:00Z', updatedAt: '2024-01-03T00:00:00Z' }
}
export const zero: Values = { closed: 0, open: 0, wins: 0, losses: 0, breakeven: 0, grossPnl: '0', fees: '0', netPnl: '0' }
export function summaryFixture(filter: Filter, populated = false): Summary {
  const days = []
  for (let time = Date.parse(filter.from); time <= Date.parse(filter.to); time += 86400000) days.push({ date: new Date(time).toISOString().slice(0, 10), values: { ...zero } })
  const totals = populated ? { ...zero, closed: 1, wins: 1, grossPnl: '0.03', fees: '0.003', netPnl: '0.027' } : { ...zero }
  if (populated && days.length) days[0].values = { ...totals }
  return { filter: { ...filter }, days, totals }
}
