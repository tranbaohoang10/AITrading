import { ApiError, privateRequest } from '../auth/api'

export type FeedStatus = { provider: string; configured: boolean; status: string; limitation: string }
export type IntelligenceStatus = { news: FeedStatus; calendar: FeedStatus }
export type NewsItem = { id: string; title: string; source: string; publishedAt: string; url: string; symbols: string }
export type NewsResponse = { provider: string; query: string; timezone: string; items: NewsItem[]; status: string }
export type CalendarEvent = { id: string; country: string; event: string; importance: string; scheduledAt: string; timezone: string; sourceUrl: string }
export type CalendarResponse = { provider: string; from: string; to: string; timezone: string; items: CalendarEvent[]; status: string }

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : (() => { throw new Error('Invalid market intelligence response.') })()
const string = (value: unknown) => typeof value === 'string' ? value : (() => { throw new Error('Invalid market intelligence response.') })()
const bool = (value: unknown) => typeof value === 'boolean' ? value : (() => { throw new Error('Invalid market intelligence response.') })()
const status = (value: unknown): FeedStatus => { const v = object(value); return { provider: string(v.provider), configured: bool(v.configured), status: string(v.status), limitation: string(v.limitation) } }
const unavailable = (error: unknown) => error instanceof ApiError && error.status === 503 ? new Error('This provider is not configured. No market intelligence data is being invented.') : error

export async function getStatus(accountId: string): Promise<IntelligenceStatus> {
  const body = object(await (await privateRequest(accountId, '/market-intelligence/status')).json())
  return { news: status(body.news), calendar: status(body.calendar) }
}

export async function getNews(accountId: string, query: string, timezone: string): Promise<NewsResponse> {
  try {
    const body = object(await (await privateRequest(accountId, `/market-intelligence/news?query=${encodeURIComponent(query)}&timezone=${encodeURIComponent(timezone)}`)).json())
    const items = body.items; if (!Array.isArray(items) || items.length > 50) throw new Error('Invalid market intelligence response.')
    return { provider: string(body.provider), query: string(body.query), timezone: string(body.timezone), status: string(body.status), items: items.map(value => { const v = object(value); return { id: string(v.id), title: string(v.title), source: string(v.source), publishedAt: string(v.publishedAt), url: string(v.url), symbols: string(v.symbols) } }) }
  } catch (error) { throw unavailable(error) }
}

export async function getCalendar(accountId: string, from: string, to: string, timezone: string): Promise<CalendarResponse> {
  try {
    const body = object(await (await privateRequest(accountId, `/market-intelligence/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&timezone=${encodeURIComponent(timezone)}`)).json())
    const items = body.items; if (!Array.isArray(items) || items.length > 500) throw new Error('Invalid market intelligence response.')
    return { provider: string(body.provider), from: string(body.from), to: string(body.to), timezone: string(body.timezone), status: string(body.status), items: items.map(value => { const v = object(value); return { id: string(v.id), country: string(v.country), event: string(v.event), importance: string(v.importance), scheduledAt: string(v.scheduledAt), timezone: string(v.timezone), sourceUrl: string(v.sourceUrl) } }) }
  } catch (error) { throw unavailable(error) }
}
