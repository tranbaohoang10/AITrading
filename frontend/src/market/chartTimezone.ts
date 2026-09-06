import type { ChartSettings } from './chartTypes'

export type ChartTimezone = ChartSettings['timezone']
export const chartTimezoneOptions: Array<{ value: ChartTimezone; label: string; short: string }> = [
  { value: 'EXCHANGE', label: 'Exchange (UTC)', short: 'UTC' },
  { value: 'LOCAL', label: 'Local browser time', short: 'Local' },
  { value: 'UTC', label: 'UTC', short: 'UTC' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Asia/Ho_Chi_Minh (ICT)', short: 'ICT' },
  { value: 'America/New_York', label: 'America/New_York (ET)', short: 'ET' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)', short: 'LDN' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)', short: 'JST' },
  { value: 'UTC-05:00', label: 'UTC−05:00 fixed', short: 'UTC−5' },
  { value: 'UTC+07:00', label: 'UTC+07:00 fixed', short: 'UTC+7' },
  { value: 'UTC+09:00', label: 'UTC+09:00 fixed', short: 'UTC+9' },
]

const fixedOffset = (value: ChartTimezone) => {
  const match = /^UTC([+-])(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return (match[1] === '-' ? -1 : 1) * minutes
}

export function timezoneForIntl(value: ChartTimezone): string | undefined {
  if (value === 'LOCAL') return undefined
  if (value === 'EXCHANGE') return 'UTC'
  return fixedOffset(value) === null ? value : 'UTC'
}

export function dateForTimezone(value: string | Date, timezone: ChartTimezone): Date {
  const date = value instanceof Date ? value : new Date(value)
  const offset = fixedOffset(timezone)
  return offset === null ? date : new Date(date.getTime() + offset * 60_000)
}

export function formatChartDate(value: string | Date, timezone: ChartTimezone, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: timezoneForIntl(timezone) }).format(dateForTimezone(value, timezone)).replace(',', '')
}

export function timezoneShort(value: ChartTimezone): string {
  return chartTimezoneOptions.find(option => option.value === value)?.short ?? value
}
