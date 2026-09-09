import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { chartTimezoneOptionsAt, formatChartDate, timezoneOffsetMinutes, validExchangeTimezone } from './chartTimezone'
import { LivePriceAxisBadge } from './LivePriceAxisBadge'
import { useChartClock } from './useChartClock'

afterEach(() => vi.useRealTimers())
it('synchronizes clocks mounted at different times and cleans up the shared timer', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-09T12:00:00.250Z'))
  function Clock({ name }: { name: string }) { return <span data-testid={name}>{useChartClock().toISOString()}</span> }
  const first = render(<Clock name="first-clock" />)
  act(() => vi.advanceTimersByTime(400))
  const second = render(<Clock name="second-clock" />)
  expect(vi.getTimerCount()).toBe(1)
  act(() => vi.advanceTimersByTime(350))
  expect(screen.getByTestId('first-clock')).toHaveTextContent('2026-09-09T12:00:01.000Z')
  expect(screen.getByTestId('second-clock').textContent).toBe(screen.getByTestId('first-clock').textContent)
  first.unmount()
  expect(vi.getTimerCount()).toBe(1)
  second.unmount()
  expect(vi.getTimerCount()).toBe(0)
})
it('calculates seasonal city labels, half-hour offsets and sorted friendly options', () => {
  const winter = chartTimezoneOptionsAt(new Date('2026-01-15T12:00:00Z'))
  const summer = chartTimezoneOptionsAt(new Date('2026-07-15T12:00:00Z'))
  const label = (options: typeof winter, value: string) => options.find(option => option.value === value)?.label
  expect(label(winter, 'America/New_York')).toBe('(UTC-5) New York')
  expect(label(summer, 'America/New_York')).toBe('(UTC-4) New York')
  expect(label(winter, 'Europe/London')).toBe('(UTC+0) London')
  expect(label(summer, 'Europe/London')).toBe('(UTC+1) London')
  expect(label(summer, 'Asia/Kolkata')).toBe('(UTC+5:30) Mumbai')
  expect(label(summer, 'Asia/Ho_Chi_Minh')).toBe('(UTC+7) Ho Chi Minh')
  expect(winter.slice(0, 3).map(option => option.value)).toEqual(['UTC', 'EXCHANGE', 'LOCAL'])
  expect(winter.every(option => !option.label.includes('/'))).toBe(true)
  expect(new Set(winter.map(option => option.value)).size).toBe(winter.length)
  const offsets = winter.slice(3).map(option => timezoneOffsetMinutes(option.value, new Date('2026-01-15T12:00:00Z')))
  expect(offsets).toEqual([...offsets].sort((first, second) => first - second))
  expect(validExchangeTimezone('Europe/Berlin')).toBe('Europe/Berlin')
  expect(validExchangeTimezone('unverified/exchange')).toBeUndefined()
  expect(label(winter, 'Australia/Sydney')).toBe('(UTC+11) Sydney')
  expect(label(summer, 'Australia/Sydney')).toBe('(UTC+10) Sydney')
  expect(label(winter, 'Pacific/Auckland')).toBe('(UTC+13) Auckland')
  expect(label(summer, 'Pacific/Auckland')).toBe('(UTC+12) Auckland')
})
it('ticks the current price clock without rendering its parent geometry', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-08T14:00:00Z'))
  const geometry = vi.fn()
  function Fixture() { geometry(); return <svg><LivePriceAxisBadge price="100.00" x={10} y={20} width={80} color="#123456" timezone="Asia/Ho_Chi_Minh" /></svg> }
  const view = render(<Fixture />)
  expect(screen.getByTestId('price-clock')).toHaveTextContent('21:00:00')
  act(() => vi.advanceTimersByTime(2000))
  expect(screen.getByTestId('price-clock')).toHaveTextContent('21:00:02')
  expect(geometry).toHaveBeenCalledTimes(1)
  view.unmount(); expect(vi.getTimerCount()).toBe(0)
})
it('converts midnight without mutating UTC identity', () => {
  const instant = new Date('2026-09-08T23:30:00Z')
  expect(formatChartDate(instant, 'Asia/Ho_Chi_Minh', { day: '2-digit', hour: '2-digit', hour12: false })).toContain('09')
  expect(instant.toISOString()).toBe('2026-09-08T23:30:00.000Z')
})
