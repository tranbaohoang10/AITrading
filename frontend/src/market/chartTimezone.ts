import type { ChartSettings } from './chartTypes'

export type ChartTimezone = ChartSettings['timezone']
const cityZones: Array<[string, string]> = [["Pacific/Honolulu","Honolulu"],["America/Anchorage","Anchorage"],["America/Juneau","Juneau"],["America/Los_Angeles","Los Angeles"],["America/Vancouver","Vancouver"],["America/Phoenix","Phoenix"],["America/Denver","Denver"],["America/Mexico_City","Mexico City"],["America/El_Salvador","San Salvador"],["America/Chicago","Chicago"],["America/Bogota","Bogota"],["America/Lima","Lima"],["America/New_York","New York"],["America/Toronto","Toronto"],["America/Caracas","Caracas"],["America/Halifax","Halifax"],["America/Santiago","Santiago"],["America/Argentina/Buenos_Aires","Buenos Aires"],["America/Sao_Paulo","Sao Paulo"],["Atlantic/Reykjavik","Reykjavik"],["Europe/London","London"],["Europe/Berlin","Berlin"],["Europe/Paris","Paris"],["Europe/Zurich","Zurich"],["Africa/Johannesburg","Johannesburg"],["Europe/Istanbul","Istanbul"],["Europe/Moscow","Moscow"],["Asia/Riyadh","Riyadh"],["Asia/Dubai","Dubai"],["Asia/Kolkata","Mumbai"],["Asia/Bangkok","Bangkok"],["Asia/Ho_Chi_Minh","Ho Chi Minh"],["Asia/Singapore","Singapore"],["Asia/Hong_Kong","Hong Kong"],["Asia/Shanghai","Shanghai"],["Asia/Taipei","Taipei"],["Asia/Tokyo","Tokyo"],["Asia/Seoul","Seoul"],["Australia/Perth","Perth"],["Australia/Adelaide","Adelaide"],["Australia/Brisbane","Brisbane"],["Australia/Sydney","Sydney"],["Pacific/Auckland","Auckland"]]
export function timezoneOffsetMinutes(zone: string, instant: Date): number {
  const offset = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(instant).find(part => part.type === 'timeZoneName')!.value
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset)
  return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0
}
export function chartTimezoneOptionsAt(instant = new Date()): Array<{ value: string; label: string; short: string }> {
  const zones = cityZones.flatMap(([value, city]) => {
    try {
      const minutes = timezoneOffsetMinutes(value, instant), absolute = Math.abs(minutes)
      const offset = 'UTC' + (minutes < 0 ? '-' : '+') + Math.floor(absolute / 60) + (absolute % 60 ? ':' + String(absolute % 60).padStart(2, '0') : '')
      return [{ value, city, minutes, label: '(' + offset + ') ' + city, short: city }]
    } catch { return [] }
  }).sort((first, second) => first.minutes - second.minutes || first.city.localeCompare(second.city))
  return [{ value: 'UTC', label: 'UTC', short: 'UTC' }, { value: 'EXCHANGE', label: 'Exchange', short: 'Exchange' }, { value: 'LOCAL', label: 'Local time', short: 'Local' }, ...zones]
}
export const chartTimezoneOptions = chartTimezoneOptionsAt()

const fixedOffset = (value: ChartTimezone) => {
  const match = /^UTC([+-])(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const minutes = Number(match[2]) * 60 + Number(match[3])
  return (match[1] === '-' ? -1 : 1) * minutes
}

export function validExchangeTimezone(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 80) return undefined
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return value } catch { return undefined }
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
