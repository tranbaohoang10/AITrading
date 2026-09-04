import { useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { useConversations, type ChatState } from './ConversationContext'

const iconButton = 'grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-35'
const menuButton = 'min-h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-slate-300 disabled:opacity-40'

export function PersistentChat({ onGenerateFromImage }: { onGenerateFromImage?: () => void }) {
  const auth = useAuth()
  const chat = useConversations()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const composer = useRef<HTMLTextAreaElement>(null)
  const locked = chat.busy || chat.uncertain || chat.aiCancelling
  const displayName = auth?.user.displayName.trim().split(/\s+/)[0] || 'trader'
  const brainstorm = async () => {
    if (!chat.selected) await chat.create()
    chat.setDraft('Help me brainstorm a clear, testable trading strategy idea.')
  }
  const submit = async () => {
    if (!chat.selected) await chat.create()
    await chat.send()
  }
  useLayoutEffect(() => {
    const input = composer.current
    if (!input) return
    input.style.height = '36px'
    input.style.height = `${Math.min(112, Math.max(36, input.scrollHeight))}px`
    input.style.overflowY = input.scrollHeight > 112 ? 'auto' : 'hidden'
  }, [chat.draft])

  return <section aria-label="AI Chat" data-testid="ai-chat" className="chat-panel flex h-full min-h-0 flex-col bg-slate-925 text-slate-200">
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-800 px-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-slate-800 bg-slate-900 text-[10px] font-bold text-slate-300">Q</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-100">Assistant</p><ProviderStatus chat={chat} /></div></div>
      <button type="button" aria-label="Conversation history" title="Conversation history" aria-pressed={historyOpen} className={iconButton} onClick={() => setHistoryOpen(value => !value)}><Icon name="history" className="h-4 w-4" /></button>
      <button type="button" aria-label={chat.pendingAction === 'create' ? 'Retry new chat' : 'New chat'} title="New chat" className={iconButton} disabled={chat.busy || chat.aiCancelling || (chat.uncertain && chat.pendingAction !== 'create')} onClick={() => void chat.create()}><Icon name="plus" className="h-4 w-4" /></button>
      {chat.selected && <ConversationMenu key={`${chat.selected.id}:${chat.selected.title}`} chat={chat} onDelete={() => setConfirmDelete(true)} />}
    </header>

    {historyOpen && <section className="shrink-0 border-b border-slate-800 bg-slate-950/45 px-2 py-2" aria-label="Conversation history panel">
      {chat.listLoading && <p role="status" className="px-2 py-1 text-xs text-slate-500">Loading history…</p>}
      {chat.listError && <div className="flex items-center justify-between gap-2 px-2 py-1"><p role="alert" className="truncate text-xs text-red-300">{chat.listError}</p><button className={menuButton} onClick={() => void chat.loadList()}>Retry</button></div>}
      {!chat.listLoading && !chat.listError && !chat.items.length && <p className="px-2 py-1 text-xs text-slate-600">No conversations</p>}
      <nav aria-label="Saved conversations" className="max-h-32 space-y-0.5 overflow-y-auto">
        {chat.items.map(item => <button key={item.id} disabled={locked} aria-current={chat.selected?.id === item.id ? 'page' : undefined} onClick={() => chat.select(item)} className={`block min-h-9 w-full rounded-md px-2.5 py-1.5 text-left transition focus-visible:outline-2 focus-visible:outline-slate-300 ${chat.selected?.id === item.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}>
          <span className="block truncate text-[11px] font-medium text-slate-300">{item.title}</span><span className="block truncate text-[10px] font-medium text-slate-600">{item.lastMessage || 'Empty conversation'}</span>
        </button>)}
      </nav>
      {chat.nextCursor && <button className="mt-1 min-h-8 w-full rounded-md text-xs text-slate-500 hover:bg-slate-900 hover:text-slate-200" disabled={locked || chat.listLoading} onClick={() => void chat.loadList(true)}>Load more</button>}
    </section>}

    <div className="min-h-0 flex-1 overflow-y-auto" aria-label="Conversation messages">
      {chat.selected ? <>
        {chat.messagesLoading && <p role="status" className="p-4 text-xs text-slate-500">Loading messages…</p>}
        {chat.messageError && <div className="m-3 flex items-center justify-between gap-3 rounded-md border border-red-400/20 bg-red-400/5 p-3"><p role="alert" className="text-xs text-red-200">{chat.messageError}</p><button className={menuButton} disabled={locked} onClick={() => void chat.loadMessages()}>Retry</button></div>}
        {chat.nextBefore && <button className="mx-3 mt-3 min-h-8 rounded-md px-3 text-xs text-slate-500 hover:bg-slate-900 hover:text-slate-200" disabled={locked || chat.messagesLoading} onClick={() => void chat.loadMessages(true)}>Load earlier</button>}
        {!chat.messages.length && !chat.messagesLoading && !chat.messageError && <Welcome name={displayName} onGenerateFromImage={onGenerateFromImage} onBrainstorm={() => void brainstorm()} />}
        <div className="space-y-3 px-3 py-4">{chat.messages.map(message => <article key={message.sequence} className={`max-w-[92%] px-3 py-2.5 text-sm leading-5 ${message.role === 'user' ? 'ml-auto rounded-xl rounded-br-sm bg-slate-200 text-slate-950' : 'rounded-xl rounded-bl-sm border border-slate-800 bg-slate-900 text-slate-200'}`}><p className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${message.role === 'user' ? 'text-slate-600' : 'text-slate-500'}`}>{message.role === 'user' ? 'You' : 'Quant'}</p><p className="whitespace-pre-wrap break-words">{message.content}</p></article>)}</div>
      </> : <Welcome name={displayName} onGenerateFromImage={onGenerateFromImage} onBrainstorm={() => void brainstorm()} />}
    </div>

    <ChatFeedback chat={chat} />
    <form className="shrink-0 border-t border-slate-800 bg-slate-950/90 p-2.5" onSubmit={event => { event.preventDefault(); void submit() }}>
      <div aria-label="Chat composer" data-testid="chat-composer" className="chat-composer">
         <label htmlFor="strategy-prompt" className="sr-only">Research message</label>
         <textarea ref={composer} id="strategy-prompt" aria-label="Research message" placeholder="Ask Quant about a strategy…" value={chat.draft} disabled={locked} maxLength={4000} onChange={event => { chat.setDraft(event.target.value); event.target.style.height = '36px'; event.target.style.height = Math.min(120, event.target.scrollHeight) + 'px' }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (!event.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled) event.currentTarget.form?.requestSubmit() } }} rows={1} className="chat-composer-input" style={{ height: '36px' }} />
        <div data-testid="chat-composer-actions" className="chat-composer-actions">
          <div className="flex min-w-0 items-center gap-1">
            <button type="button" disabled aria-label="Add chat context unavailable" title="Add chat context is not available yet" className="chat-composer-round-action focus-visible:ring-2 focus-visible:ring-slate-300"><Icon name="plus" className="h-4 w-4" /></button>
            <ProviderDetails chat={chat} />
          </div>
          <div className="flex items-center gap-1">
            <button type="button" disabled aria-label="Voice input" title="Voice input is not available yet" className="chat-composer-round-action focus-visible:ring-2 focus-visible:ring-slate-300"><Icon name="microphone" className="h-4 w-4" /></button>
            <button type="submit" aria-label="Send to Quant" title="Send to Quant" className="chat-composer-send focus-visible:ring-2 focus-visible:ring-white" disabled={chat.busy || chat.aiChecking || chat.aiCancelling || chat.pendingAction === 'ai' || chat.pendingAction === 'create' || !chat.aiConfiguration?.configured || !chat.draft.trim() || chat.messagesLoading}><Icon name="send" className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </form>

    <Modal open={confirmDelete} label="Delete conversation" onClose={() => { if (!chat.busy) setConfirmDelete(false) }}>
      <div className="m-auto max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-6 text-slate-200"><h3 className="font-semibold">Delete conversation?</h3><p className="my-4 break-words text-sm text-slate-400">Permanently delete “{chat.selected?.title}” and its messages. This cannot be undone.</p><div className="flex justify-end gap-2"><button className={menuButton} disabled={chat.busy} onClick={() => setConfirmDelete(false)}>Cancel</button><button className={`${menuButton} border-red-400/30 text-red-200 hover:bg-red-400/10`} disabled={chat.busy} onClick={() => void chat.remove().then(done => { if (done) setConfirmDelete(false) })}>Confirm delete</button></div>{chat.mutationError && <p role="alert" className="mt-3 text-xs text-red-300">{chat.mutationError}</p>}</div>
    </Modal>
  </section>
}

