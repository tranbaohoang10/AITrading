import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, currentUser } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import * as strategiesApi from '../strategy/api'
import * as marketApi from '../market/api'
import * as api from './api'
import { BacktestContext } from './BacktestContext'

type Intent = { kind: 'create'; body: api.Create } | { kind: 'retry'; job: api.Job; requestId: string }
const definitive = (error: unknown) => error instanceof ApiError && [400, 401, 403, 404, 409, 413, 422, 429].includes(error.status)
export function BacktestProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  function message(error: unknown) {
    if (error instanceof ApiError && error.status === 401) auth?.clear()
    return error instanceof ApiError ? error.message : 'Unable to verify the response. Refresh or retry the same request.'
  }
  const [items, setItems] = useState<api.Job[]>([]), [selected, setSelected] = useState<api.Job | null>(null)
  const [result, setResult] = useState<api.Result | null>(null), [page, setPage] = useState<api.FrozenPage | null>(null)
  const [strategies, setStrategies] = useState<strategiesApi.Brief[]>([]), [datasets, setDatasets] = useState<marketApi.Dataset[]>([])
  const [versions, setVersions] = useState<strategiesApi.Brief[]>([]), [revision, setRevision] = useState<strategiesApi.Revision | null>(null)
  const [strategyId, setStrategyId] = useState(''), [datasetId, setDatasetId] = useState(''), [configured, setConfigured] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState(''), [chartError, setChartError] = useState(''), [chartLoading, setChartLoading] = useState(false)
  const alive = useRef(true), listEpoch = useRef(0), selectionEpoch = useRef(0), chartEpoch = useRef(0), setupEpoch = useRef(0)
  const intent = useRef<Intent | null>(null), mutation = useRef(false), selectedRef = useRef<api.Job | null>(null), resultRef = useRef<api.Result | null>(null)
  async function verifyIdentity() {
    if (!alive.current || !auth) return
    const actual = await currentUser()
    if (alive.current && actual.id !== auth.user.id) throw new ApiError(401)
  }
  useEffect(() => {
    alive.current = true
    const warn = (event: BeforeUnloadEvent) => { if (intent.current || mutation.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => { alive.current = false; ++listEpoch.current; ++selectionEpoch.current; ++chartEpoch.current; ++setupEpoch.current; window.removeEventListener('beforeunload', warn) }
  }, [])
  const remember = (job: api.Job) => setItems(previous => [job, ...previous.filter(x => x.id !== job.id)].slice(0, 20))
  function clearResult() { ++chartEpoch.current; resultRef.current = null; setResult(null); setPage(null); setChartError(''); setChartLoading(false) }
  async function candleWindow(start: number) {
    const job = selectedRef.current, data = resultRef.current
    if (!job || !data) return
    const token = ++chartEpoch.current; setPage(null); setChartError(''); setChartLoading(true)
    try { const next = await api.getCandles(job, data, start); await verifyIdentity(); if (alive.current && token === chartEpoch.current) setPage(next) }
    catch (failure) { if (alive.current && token === chartEpoch.current) setChartError(message(failure)) }
    finally { if (alive.current && token === chartEpoch.current) setChartLoading(false) }
  }
  async function select(key: string) {
    if (mutation.current || intent.current) return
    const token = ++selectionEpoch.current; selectedRef.current = null; setSelected(null); clearResult(); setError(''); setLoading(true)
    try {
      const job = await api.getJob(key)
      await verifyIdentity()
      if (!alive.current || token !== selectionEpoch.current) return
      selectedRef.current = job; setSelected(job); remember(job)
      if (job.state === 'SUCCEEDED') {
        const data = await api.getResult(job)
        await verifyIdentity()
        if (!alive.current || token !== selectionEpoch.current) return
        resultRef.current = data; setResult(data); await candleWindow(0)
      }
    } catch (failure) { if (alive.current && token === selectionEpoch.current) setError(message(failure)) }
    finally { if (alive.current && token === selectionEpoch.current) setLoading(false) }
  }
  async function load() {
    const token = ++listEpoch.current; setError('')
    try {
      // Account limits are <=100; bounded pagination prevents a malformed endless cursor.
      async function all<T>(read: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>): Promise<T[]> {
        const rows: T[] = []; let cursor: string | undefined
        for (let i = 0; i < 6; i++) { const page = await read(cursor); rows.push(...page.items); if (!page.nextCursor) return rows; cursor = page.nextCursor }
        throw new Error('Catalog limit exceeded')
      }
      const [jobs, scripts, market, ready] = await Promise.all([all(api.listJobs), all(strategiesApi.listStrategies), all(marketApi.listDatasets), api.capabilities()])
      await verifyIdentity()
      if (!alive.current || token !== listEpoch.current) return
      setItems(jobs); setStrategies(scripts); setDatasets(market); setConfigured(ready)
    } catch (failure) { if (alive.current && token === listEpoch.current) setError(message(failure)) }
  }
  async function chooseStrategy(key: string) {
    if (intent.current || mutation.current) return
    const token = ++setupEpoch.current; setStrategyId(key); setVersions([]); setRevision(null); setError('')
    if (!key) return
    try {
      const rows: strategiesApi.Brief[] = []; let before: number | undefined
      for (let i = 0; i < 5; i++) { const page = await strategiesApi.history(key, before); rows.push(...page.items); if (page.nextBefore === null) break; before = page.nextBefore }
      await verifyIdentity()
      if (!alive.current || token !== setupEpoch.current) return
      setVersions(rows.filter(v => v.status === 'VALIDATED'))
    } catch (failure) { if (alive.current && token === setupEpoch.current) setError(message(failure)) }
  }
  async function chooseRevision(version: number) {
    if (intent.current || mutation.current) return
    const key = strategyId, token = ++setupEpoch.current; setRevision(null); setError('')
    if (!version) return
    try { const saved = await strategiesApi.getRevision(key, version); await verifyIdentity(); if (saved.status !== 'VALIDATED') throw new Error('Invalid revision'); if (alive.current && token === setupEpoch.current) setRevision(saved) }
    catch (failure) { if (alive.current && token === setupEpoch.current) setError(message(failure)) }
  }
  async function submit(action: Intent) {
    if (mutation.current) return
    const previouslyUncertain = intent.current !== null
    mutation.current = true; intent.current = action; setBusy(true); setUncertain(false); setError(''); ++selectionEpoch.current; ++listEpoch.current
    selectedRef.current = null; setSelected(null); clearResult(); setLoading(false)
    let completed: api.Job | null = null
    try {
      completed = action.kind === 'create' ? await api.createJob(action.body) : await api.retryJob(action.job, action.requestId)
      await verifyIdentity()
      if (!alive.current) return
      remember(completed); intent.current = null; setUncertain(false)
    } catch (failure) {
      completed = null
      if (!alive.current) return
      if (definitive(failure) && !previouslyUncertain) intent.current = null
      else setUncertain(true)
      setError(message(failure))
    } finally { mutation.current = false; if (alive.current) setBusy(false) }
    if (alive.current && completed) await select(completed.id)
  }
  async function start() {
    if (intent.current || mutation.current || !revision || !configured) return
    const data = datasets.find(x => x.id === datasetId)
    if (!data || data.symbol !== revision.symbol || data.timeframe !== revision.timeframe || data.gapCount || data.candleCount < (revision.minimumBars ?? Infinity)) { setError('Choose a matching complete dataset and saved validated revision.'); return }
    await submit({ kind: 'create', body: { requestId: crypto.randomUUID(), strategyId: revision.strategyId, revision: revision.revision, datasetId } })
  }
  async function retry() { const job = selectedRef.current; if (job && !intent.current && !mutation.current && ['FAILED', 'CANCELLED'].includes(job.state)) await submit({ kind: 'retry', job, requestId: crypto.randomUUID() }) }
  async function change(remove: boolean) {
    const job = selectedRef.current
    if (!job || mutation.current || intent.current) return
    mutation.current = true; setBusy(true); setError(''); ++selectionEpoch.current; ++listEpoch.current; clearResult(); setLoading(false)
    let refresh = true, actionError = ''
    try {
      if (remove) { await api.deleteJob(job); await verifyIdentity(); if (alive.current) { setItems(rows => rows.filter(x => x.id !== job.id)); selectedRef.current = null; setSelected(null); refresh = false } }
      else { const next = await api.cancelJob(job); await verifyIdentity(); if (alive.current) remember(next) }
    } catch (failure) { if (alive.current) { actionError = message(failure); setError(actionError) } }
    finally { mutation.current = false; if (alive.current) setBusy(false) }
    // On uncertain delete/cancel, a read resolves state; never automatically mutate again.
    if (alive.current && refresh) await select(job.id)
    if (alive.current && actionError) setError(actionError)
  }
  return <BacktestContext.Provider value={{ items, selected, result, page, strategies, datasets, versions, revision, strategyId, datasetId, configured, loading, busy, uncertain, error, chartError, chartLoading,
    load, select, window: candleWindow, chooseStrategy, chooseRevision, chooseDataset: key => { if (!intent.current && !mutation.current) setDatasetId(key) },
    start, retry, retryIntent: async () => { if (intent.current) await submit(intent.current) }, cancel: () => change(false), remove: () => change(true) }}>{children}</BacktestContext.Provider>
}
