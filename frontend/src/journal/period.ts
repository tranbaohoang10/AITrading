import type { Filter } from './api'
export type Period = 'day' | 'week' | 'month'
export const dayString = (date: Date) => date.toISOString().slice(0, 10)
export function todayInZone(zone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-')
}
export function periodFilter(anchor: string, mode: Period, filter: Filter): Filter {
  const start = new Date(`${anchor}T00:00:00Z`), end = new Date(start)
  if (mode === 'week') { start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7); end.setTime(start.getTime()); end.setUTCDate(end.getUTCDate() + 6) }
  if (mode === 'month') { start.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1, 0) }
  return { ...filter, from: dayString(start), to: dayString(end) }
}
export function shiftPeriod(anchor: string, mode: Period, delta: number) {
  const date = new Date(`${anchor}T00:00:00Z`)
  if (mode === 'month') date.setUTCMonth(date.getUTCMonth() + delta, 1)
  else date.setUTCDate(date.getUTCDate() + delta * (mode === 'week' ? 7 : 1))
  return dayString(date)
}
export function sumDecimals(values: string[]) {
  const scale = 10n ** 16n
  const sum = values.reduce((total, value) => { const [whole, fraction = ''] = value.replace('-', '').split('.'); return total + (BigInt(whole) * scale + BigInt(fraction.padEnd(16, '0'))) * (value.startsWith('-') ? -1n : 1n) }, 0n)
  const magnitude = sum < 0n ? -sum : sum
  return `${sum < 0n ? '-' : ''}${magnitude / scale}.${String(magnitude % scale).padStart(16, '0')}`.replace(/\.?0+$/, '') || '0'
}
