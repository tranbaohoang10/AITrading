import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../auth/api'
import * as api from './api'
import { MarketContext } from './MarketContext'

export function MarketProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [items, setItems] = useState<api.Dataset[]>([]), [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<api.Dataset | null>(null), selectedRef = useRef<api.Dataset | null>(null)
  const [page, setPage] = useState<api.CandlePage | null>(null), [window, updateWindow] = useState(100)
  const [listLoading, setListLoading] = useState(false), [pageLoading, setPageLoading] = useState(false)
  const [busy, setBusy] = useState(false), writing = useRef(false), [uncertain, setUncertain] = useState(false)
  const pending = useRef<api.ImportRequest | null>(null), lifetime = useRef(0), listEpoch = useRef(0), pageEpoch = useRef(0)
  const [listError, setListError] = useState(''), [pageError, setPageError] = useState(''), [mutationError, setMutationError] = useState(''), [notice, setNotice] = useState('')
  const errorText = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) auth?.clear()
    return error instanceof Error ? error.message : 'Unable to load market data.'
  }
  const fetchPage = async (item: api.Dataset, size: number, start?: number) => {
    const epoch = ++pageEpoch.current
    setPageLoading(true); setPageError(''); setPage(null)
    try {
      const result = await api.candles(item, size, start)
      if (epoch !== pageEpoch.current || selectedRef.current?.id !== item.id) return
      setPage(result)
    } catch (error) { if (epoch === pageEpoch.current) setPageError(errorText(error)) }
    finally { if (epoch === pageEpoch.current) setPageLoading(false) }
  }
  const choose = (item: api.Dataset) => { selectedRef.current = item; setSelected(item); void fetchPage(item, window) }
  const select = (item: api.Dataset) => { if (!writing.current && !pending.current) { setMutationError(''); setNotice(''); choose(item) } }
  const loadList = async (more = false) => {
    const epoch = ++listEpoch.current
    setListLoading(true); setListError('')
    try {
      const result = await api.listDatasets(more ? nextCursor ?? undefined : undefined)
      if (epoch !== listEpoch.current) return
      setItems(old => more ? [...old, ...result.items.filter(item => !old.some(other => other.id === item.id))] : result.items)
      setNextCursor(result.nextCursor)
      if (!selectedRef.current && result.items.length && !writing.current && !pending.current) choose(result.items[0])
    } catch (error) { if (epoch === listEpoch.current) setListError(errorText(error)) }
    finally { if (epoch === listEpoch.current) setListLoading(false) }
  }
  useEffect(() => {
    void loadList()
    return () => { lifetime.current++; listEpoch.current++; pageEpoch.current++ }
  }, [])
  const setWindow = (size: number) => {
    if (![50, 100, 200].includes(size) || writing.current || pending.current) return
    updateWindow(size); if (selectedRef.current) void fetchPage(selectedRef.current, size)
  }
  const loadPage = async (start?: number) => { if (selectedRef.current) await fetchPage(selectedRef.current, window, start) }
  const known = (error: unknown) => error instanceof ApiError && [400, 401, 403, 404, 409, 413, 422, 429].includes(error.status)
  const importData = async (draft?: api.ImportDraft) => {
    if (writing.current || (!pending.current && !draft)) return false
    if (!pending.current && draft) pending.current = { ...draft, requestId: crypto.randomUUID() }
    const payload = pending.current!
    const generation = lifetime.current
    writing.current = true; setBusy(true); setMutationError(''); setNotice(''); listEpoch.current++; setListLoading(false)
    try {
      const item = await api.importDataset(payload)
      if (generation !== lifetime.current) return false
      pending.current = null; setUncertain(false)
      setItems(old => [item, ...old.filter(other => other.id !== item.id)])
      setNotice('Dataset imported and saved.'); choose(item)
      return true
    } catch (error) {
      if (generation === lifetime.current) {
        if (known(error)) { pending.current = null; setUncertain(false) } else setUncertain(true)
        setMutationError(errorText(error))
      }
      return false
    } finally { if (generation === lifetime.current) { writing.current = false; setBusy(false) } }
  }
  const remove = async () => {
    const item = selectedRef.current
    if (!item || writing.current || pending.current) return false
    const generation = lifetime.current
    writing.current = true; setBusy(true); setMutationError(''); setNotice('')
    try {
      await api.deleteDataset(item)
      if (generation !== lifetime.current) return false
      pageEpoch.current++; listEpoch.current++; setPageLoading(false); setListLoading(false)
      selectedRef.current = null; setSelected(null); setPage(null); setPageError('')
      setItems(old => old.filter(other => other.id !== item.id)); setNotice('Dataset deleted.')
      return true
    } catch (error) { if (generation === lifetime.current) setMutationError(errorText(error)); return false }
    finally { if (generation === lifetime.current) { writing.current = false; setBusy(false) } }
  }
  return <MarketContext.Provider value={{ items, nextCursor, selected, page, window, busy, uncertain, listLoading, pageLoading, listError, pageError, mutationError, notice,
    select, loadList, loadPage, setWindow, importData, remove }}>{children}</MarketContext.Provider>
}