function Welcome({ name, onGenerateFromImage, onBrainstorm }: { name: string; onGenerateFromImage?: () => void; onBrainstorm?: () => void }) {
  return <div className="grid min-h-full place-items-center px-4 py-8 text-center"><div className="w-full max-w-sm"><div className="mx-auto grid h-8 w-8 place-items-center rounded-lg border border-slate-700 bg-slate-900 text-xs font-bold text-slate-200">Q</div><h2 className="mt-3 text-base font-semibold tracking-tight text-slate-100">Welcome back, {name}</h2><p className="mt-1 text-[11px] text-slate-500">Turn a market idea into clear rules.</p><div className="chat-welcome-actions mt-4 grid gap-2"><button type="button" disabled={!onGenerateFromImage} onClick={onGenerateFromImage} className={`${menuButton} px-2 text-[10px]`}><span className="flex items-center justify-center gap-1.5 whitespace-nowrap"><Icon name="image" className="h-3.5 w-3.5" />Generate from Image</span></button><button type="button" disabled={!onBrainstorm} onClick={onBrainstorm} className={`${menuButton} px-2 text-[10px]`}><span className="flex items-center justify-center gap-1.5 whitespace-nowrap"><Icon name="spark" className="h-3.5 w-3.5" />Brainstorm Ideas</span></button></div></div></div>
}

