import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../auth/api'
import * as api from './api'
import * as ai from './aiApi'
import { ConversationContext } from './ConversationContext'

export function ConversationProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [items, setItems] = useState<api.Conversation[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<api.Conversation | null>(null)
  const selectedRef = useRef<api.Conversation | null>(null)
  const [messages, setMessages] = useState<api.Message[]>([])
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [draft, updateDraft] = useState('')
  const drafts = useRef(new Map<string, string>())
  const [listLoading, setListLoading] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const writing = useRef(false)
  const [uncertain, setUncertain] = useState(false)
  const pendingCreate = useRef<string | null>(null)
  const pendingSave = useRef<{ conversationId: string; requestId: string; content: string } | null>(null)
  const pendingAi = useRef<ai.AiIntent | null>(null)
  const [aiConfiguration, setAiConfiguration] = useState<ai.AiConfiguration | null>(null)
  const [aiChecking, setAiChecking] = useState(false), [aiCancelling, setAiCancelling] = useState(false)
  const [aiError, setAiError] = useState(''), [aiTurn, setAiTurn] = useState<ai.AiTurn | null>(null)
  const aiEpoch = useRef(0), aiConfigEpoch = useRef(0), cancellingAi = useRef(false)
  const [listError, setListError] = useState('')
  const [messageError, setMessageError] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [notice, setNotice] = useState('')
  const listEpoch = useRef(0), messageEpoch = useRef(0), lifetime = useRef(0)
  const errorText = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) auth?.clear()
    return error instanceof Error ? error.message : 'Unable to load conversations.'
  }
  const updateSelected = (item: api.Conversation) => {
    selectedRef.current = item; setSelected(item)
    setItems(previous => previous.map(value => value.id === item.id ? item : value))
  }
  const fetchMessages = async (item: api.Conversation, before?: number) => {
    const epoch = ++messageEpoch.current
    setMessagesLoading(true); setMessageError('')
    try {
      const page = await api.getMessages(item.id, before, auth?.user.id)
      if (epoch !== messageEpoch.current || selectedRef.current?.id !== item.id) return
      updateSelected(page.conversation)
      setMessages(previous => before ? [...page.items, ...previous.filter(value => !page.items.some(p => p.sequence === value.sequence))] : page.items)
      setNextBefore(page.nextBefore)
    } catch (error) { if (epoch === messageEpoch.current) setMessageError(errorText(error)) }
    finally { if (epoch === messageEpoch.current) setMessagesLoading(false) }
  }
  const select = (item: api.Conversation) => {
    if (writing.current || pendingSave.current || pendingCreate.current || pendingAi.current || cancellingAi.current) return
    if (selectedRef.current) drafts.current.set(selectedRef.current.id, draft)
    selectedRef.current = item; setSelected(item); setMessages([]); setNextBefore(null)
    updateDraft(drafts.current.get(item.id) ?? ''); setMutationError(''); setNotice(''); setAiError(''); setAiTurn(null); aiEpoch.current++
    void fetchMessages(item)
  }
  const loadList = async (more = false) => {
    const epoch = ++listEpoch.current
    setListLoading(true); setListError('')
    try {
      const page = await api.listConversations(more ? nextCursor ?? undefined : undefined, auth?.user.id)
      if (epoch !== listEpoch.current) return
      setItems(previous => more ? [...previous, ...page.items.filter(item => !previous.some(p => p.id === item.id))] : page.items)
      setNextCursor(page.nextCursor)
    } catch (error) { if (epoch === listEpoch.current) setListError(errorText(error)) }
    finally { if (epoch === listEpoch.current) setListLoading(false) }
  }
  useEffect(() => {
    void loadList()
    return () => { listEpoch.current++; messageEpoch.current++; lifetime.current++; aiEpoch.current++; aiConfigEpoch.current++ }
    // User-specific provider is remounted by AuthenticatedApp; no state crosses identities.
  }, [])
  const begin = (forAi = false) => {
    if (writing.current || cancellingAi.current || (pendingAi.current && !forAi)) return false
    writing.current = true; setBusy(true); setMutationError(''); setNotice(''); return true
  }
  const end = () => { writing.current = false; setBusy(false) }
  const knownRejection = (error: unknown) => error instanceof ApiError && [400,401,403,404,409,413,429].includes(error.status)
  const create = async () => {
    if (pendingSave.current || !begin()) return
    if (selectedRef.current) drafts.current.set(selectedRef.current.id, draft)
    const generation = lifetime.current
    const previouslyUncertain = pendingCreate.current !== null
    pendingCreate.current ??= crypto.randomUUID()
    try {
      const item = await api.createConversation(pendingCreate.current, auth?.user.id)
      if (generation !== lifetime.current) return
      pendingCreate.current = null; setUncertain(false)
      setAiError(''); setAiTurn(null); aiEpoch.current++
      selectedRef.current = item; setSelected(item); setMessages([]); setNextBefore(null); updateDraft('')
      messageEpoch.current++; setMessagesLoading(false); setMessageError('')
      await loadList(); setNotice('Conversation created.')
    } catch (error) {
      if (generation !== lifetime.current) return
      if (knownRejection(error) && !previouslyUncertain) pendingCreate.current = null
      setUncertain(pendingCreate.current !== null); setMutationError(errorText(error))
    } finally { if (generation === lifetime.current) end() }
  }
  const save = async () => {
    const item = selectedRef.current
    if (!item || pendingCreate.current || !draft.trim() || !begin()) return
    const generation = lifetime.current
    const previouslyUncertain = pendingSave.current !== null
    pendingSave.current ??= { conversationId: item.id, requestId: crypto.randomUUID(), content: draft.trim() }
    try {
      const pending = pendingSave.current
      await api.saveMessage(pending.conversationId, pending.requestId, pending.content, auth?.user.id)
      if (generation !== lifetime.current) return
      pendingSave.current = null; setUncertain(false); updateDraft(''); drafts.current.delete(item.id)
      setNotice('Message saved. Ask AI separately to share this conversation context with the configured provider.')
      await fetchMessages(item)
    } catch (error) {
      if (generation !== lifetime.current) return
      if (knownRejection(error) && !previouslyUncertain) pendingSave.current = null
      setUncertain(pendingSave.current !== null); setMutationError(errorText(error))
    } finally { if (generation === lifetime.current) end() }
  }
  const rename = async (title: string) => {
    const item = selectedRef.current
    if (!item || pendingSave.current || pendingCreate.current || !begin()) return
    const generation = lifetime.current
    try {
      const renamed = await api.renameConversation(item, title, auth?.user.id)
      if (generation === lifetime.current) { updateSelected(renamed); setNotice('Conversation renamed.') }
    } catch (error) { if (generation === lifetime.current) setMutationError(errorText(error)) }
    finally { if (generation === lifetime.current) end() }
  }
  const remove = async () => {
    const item = selectedRef.current
    if (!item || pendingSave.current || pendingCreate.current || !begin()) return false
    const generation = lifetime.current
    try {
      await api.deleteConversation(item, auth?.user.id)
      if (generation !== lifetime.current) return false
      selectedRef.current = null; setSelected(null); setMessages([]); setNextBefore(null)
      setAiError(''); setAiTurn(null); aiEpoch.current++
      messageEpoch.current++; setMessagesLoading(false); setMessageError('')
      drafts.current.delete(item.id); updateDraft(''); setItems(previous => previous.filter(value => value.id !== item.id))
      await loadList(); setNotice('Conversation deleted.'); return true
    } catch (error) { if (generation === lifetime.current) setMutationError(errorText(error)); return false }
    finally { if (generation === lifetime.current) end() }
  }
  const checkAiConfiguration = async () => {
    const generation = lifetime.current, epoch = ++aiConfigEpoch.current, item = selectedRef.current
    setAiChecking(true); setAiError('')
    try {
      const config = await ai.getAiConfiguration(auth?.user.id)
      const latest = item ? await ai.getLatestAiTurn(item.id, auth?.user.id) : null
      if (generation !== lifetime.current || epoch !== aiConfigEpoch.current) return
      setAiConfiguration(config)
      if (item && selectedRef.current?.id === item.id && !writing.current && !pendingSave.current && !pendingCreate.current) {
        setAiTurn(latest)
        if (latest?.state === 'PENDING') {
          pendingAi.current = { conversationId: latest.conversationId, requestId: latest.requestId, expectedVersion: latest.expectedVersion, sourceSequence: latest.sourceSequence }
          setUncertain(true)
        }
      }
    }
    catch (error) { if (generation === lifetime.current && epoch === aiConfigEpoch.current) { setAiConfiguration(null); setAiError(errorText(error)) } }
    finally { if (generation === lifetime.current && epoch === aiConfigEpoch.current) setAiChecking(false) }
  }
  const applyAi = async (result: ai.AiTurn, item: api.Conversation, generation: number, epoch: number) => {
    if (generation !== lifetime.current || epoch !== aiEpoch.current || selectedRef.current?.id !== item.id) return
    setAiTurn(result)
    if (result.state === 'PENDING') { setUncertain(true); return }
    pendingAi.current = null; setUncertain(false)
    if (result.state === 'SUCCEEDED') { setNotice('AI reply saved to this conversation.'); setAiError('') }
    else setAiError(ai.aiFailure(result.errorCode))
    await fetchMessages(item)
  }
  const aiOperation = async (statusOnly = false) => {
    const item = selectedRef.current, original = pendingAi.current
    const latest = messages.at(-1)
    if (!item || aiChecking || pendingSave.current || pendingCreate.current || (!original && (statusOnly || !aiConfiguration?.configured || draft.trim() || messagesLoading || messageError || !latest || latest.role !== 'user')) || !begin(true)) return
    const generation = lifetime.current, epoch = ++aiEpoch.current
    pendingAi.current ??= { conversationId: item.id, requestId: crypto.randomUUID(), expectedVersion: item.version, sourceSequence: latest!.sequence }
    const intent = pendingAi.current
    setUncertain(true); setAiError(''); if (!original) setAiTurn(null)
    try { await applyAi(await (statusOnly ? ai.getAiTurn(intent, auth?.user.id) : ai.startAi(intent, auth?.user.id)), item, generation, epoch) }
    catch (error) {
      if (generation !== lifetime.current || epoch !== aiEpoch.current) return
      if (!original && (knownRejection(error) || error instanceof ai.AiUnconfigured)) { pendingAi.current = null; setUncertain(false) }
      if (error instanceof ai.AiUnconfigured) setAiConfiguration(previous => ({ configured: false, provider: previous?.provider ?? null, model: null }))
      setAiError(errorText(error))
    } finally { if (generation === lifetime.current && epoch === aiEpoch.current) end() }
  }
  const cancelAi = async () => {
    const intent = pendingAi.current, item = selectedRef.current
    if (!intent || !item || cancellingAi.current) return
    const generation = lifetime.current
    cancellingAi.current = true; setAiCancelling(true)
    try {
      const result = await ai.cancelAiTurn(intent, auth?.user.id)
      if (generation !== lifetime.current || selectedRef.current?.id !== item.id) return
      const epoch = ++aiEpoch.current
      await applyAi(result, item, generation, epoch)
      if (generation === lifetime.current && epoch === aiEpoch.current) end()
    } catch (error) { if (generation === lifetime.current) setAiError(errorText(error)) }
    finally { if (generation === lifetime.current) { cancellingAi.current = false; setAiCancelling(false) } }
  }
  return <ConversationContext.Provider value={{ items, nextCursor, selected, messages, nextBefore, draft, listLoading, messagesLoading, busy, uncertain,
    pendingAction: uncertain ? pendingAi.current ? 'ai' : pendingCreate.current ? 'create' : 'save' : null,
    aiConfiguration, aiChecking, aiCancelling, aiError, aiTurn, checkAiConfiguration, askAi: () => aiOperation(), checkAiStatus: () => aiOperation(true), cancelAi,
    listError, messageError, mutationError, notice, select, loadList,
    setDraft: value => { if (!writing.current && !pendingSave.current && !pendingCreate.current && !pendingAi.current && !cancellingAi.current) updateDraft(value) },
    loadMessages: async (earlier = false) => { if (selectedRef.current) await fetchMessages(selectedRef.current, earlier ? nextBefore ?? undefined : undefined) },
    create, save, rename, remove }}>{children}</ConversationContext.Provider>
}
