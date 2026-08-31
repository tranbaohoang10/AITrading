import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../auth/api'
import * as api from './api'
import { StrategyContext } from './StrategyContext'

type Pending = { kind: 'create'; payload: { requestId: string; title: string } } | { kind: 'save'; id: string; payload: api.Save } | { kind: 'delete'; selected: api.Revision }
export function StrategyProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [items, setItems] = useState<api.Brief[]>([]), [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<api.Revision | null>(null), selectedRef = useRef<api.Revision | null>(null)
  const [title, setTitle] = useState(''), [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), writing = useRef(false), pending = useRef<Pending | null>(null)
  const [loading, setLoading] = useState(false), [listLoading, setListLoading] = useState(false), [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<api.Validation | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [versions, setVersions] = useState<api.Brief[]>([]), [nextBefore, setNextBefore] = useState<number | null>(null), [preview, setPreview] = useState<api.Revision | null>(null), [historyLoading, setHistoryLoading] = useState(false)
  const life = useRef(0), readEpoch = useRef(0), listEpoch = useRef(0), validationEpoch = useRef(0), historyEpoch = useRef(0), previewEpoch = useRef(0)
  const dirty = !!selected && (title !== selected.title || draft !== selected.draftText)
  const blocked = () => writing.current || pending.current !== null
  const errorText = (e: unknown) => { if (e instanceof ApiError && e.status === 401) auth?.clear(); return e instanceof Error ? e.message : 'Strategy service unavailable.' }
  const resetValidation = () => { validationEpoch.current++; setValidation(null); setValidating(false) }
  const apply = (value: api.Revision) => {
    readEpoch.current++; previewEpoch.current++; historyEpoch.current++; selectedRef.current = value; setSelected(value)
    setTitle(value.title); setDraft(value.draftText); setPreview(null); setVersions([]); setNextBefore(null); setLoading(false); resetValidation()
    setItems(old => {
      const previous = old.find(item => item.id === value.strategyId)
      const item: api.Brief = { id: value.strategyId, revision: value.revision, title: value.title, status: value.status, symbol: value.symbol, timeframe: value.timeframe, createdAt: previous?.createdAt ?? value.createdAt }
      return previous ? old.map(entry => entry.id === item.id ? item : entry) : [item, ...old]
    })
  }
  const edit = (field: 'title' | 'draft', value: string) => {
    if (blocked() || loading) return
    readEpoch.current++; resetValidation(); setNotice('')
    if (field === 'title') setTitle(value); else setDraft(value)
  }
  const replace = (nextTitle: string, nextDraft: string) => {
    if (blocked() || loading || !selectedRef.current) return
    readEpoch.current++; resetValidation(); setTitle(nextTitle); setDraft(nextDraft); setPreview(null); setNotice('Copied into editor; not saved.')
  }
  const loadHistory = async (more = false) => {
    const current = selectedRef.current
    if (!current) return
    const epoch = ++historyEpoch.current
    setHistoryLoading(true)
    try {
      const result = await api.history(current.strategyId, more ? nextBefore ?? undefined : undefined, auth?.user.id)
      if (epoch !== historyEpoch.current || current.strategyId !== selectedRef.current?.strategyId) return
      setVersions(old => more ? [...old, ...result.items.filter(item => !old.some(v => v.revision === item.revision))] : result.items); setNextBefore(result.nextBefore)
    } catch (e) { if (epoch === historyEpoch.current) setError(errorText(e)) }
    finally { if (epoch === historyEpoch.current) setHistoryLoading(false) }
  }
  const select = async (id: string) => {
    if (blocked()) return
    const epoch = ++readEpoch.current; resetValidation(); setLoading(true); setError(''); setNotice(''); previewEpoch.current++; setPreview(null)
    try {
      const result = await api.getRevision(id, undefined, auth?.user.id)
      if (epoch !== readEpoch.current) return
      apply(result); void loadHistory()
    } catch (e) { if (epoch === readEpoch.current) setError(errorText(e)) }
    finally { if (epoch === readEpoch.current) setLoading(false) }
  }
  const loadList = async (more = false) => {
    const epoch = ++listEpoch.current; setListLoading(true)
    try {
      const result = await api.listStrategies(more ? nextCursor ?? undefined : undefined, auth?.user.id)
      if (epoch !== listEpoch.current) return
      setItems(old => more ? [...old, ...result.items.filter(item => !old.some(v => v.id === item.id))] : result.items); setNextCursor(result.nextCursor)
      // Selection is explicit: a background list must never replace an editor.
    } catch (e) { if (epoch === listEpoch.current) setError(errorText(e)) }
    finally { if (epoch === listEpoch.current) setListLoading(false) }
  }
  useEffect(() => {
    void loadList()
    return () => { life.current++; readEpoch.current++; listEpoch.current++; validationEpoch.current++; historyEpoch.current++; previewEpoch.current++ }
  }, [])
  useEffect(() => {
    if (!dirty && !uncertain && !busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, uncertain, busy])
  const validate = async () => {
    if (blocked() || loading || !selectedRef.current) return
    const epoch = ++validationEpoch.current; setValidating(true); setValidation(null); setError('')
    try { const result = await api.validateDraft(draft, auth?.user.id); if (epoch === validationEpoch.current) setValidation(result) }
    catch (e) { if (epoch === validationEpoch.current) setError(errorText(e)) }
    finally { if (epoch === validationEpoch.current) setValidating(false) }
  }
  const inspect = async (version: number) => {
    const current = selectedRef.current
    if (!current || blocked()) return
    const epoch = ++previewEpoch.current; setPreview(null)
    try { const result = await api.getRevision(current.strategyId, version, auth?.user.id); if (epoch === previewEpoch.current && current.strategyId === selectedRef.current?.strategyId) setPreview(result) }
    catch (e) { if (epoch === previewEpoch.current) setError(errorText(e)) }
  }
  const execute = async (operation: Pending) => {
    if (writing.current) return false
    const previouslyUncertain = pending.current !== null
    writing.current = true; pending.current = operation; setBusy(true); setError(''); setNotice(''); resetValidation()
    readEpoch.current++; previewEpoch.current++; listEpoch.current++; setListLoading(false); setLoading(false)
    const generation = life.current
    try {
      const saved = operation.kind === 'create' ? await api.createStrategy(operation.payload, auth?.user.id) : operation.kind === 'save' ? await api.saveRevision(operation.id, operation.payload, auth?.user.id) : await api.deleteStrategy(operation.selected, auth?.user.id)
      if (generation !== life.current) return false
      pending.current = null; setUncertain(false)
      if (saved) {
        apply(saved)
        void loadHistory(); setNotice(`Saved revision ${saved.revision} · ${saved.status}.`)
      } else {
        historyEpoch.current++; setHistoryLoading(false); selectedRef.current = null; setSelected(null); setTitle(''); setDraft(''); setPreview(null); setVersions([]); setNextBefore(null)
        if (operation.kind === 'delete') setItems(old => old.filter(item => item.id !== operation.selected.strategyId))
        setNotice('Strategy deleted. Datasets and conversations were not deleted.')
      }
      return true
    } catch (e) {
      if (generation !== life.current) return false
      if (!previouslyUncertain && e instanceof ApiError && [400, 401, 403, 404, 409, 413, 422, 429].includes(e.status)) { pending.current = null; setUncertain(false) } else setUncertain(true)
      if (e instanceof api.ValidationError) setValidation(e.validation)
      setError(errorText(e)); return false
    } finally { if (generation === life.current) { writing.current = false; setBusy(false) } }
  }
  const create = async (name: string) => blocked() ? false : execute({ kind: 'create', payload: { requestId: crypto.randomUUID(), title: name } })
  const save = async (mode: api.Status) => {
    if (blocked() || loading || !selectedRef.current) return false
    if (new TextEncoder().encode(draft).length > 65536) { setError('Draft must be at most 64 KiB in UTF-8.'); return false }
    return execute({ kind: 'save', id: selectedRef.current.strategyId, payload: { requestId: crypto.randomUUID(), expectedRevision: selectedRef.current.revision, title, draftText: draft, mode } })
  }
  const remove = async () => blocked() || !selectedRef.current ? false : execute({ kind: 'delete', selected: selectedRef.current })
  const retry = async () => pending.current ? execute(pending.current) : false
  return <StrategyContext.Provider value={{ items, nextCursor, selected, title, draft, dirty, busy, loading, listLoading, validating, uncertain, error, notice, validation, versions, nextBefore, preview, historyLoading,
    edit, replace, select, loadList, loadHistory, inspect, closePreview: () => { previewEpoch.current++; setPreview(null) }, validate, create, save, retry, remove }}>{children}</StrategyContext.Provider>
}
