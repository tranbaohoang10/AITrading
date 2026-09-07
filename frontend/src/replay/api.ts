import { ApiError, privateRequest } from '../auth/api'
import type { Candle } from '../market/api'

export type ReplayTrade = { id: string; state: string; side: 'LONG' | 'SHORT'; quantity: number; intendedEntry: number; stop: number; target: number; entry: number | null; entryTime: string | null; exit: number | null; exitTime: string | null; netPnl: number | null; ambiguity: string | null; exitReason: string | null }
export type ReplayView = { id: string; provider: string; instrument: string; timeframe: string; currency: string; cursor: number; version: number; status: string; initialBalance: number; balance: number; equity: number; realizedPnl: number; openPnl: number; simulation: boolean; metadata: { displaySymbol: string; quantityIncrement: number | null }; candles: Candle[]; trades: ReplayTrade[] }
export type Capability = { providerId: string; displayName: string; historicalReplaySupported: boolean; supportedTimeframes: string[]; configured: boolean }
export async function read(account: string, path: string) { return (await privateRequest(account, path)).json() as Promise<unknown> }
// One short-lived, owner-bound token in memory; never browser storage. Playback
// must not consume the CSRF bootstrap quota once per candle.
let securityToken: { account: string; token: string; expires: number } | undefined
export async function write(account: string, path: string, body: unknown, knownCursor?: number) {
  if (!securityToken || securityToken.account !== account || securityToken.expires <= Date.now()) {
    const token = await (await privateRequest(account, '/auth/csrf')).json() as { headerName: string; token: string }
    if (token.headerName !== 'X-CSRF-TOKEN' || typeof token.token !== 'string' || token.token.length > 512) throw new Error('Invalid security token')
    securityToken = { account, token: token.token, expires: Date.now() + 30_000 }
  }
  const captured = securityToken
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': captured.token }
    if (knownCursor !== undefined) headers['X-Replay-Known-Cursor'] = String(knownCursor)
    return await (await privateRequest(account, path, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) })).json() as unknown
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403) && securityToken === captured) securityToken = undefined
    throw error
  }
}
export function view(raw: unknown, previous?: ReplayView | null): ReplayView {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid replay response')
  if ('candleStart' in raw) {
    const window = raw as { candleStart: number; state: ReplayView }
    if (!previous || !window.state || window.state.id !== previous.id || window.state.provider !== previous.provider
      || window.state.instrument !== previous.instrument || window.state.timeframe !== previous.timeframe
      || window.candleStart !== previous.candles.length || !Array.isArray(window.state.candles)
      || window.state.version < previous.version) throw new Error('Invalid replay window; reload session')
    return view({ ...window.state, candles: [...previous.candles, ...window.state.candles] })
  }
  const v = raw as ReplayView
  if (v.simulation !== true || !Number.isSafeInteger(v.cursor) || v.cursor < 0 || !Number.isSafeInteger(v.version) || v.version < 1 || !Array.isArray(v.candles) || v.candles.length !== v.cursor + 1 || v.candles.length > 20000 || !Array.isArray(v.trades)) throw new Error('Invalid replay response')
  let previousTime = -Infinity
  const candles = v.candles.map((c, ordinal) => {
    if (!c || typeof c !== 'object' || typeof c.time !== 'string' || !c.time.endsWith('Z')) throw new Error('Invalid replay candle')
    const time = Date.parse(c.time)
    const values = [c.open, c.high, c.low, c.close, c.volume]
    if (!Number.isFinite(time) || time <= previousTime || !values.every(n => (typeof n === 'number' || typeof n === 'string' && n.trim() !== '') && Number.isFinite(Number(n)) && Number(n) <= 1e15)) throw new Error('Invalid replay candle')
    const [open, high, low, close, volume] = values.map(Number)
    if (Math.min(open, high, low, close) <= 0 || volume < 0 || high < Math.max(open, low, close) || low > Math.min(open, high, close)) throw new Error('Invalid replay candle')
    previousTime = time
    return { ...c, ordinal, open: String(c.open), high: String(c.high), low: String(c.low), close: String(c.close), volume: String(c.volume) }
  })
  return { ...v, candles }
}
