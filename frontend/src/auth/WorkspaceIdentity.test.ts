import { ApiError, currentUser, privateMutate, privateRequest } from './api'
import * as chat from '../chat/api'
import * as ai from '../chat/aiApi'
import * as market from '../market/api'
import * as strategy from '../strategy/api'
import * as backtest from '../backtest/api'
import * as journal from '../journal/api'
import { fixture } from '../journal/fixtures'

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const filter = { from: '2024-01-01', to: '2024-01-31', zone: 'UTC', currency: 'USD' }
afterEach(() => vi.unstubAllGlobals())

it('fails closed before transport for missing/malformed private account identity and overrides forged headers', async () => {
  const network = vi.fn().mockResolvedValue(response({})); vi.stubGlobal('fetch', network)
  for (const id of [undefined, '', 'owner-a', a.toUpperCase(), '../account', `${a},${b}`]) {
    expect(() => privateRequest(id, '/conversations')).toThrow(ApiError)
    expect(() => privateMutate(id, '/auth/logout')).toThrow(ApiError)
  }
  expect(network).not.toHaveBeenCalled()
  await privateRequest(a, '/conversations', { headers: { 'X-Workspace-User': b, 'Accept': 'application/json' } })
  const headers = new Headers(network.mock.calls[0][1].headers)
  expect(headers.get('X-Workspace-User')).toBe(a); expect(headers.get('Accept')).toBe('application/json')
})

it('binds every module read and pagination while bootstrap discovery remains explicitly unbound', async () => {
  const network = vi.fn().mockResolvedValue(response({}, 401)); vi.stubGlobal('fetch', network)
  for (const read of [() => chat.listConversations('page', a), () => chat.getMessages(b, 3, a),
    () => ai.getAiConfiguration(a), () => ai.getLatestAiTurn(b, a), () => market.listDatasets('page', a),
    () => market.getDataset(b, a), () => strategy.listStrategies('page', a), () => strategy.history(b, 2, a),
    () => strategy.getRevision(b, 1, a), () => backtest.listJobs('page', a), () => backtest.getJob(b, a),
    () => backtest.capabilities(a), () => journal.list(filter, 'page', a), () => journal.summary(filter, a),
    () => journal.get(b, a), () => currentUser(a)]) {
    await expect(read()).rejects.toMatchObject({ status: 401 })
    expect(new Headers(network.mock.calls.at(-1)![1].headers).get('X-Workspace-User')).toBe(a)
  }
  await expect(currentUser()).rejects.toMatchObject({ status: 401 })
  expect(new Headers(network.mock.calls.at(-1)![1].headers).has('X-Workspace-User')).toBe(false)
})

it.each(['chat', 'ai', 'market', 'strategy', 'backtest', 'journal', 'profile', 'logout', 'dsl'] as const)(
  'keeps captured A through delayed CSRF when the shared session becomes B: %s', async module => {
    let finish!: (r: Response) => void
    let session = a
    const network = vi.fn(async (path: string, options?: RequestInit) => {
      if (path === '/api/auth/csrf') return new Promise<Response>(resolve => { finish = resolve })
      const expected = new Headers(options?.headers).get('X-Workspace-User')
      return response({}, expected === session ? 200 : 401)
    })
    vi.stubGlobal('fetch', network)
    const captured = session
    const operations = {
      chat: () => chat.createConversation(b, captured),
      ai: () => ai.startAi({ conversationId: b, requestId: b, expectedVersion: 2, sourceSequence: 1 }, captured),
      market: () => market.importDataset({ requestId: b, name: 'Private A', symbol: 'TEST_USD', timeframe: '1h', sourceKind: 'SYNTHETIC', sourceLabel: 'Fixture', csv: 'timestamp,open,high,low,close,volume' }, captured),
      strategy: () => strategy.createStrategy({ requestId: b, title: 'Private A' }, captured),
      backtest: () => backtest.createJob({ requestId: b, strategyId: b, revision: 1, datasetId: b }, captured),
      journal: () => journal.save(null, { requestId: b, expectedVersion: 0, entry: fixture().data }, captured),
      profile: () => privateMutate(captured, '/auth/profile', { displayName: 'Private A' }, 'PATCH'),
      logout: () => privateMutate(captured, '/auth/logout'),
      dsl: () => strategy.validateDraft('{}', captured),
    }
    const pending = operations[module]()
    session = b
    finish(response({ headerName: 'X-CSRF-TOKEN', token: 'synthetic-b-token' }))
    await expect(pending).rejects.toMatchObject({ status: 401 })
    expect(network).toHaveBeenCalledTimes(2)
    expect(new Headers(network.mock.calls[1][1]?.headers).get('X-Workspace-User')).toBe(a)
    expect(new Headers(network.mock.calls[1][1]?.headers).get('X-CSRF-TOKEN')).toBe('synthetic-b-token')
    expect(network.mock.calls[1][1]?.credentials).toBe('same-origin')
  })