function ProviderStatus({ chat }: { chat: ChatState }) {
  const provider = chat.aiConfiguration?.provider === 'gemini' ? 'Gemini' : chat.aiConfiguration?.provider === 'openai' ? 'OpenAI' : 'AI'
  const state = chat.aiChecking ? 'checking' : chat.aiConfiguration?.configured ? 'ready' : 'offline'
  return <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${state === 'ready' ? 'bg-slate-400' : state === 'checking' ? 'animate-pulse bg-slate-600' : 'bg-red-400'}`} />{provider} · {state === 'ready' ? 'AI ready' : state === 'checking' ? 'Checking' : 'Offline'}</p>
}

function ProviderDetails({ chat }: { chat: ChatState }) {
  const provider = chat.aiConfiguration?.provider === 'gemini' ? 'Gemini' : chat.aiConfiguration?.provider === 'openai' ? 'OpenAI' : 'AI'
  return <details className="relative min-w-0"><summary aria-label="AI provider details" title="AI provider details" className="chat-composer-model"><span className="truncate">{chat.aiConfiguration?.configured ? `${provider} AI` : 'AI offline'}</span><Icon name="chevron" className="h-3.5 w-3.5 shrink-0" /></summary><div className="absolute bottom-9 left-0 z-20 w-64 rounded-lg border border-slate-700 bg-slate-900 p-3 text-left text-[11px] leading-4 text-slate-400 shadow-2xl"><p className="font-semibold text-slate-200">{chat.aiConfiguration?.configured ? `${provider} · ${chat.aiConfiguration.model}` : 'AI provider offline'}</p><p className="mt-2">Up to 20 recent saved messages may be sent to the configured provider. Do not include secrets. No trades are executed.</p>{chat.aiConfiguration?.provider === 'gemini' && <p className="mt-2 text-amber-200">Use synthetic data only. Provider retention policies apply.</p>}</div></details>
}

function ConversationMenu({ chat, onDelete }: { chat: ChatState; onDelete: () => void }) {
  const [title, setTitle] = useState(chat.selected?.title ?? '')
  const locked = chat.busy || chat.uncertain || chat.aiCancelling
  return <details className="relative"><summary aria-label="Conversation menu" title="Conversation menu" className={`${iconButton} list-none cursor-pointer`}><Icon name="more" className="h-4 w-4" /></summary><div className="absolute right-0 top-9 z-30 w-64 rounded-lg border border-slate-700 bg-slate-900 p-2 shadow-2xl"><form onSubmit={event => { event.preventDefault(); void chat.rename(title) }}><label className="sr-only" htmlFor="conversation-title">Conversation title</label><input id="conversation-title" aria-label="Conversation title" value={title} onChange={event => setTitle(event.target.value)} disabled={locked} maxLength={120} required className="min-h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-slate-500" /><button type="submit" className="mt-2 min-h-9 w-full rounded-md px-2 text-left text-xs text-slate-300 hover:bg-slate-800" disabled={locked || chat.messagesLoading}>Rename conversation</button><button type="button" className="min-h-9 w-full rounded-md px-2 text-left text-xs text-red-300 hover:bg-red-400/10" disabled={locked || chat.messagesLoading} onClick={onDelete}>Delete conversation</button></form></div></details>
}

function ChatFeedback({ chat }: { chat: ChatState }) {
  const aiPending = chat.pendingAction === 'ai'
  const savePending = chat.pendingAction === 'save'
  const configurationFailed = !chat.aiConfiguration && !!chat.aiError && !aiPending
  if (!chat.mutationError && !chat.aiError && !chat.notice && !aiPending) return null
  return <div className="shrink-0 border-t border-slate-800 px-3 py-2 text-xs">
    {chat.busy && aiPending && <p role="status" className="text-slate-400">Quant is thinking…</p>}
    {chat.mutationError && <div className="flex items-center justify-between gap-2"><p role="alert" className="text-red-300">{chat.mutationError}</p>{savePending && <button className={menuButton} onClick={() => void chat.send()}>Retry</button>}</div>}
    {chat.aiError && <div className="flex items-center justify-between gap-2"><p role="alert" className="text-red-300">{chat.aiError}</p><button className={menuButton} disabled={chat.busy || chat.aiCancelling} onClick={() => void (configurationFailed ? chat.checkAiConfiguration() : chat.askAi())}>Retry</button></div>}
    {aiPending && <div className="mt-2 flex flex-wrap gap-2">{!chat.busy && <button className={menuButton} disabled={chat.aiCancelling} onClick={() => void chat.checkAiStatus()}>Check status</button>}<button className={menuButton} disabled={chat.aiCancelling} onClick={() => void chat.cancelAi()}>{chat.aiCancelling ? 'Cancelling…' : 'Cancel request'}</button></div>}
    {chat.notice && !chat.aiError && <p role="status" className="text-slate-500">{chat.notice}</p>}
  </div>
}
