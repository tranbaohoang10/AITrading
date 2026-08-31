import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ApiError, currentUser } from '../auth/api'
import { useAuth } from '../auth/AuthContext'
import * as market from '../market/api'
import * as api from './api'
import { JournalContext } from './JournalContext'

export function monthFilter(now = new Date()): api.Filter {
  const year = now.getUTCFullYear(), month = now.getUTCMonth()
  return { from: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10), to: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10), zone: 'UTC', currency: 'USD' }
}
function blank(currency: string): api.Input {
  return { symbol: '', timeframe: '1h', settlementCurrency: currency, side: 'LONG', state: 'OPEN', quantity: '', entryPrice: '', exitPrice: null, entryFee: '0', exitFee: '0', entryTime: '', exitTime: null, entryReason: '', notes: '', datasetId: null }
}
type Intent = { key: string | null; body: api.Write }
const definite = (error: unknown) => error instanceof ApiError && [400, 401, 403, 404, 409, 413, 422, 429].includes(error.status)
export function JournalProvider({ children }: { children: ReactNode }) {
  const auth = useAuth(), alive = useRef(true), mutation = useRef(false), intent = useRef<Intent | null>(null)
  const [filter, setFilter] = useState(monthFilter), filterRef = useRef(filter)
  const [report, setReport] = useState<api.Summary | null>(null), [items, setItems] = useState<api.Entry[]>([]), [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<api.Entry | null>(null), selectedRef = useRef<api.Entry | null>(null)
  const [draft, setDraft] = useState(() => blank(filter.currency)), draftRef = useRef(draft), dirtyRef = useRef(false), [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [reportLoading, setReportLoading] = useState(false), paging = useRef(false)
  const [uncertain, setUncertain] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [confirmation, setConfirmation] = useState(''), pending = useRef<(() => void) | null>(null)
  const [datasets, setDatasets] = useState<market.Dataset[]>([]), [chart, setChart] = useState<market.CandlePage | null>(null)
  const [chartLoading, setChartLoading] = useState(false), [chartError, setChartError] = useState(''), [chartWarning, setChartWarning] = useState('')
  const selectionEpoch = useRef(0), reportEpoch = useRef(0), chartEpoch = useRef(0), catalogEpoch = useRef(0)
  async function identity() { if (alive.current && auth) { const actual = await currentUser(); if (alive.current && actual.id !== auth.user.id) throw new ApiError(401) } }
  function message(failure: unknown) {
    if (failure instanceof ApiError && failure.status === 401) auth?.clear()
    return failure instanceof ApiError ? failure.message : 'Cannot verify the response. Keep your draft and retry safely.'
  }
  useEffect(() => {
    alive.current = true
    const warn = (event: BeforeUnloadEvent) => { if (dirtyRef.current || intent.current || mutation.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => { alive.current = false; ++selectionEpoch.current; ++reportEpoch.current; ++chartEpoch.current; ++catalogEpoch.current; window.removeEventListener('beforeunload', warn) }
  }, [])
  function resetChart() { ++chartEpoch.current; setChart(null); setChartError(''); setChartWarning(''); setChartLoading(false) }
  function adopt(entry: api.Entry | null) {
    selectedRef.current = entry; setSelected(entry);const value = entry ? { ...entry.data } : blank(filterRef.current.currency)
    draftRef.current = value; setDraft(value); dirtyRef.current = false; setDirty(false); resetChart()
  }
  function edit(field: keyof api.Input, value: string) {
    if (mutation.current || intent.current || loading || pending.current) return
    let next = { ...draftRef.current, [field]: ['datasetId', 'exitTime', 'exitPrice'].includes(field) && !value ? null : value } as api.Input
    if (field === 'state' && value === 'OPEN') next = { ...next, exitTime: null, exitPrice: null, exitFee: '0' }
    draftRef.current = next; setDraft(next); dirtyRef.current = true; setDirty(true); setNotice('')
  }
  function guard(action: () => void) {
    if (mutation.current || intent.current || pending.current) return
    if (dirtyRef.current) { pending.current = action; setConfirmation('Discard the unsaved journal draft?'); return }
    action()
  }
  async function loadChart(start?: number) {
    const entry = selectedRef.current, token = ++chartEpoch.current; setChart(null); setChartError(''); setChartWarning('')
    if (!entry?.data.datasetId) { setChartLoading(false); return }
    setChartLoading(true)
    try {
      const dataset = await market.getDataset(entry.data.datasetId)
      if (dataset.symbol !== entry.data.symbol || dataset.timeframe !== entry.data.timeframe) throw new Error('Mismatched source')
      const interval: Record<string, number> = { '1m': 60, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 }
      const time = Date.parse(entry.data.entryTime), outside = time < Date.parse(dataset.firstTime) || time >= Date.parse(dataset.lastTime) + interval[dataset.timeframe] * 1000
      // Gapped datasets are allowed. Center on actual candle timestamps, never assume
      // ordinal=(time-first)/interval across missing candles. The bounded account
      // dataset has <=5000 rows; scan only when locating the first entry window.
      let from = start
      if (from === undefined) {
        let nearest = 0
        for (let offset = 0; offset < dataset.candleCount; offset += 500) {
          const page = await market.candles(dataset, 500, offset)
          for (const candle of page.items) { if (Date.parse(candle.time) <= time) nearest = candle.ordinal }
          if (page.items.some(candle => Date.parse(candle.time) > time)) break
          if (!alive.current || token !== chartEpoch.current) return
        }
        from = Math.max(0, Math.min(Math.max(0, dataset.candleCount - 100), nearest - 50))
      }
      const page = await market.candles(dataset, 100, from); await identity()
      if (!alive.current || token !== chartEpoch.current) return
      setChart(page); setChartWarning(outside ? 'Entry time is outside this dataset. These candles do not verify the manual fill.' : 'Linked source is context only; manual times and prices are not verified fills.')
    } catch (failure) { if (alive.current && token === chartEpoch.current) setChartError(message(failure)) }
    finally { if (alive.current && token === chartEpoch.current) setChartLoading(false) }
  }
  async function readEntry(key: string) {
    const token = ++selectionEpoch.current; adopt(null); setLoading(true); setError(''); setNotice('')
    try { const entry = await api.get(key); await identity(); if (alive.current && token === selectionEpoch.current) { adopt(entry); void loadChart() } }
    catch (failure) { if (alive.current && token === selectionEpoch.current) setError(message(failure)) }
    finally { if (alive.current && token === selectionEpoch.current) setLoading(false) }
  }
  async function applyFilter(next: api.Filter, clearError = true) {
    const token = ++reportEpoch.current; filterRef.current = { ...next }; setFilter({ ...next }); setReport(null); setItems([]); setNextCursor(null); setReportLoading(true); if (clearError) setError(''); paging.current = false
    try {
      const [page, summary] = await Promise.all([api.list(next), api.summary(next)]); await identity()
      if (!alive.current || token !== reportEpoch.current) return
      setReport(summary); setItems(page.items); setNextCursor(page.nextCursor)
    } catch (failure) { if (alive.current && token === reportEpoch.current) setError(message(failure)) }
    finally { if (alive.current && token === reportEpoch.current) setReportLoading(false) }
  }
  async function more() {
    if (!nextCursor || paging.current || reportLoading) return
    const token = reportEpoch.current, cursor = nextCursor; paging.current = true; setReportLoading(true)
    try {
      const page = await api.list(filterRef.current, cursor); await identity()
      if (!alive.current || token !== reportEpoch.current) return
      setItems(previous => [...previous, ...page.items.filter(item => !previous.some(old => old.id === item.id))].slice(0, 500));setNextCursor(page.nextCursor)
    } catch (failure) { if (alive.current && token === reportEpoch.current) setError(message(failure)) }
    finally { if (alive.current && token === reportEpoch.current) { paging.current = false; setReportLoading(false) } }
  }
  async function catalog() {
    const token = ++catalogEpoch.current
    try {
      const rows: market.Dataset[] = []; let cursor: string | undefined
      for (let i = 0; i < 6; i++) { const page = await market.listDatasets(cursor); rows.push(...page.items); if (page.nextCursor === null) { cursor = undefined; break } cursor = page.nextCursor }
      if (cursor) throw new Error('Catalog limit'); await identity()
      if (alive.current && token === catalogEpoch.current) setDatasets(rows)
    } catch (failure) { if (alive.current && token === catalogEpoch.current) setError(message(failure)) }
  }
  async function load() { await Promise.all([applyFilter(filterRef.current), catalog()]) }
  async function submit(action: Intent) {
    if (mutation.current) return
    const wasUncertain = intent.current !== null; mutation.current = true; intent.current = action; setBusy(true); setUncertain(false); setError(''); setNotice('')
    ++selectionEpoch.current; ++reportEpoch.current; setReport(null); setItems([]); setNextCursor(null); setReportLoading(false); setLoading(false)
    let accepted = false, acknowledged = false
    try {
      const saved = await api.save(action.key, action.body, auth?.user.id ?? ''); acknowledged = true; await identity()
      if (!alive.current) return
      adopt(saved.entry); intent.current = null; setUncertain(false); accepted = true
      setNotice(`Saved request as v${saved.appliedVersion}. Showing current v${saved.entry.version}.`)
    } catch (failure) {
      if (!alive.current) return
      if (!wasUncertain && !acknowledged && definite(failure)) intent.current = null; else setUncertain(true)
      setError(message(failure))
    } finally { mutation.current = false; if (alive.current) setBusy(false) }
    if (accepted && alive.current) { void applyFilter(filterRef.current); void loadChart() }
  }
  async function save() {
    if (mutation.current || intent.current || loading || pending.current) return
    await submit({ key: selectedRef.current?.id ?? null, body: { requestId: crypto.randomUUID(), expectedVersion: selectedRef.current?.version ?? 0, entry: { ...draftRef.current } } })
  }
  async function remove() {
    const entry = selectedRef.current
    if (!entry || mutation.current || intent.current || pending.current) return
    pending.current = () => { void deleteConfirmed(entry) };setConfirmation('Delete this saved journal entry and any unsaved draft? This removes its private notes and request history.')
  }
  async function deleteConfirmed(entry: api.Entry) {
    mutation.current = true;setBusy(true);setError('');setNotice('');++selectionEpoch.current;++reportEpoch.current;setReport(null);setItems([]);setNextCursor(null);resetChart()
    try {
      await api.remove(entry, auth?.user.id ?? ''); await identity()
      if (alive.current) { adopt(null); setNotice('Journal entry deleted. Never reuse its old save request.') }
    } catch (failure) {
      if (alive.current) setError(message(failure))
      // A read resolves an uncertain delete without reissuing the mutation. Keep
      // the draft on conflict/network failure; never silently replace edits.
      if (!definite(failure)) {
        try { await api.get(entry.id); await identity() }
        catch (readFailure) {
          if (alive.current && readFailure instanceof ApiError && readFailure.status === 404) {
            try { await identity(); if (alive.current) { adopt(null); setNotice('Entry is no longer available. Deletion was verified by a read.');setError('') } }
            catch (identityFailure) { if (alive.current) setError(message(identityFailure)) }
          }
          else if (alive.current) setError(message(readFailure))
        }
      }
    } finally { mutation.current = false; if (alive.current) { setBusy(false); void applyFilter(filterRef.current, false) } }
  }
  return <JournalContext.Provider value={{ filter, report, items, nextCursor, selected, draft, dirty, busy, loading, reportLoading, uncertain, error, notice, confirmation, datasets, chart, chartLoading, chartError, chartWarning,
    edit, load, applyFilter, more, save, loadChart, remove,
    select: key => guard(() => { void readEntry(key) }), newEntry: () => guard(() => { ++selectionEpoch.current; setLoading(false); adopt(null);setError('');setNotice('') }),
    refresh: () => guard(() => { if (selectedRef.current) void readEntry(selectedRef.current.id); else adopt(null); void load() }),
    retry: async () => { if (intent.current && !mutation.current) await submit(intent.current) },
    confirm: () => { const action = pending.current; pending.current = null;setConfirmation('');action?.() }, cancel: () => { pending.current = null;setConfirmation('') },
  }}>{children}</JournalContext.Provider>
}
