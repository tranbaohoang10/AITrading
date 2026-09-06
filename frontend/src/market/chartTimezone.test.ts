import { describe, expect, it } from 'vitest'
import { dateForTimezone, formatChartDate, timezoneForIntl, timezoneShort } from './chartTimezone'

describe('chart timezone formatting', () => {
  const instant = '2024-01-01T00:00:00Z'

  it('formats fixed offsets without relying on an unsupported Intl time zone', () => {
    expect(timezoneForIntl('UTC+07:00')).toBe('UTC')
    expect(dateForTimezone(instant, 'UTC+07:00').toISOString()).toBe('2024-01-01T07:00:00.000Z')
    expect(formatChartDate(instant, 'UTC+07:00', { hour: '2-digit', minute: '2-digit', hour12: false })).toBe('07:00')
  })

  it('keeps IANA zones and readable short labels', () => {
    expect(timezoneForIntl('Asia/Ho_Chi_Minh')).toBe('Asia/Ho_Chi_Minh')
    expect(timezoneShort('America/New_York')).toBe('ET')
    expect(formatChartDate(instant, 'Asia/Ho_Chi_Minh', { hour: '2-digit', minute: '2-digit', hour12: false })).toBe('07:00')
  })
})
