import * as api from './api'
import { fixture, key, summaryFixture } from './fixtures'

const filter: api.Filter = { from: '2024-01-01', to: '2024-01-03', zone: 'UTC', currency: 'USD' }
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
afterEach(() => vi.unstubAllGlobals())
it('preserves exact saved decimal and inert text values with same-owner resource identity', async () => {
  const entry = fixture(), fetcher = vi.fn().mockResolvedValueOnce(reply(entry)); vi.stubGlobal('fetch', fetcher)
  expect(await api.get(entry.id)).toEqual(entry)
  expect(fetcher.mock.calls[0][0]).toBe(`/api/journal/${entry.id}`)
  expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store' })
  for (const value of [{ ...entry, id: key(2) }, { ...entry, netPnl: 'NaN' }, { ...entry, data: { ...entry.data, quantity: '1000000000000.00000001' } }, { ...entry, data: { ...entry.data, state: 'OPEN' } }]) {
    fetcher.mockResolvedValueOnce(reply(value)); await expect(api.get(entry.id)).rejects.toThrow('Invalid journal')
  }
})
it('checks report filter/day identities, counts, exact monetary sums and unit isolation', async () => {
  const summary = summaryFixture(filter, true), fetcher = vi.fn().mockResolvedValueOnce(reply(summary)); vi.stubGlobal('fetch', fetcher)
  expect(await api.summary(filter)).toEqual(summary)
  const changed = structuredClone(summary); changed.totals.netPnl = '0.028'
  const day = structuredClone(summary); day.days[1].date = day.days[0].date
  for (const value of [changed, day, { ...summary, filter: { ...filter, currency: 'EUR' } }, { ...summary, days: [] }, { ...summary, totals: { ...summary.totals, wins: 2 } }]) {
    fetcher.mockResolvedValueOnce(reply(value)); await expect(api.summary(filter)).rejects.toThrow('Invalid journal')
  }
  fetcher.mockResolvedValueOnce(reply({ filter, items: [fixture()], nextCursor: null }));expect((await api.list(filter)).items[0].netPnl).toBe('0.027')
  for (const items of [[fixture(), fixture()], [{ ...fixture(), data: { ...fixture().data, settlementCurrency: 'EUR' } }]]) {
    fetcher.mockResolvedValueOnce(reply({ filter, items, nextCursor: null }));await expect(api.list(filter)).rejects.toThrow('Invalid journal')
  }
})
it('uses fresh CSRF and exact nested intent, validates current versus applied version on replay', async () => {
  const intent: api.Write = { requestId: key(20), expectedVersion: 0, entry: fixture().data }
  const saved = { requestId: intent.requestId, appliedVersion: 1, entry: { ...fixture(), version: 2 } }
  const fetcher = vi.fn().mockResolvedValueOnce(reply({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })).mockResolvedValueOnce(reply(saved));vi.stubGlobal('fetch', fetcher)
  expect(await api.save(null, intent, key(90))).toEqual(saved)
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual(intent);expect(fetcher.mock.calls[1][1].headers['X-CSRF-TOKEN']).toBe('synthetic')
  expect(fetcher.mock.calls[1][1].headers['X-Workspace-User']).toBe(key(90))
  fetcher.mockResolvedValueOnce(reply({ headerName: 'X-CSRF-TOKEN', token: 'synthetic2' })).mockResolvedValueOnce(reply({ ...saved, requestId: key(21) }))
  await expect(api.save(null, intent, key(90))).rejects.toThrow('Invalid journal')
  expect(fetcher).toHaveBeenCalledTimes(4)
})
it('bounds streamed payloads, rejects path traversal and propagates auth and delete failures', async () => {
  const fetcher = vi.fn();vi.stubGlobal('fetch', fetcher)
  await expect(api.get('../../private')).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled()
  fetcher.mockResolvedValueOnce(new Response(' '.repeat(1024 * 1024 + 1)));await expect(api.get(key(1))).rejects.toThrow('Invalid journal')
  fetcher.mockResolvedValueOnce(reply({}, 401));await expect(api.list(filter)).rejects.toMatchObject({ status: 401 })
  fetcher.mockResolvedValueOnce(reply({ headerName: 'X-CSRF-TOKEN', token: 'synthetic' })).mockResolvedValueOnce(new Response(null, { status: 204 }))
  await expect(api.remove(fixture(), key(90))).resolves.toBeUndefined();expect(fetcher.mock.calls[3][1].method).toBe('DELETE')
  expect(JSON.parse(fetcher.mock.calls[3][1].body)).toEqual({ expectedVersion: 1 })
})
