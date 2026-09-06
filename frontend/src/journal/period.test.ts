import { periodFilter, shiftPeriod, sumDecimals, todayInZone } from './period'
const filter = { from: '', to: '', zone: 'America/New_York', currency: 'USD' }
it('derives inclusive calendar ranges without DST duration arithmetic', () => {
  expect(periodFilter('2024-02-29', 'month', filter)).toMatchObject({ from: '2024-02-01', to: '2024-02-29' })
  expect(periodFilter('2024-03-10', 'day', filter)).toMatchObject({ from: '2024-03-10', to: '2024-03-10' })
  expect(periodFilter('2025-01-01', 'week', filter)).toMatchObject({ from: '2024-12-30', to: '2025-01-05' })
  expect(periodFilter('2024-03-01', 'week', filter)).toMatchObject({ from: '2024-02-26', to: '2024-03-03' })
  expect(shiftPeriod('2024-01-31', 'month', 1)).toBe('2024-02-01')
  const now = new Date('2024-03-10T04:30:00Z'), original = now.getTime()
  expect(todayInZone('America/New_York', now)).toBe('2024-03-09')
  expect(todayInZone('Asia/Ho_Chi_Minh', now)).toBe('2024-03-10')
  expect(now.getTime()).toBe(original)
  expect(sumDecimals(['0.1', '0.2', '-0.05'])).toBe('0.25')
})
