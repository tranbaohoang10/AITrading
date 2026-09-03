import type { Candle } from './api'

export const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] as const
export type Timeframe = typeof TIMEFRAMES[number]

const MINUTES: Record<Timeframe, number> = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440 }

export function normalizeTimeframe(value: string): Timeframe | null {
  const normalized = value.toLowerCase()
  return TIMEFRAMES.find(item => item === normalized) ?? null
}

export function timeframeLabel(value: Timeframe) {
  return value === '1d' ? '1D' : value
}

export function timeframeAvailability(nativeValue: string) {
  const native = normalizeTimeframe(nativeValue)
  if (!native) return TIMEFRAMES.map(value => ({ value, enabled: false, reason: 'Unsupported native interval' }))
  const base = MINUTES[native]
  return TIMEFRAMES.map(value => {
    const requested = MINUTES[value]
    if (requested < base) return { value, enabled: false, reason: `Cannot derive ${timeframeLabel(value)} from ${timeframeLabel(native)} candles` }
    if (requested % base !== 0) return { value, enabled: false, reason: `${timeframeLabel(value)} is not an exact multiple of ${timeframeLabel(native)}` }
    return { value, enabled: true, reason: value === native ? 'Native dataset interval' : 'UTC display aggregation only' }
  })
}

export function aggregateCandles(items: Candle[], nativeValue: string, requestedValue: Timeframe): Candle[] {
  const native = normalizeTimeframe(nativeValue)
  if (!native) return items
  const nativeMinutes = MINUTES[native], requestedMinutes = MINUTES[requestedValue]
  if (requestedMinutes < nativeMinutes || requestedMinutes % nativeMinutes !== 0 || requestedValue === native) return items
  const bucketMs = requestedMinutes * 60_000
  const result: Candle[] = []
  let key = Number.NaN
  for (const candle of items) {
    const time = Date.parse(candle.time)
    if (!Number.isFinite(time)) continue
    const nextKey = Math.floor(time / bucketMs) * bucketMs
    const current = result.at(-1)
    if (!current || nextKey !== key) {
      key = nextKey
      result.push({ ...candle, time: new Date(nextKey).toISOString().replace('.000Z', 'Z') })
      continue
    }
    current.high = String(Math.max(Number(current.high), Number(candle.high)))
    current.low = String(Math.min(Number(current.low), Number(candle.low)))
    current.close = candle.close
    current.volume = String(Number(current.volume) + Number(candle.volume))
  }
  return result
}

export function sma(values: number[], period: number): Array<number | null> {
  const length = Math.max(1, Math.floor(period)), result: Array<number | null> = Array(values.length).fill(null)
  let sum = 0
  for (let index = 0; index < values.length; index++) {
    sum += values[index]
    if (index >= length) sum -= values[index - length]
    if (index >= length - 1) result[index] = sum / length
  }
  return result
}

export function ema(values: number[], period: number): Array<number | null> {
  const length = Math.max(1, Math.floor(period)), result: Array<number | null> = Array(values.length).fill(null)
  if (values.length < length) return result
  let average = values.slice(0, length).reduce((total, value) => total + value, 0) / length
  result[length - 1] = average
  const multiplier = 2 / (length + 1)
  for (let index = length; index < values.length; index++) {
    average = (values[index] - average) * multiplier + average
    result[index] = average
  }
  return result
}

export function rsi(values: number[], period: number): Array<number | null> {
  const length = Math.max(1, Math.floor(period)), result: Array<number | null> = Array(values.length).fill(null)
  if (values.length <= length) return result
  let gain = 0, loss = 0
  for (let index = 1; index <= length; index++) {
    const change = values[index] - values[index - 1]
    gain += Math.max(change, 0); loss += Math.max(-change, 0)
  }
  let averageGain = gain / length, averageLoss = loss / length
  const value = () => averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss)
  result[length] = value()
  for (let index = length + 1; index < values.length; index++) {
    const change = values[index] - values[index - 1]
    averageGain = (averageGain * (length - 1) + Math.max(change, 0)) / length
    averageLoss = (averageLoss * (length - 1) + Math.max(-change, 0)) / length
    result[index] = value()
  }
  return result
}
