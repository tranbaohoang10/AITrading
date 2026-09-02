import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { useConversations, type ChatState } from './ConversationContext'

const iconButton = 'grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-slate-300 disabled:opacity-35'
const menuButton = 'min-h-9 rounded-md border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white focus-visible:outline-2 focus-visible:outline-slate-300 disabled:opacity-40'

export function PersistentChat({ onGenerateFromImage }: { onGenerateFromImage?: () => void }) {
  const auth = useAuth()
  const chat = useConversations()
  const [historyOpen, setHistoryOpen] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const locked = chat.busy || chat.uncertain || chat.aiCancelling
  const displayName = auth?.user.displayName.trim().split(/\s+/)[0] || 'trader'
  const brainstorm = async () => {
    if (!chat.selected) await chat.create()
    chat.setDraft('Help me brainstorm a clear, testable trading strategy idea.')
  }

  return <section aria-label="AI Chat" data-testid="ai-chat" className="flex h-full min-h-0 flex-col bg-slate-925 text-slate-200">
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-800 px-2.5">
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-100">Quant Assistant</p><ProviderStatus chat={chat} /></div>
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
          <span className="block truncate text-xs font-medium">{item.title}</span><span className="block truncate text-[10px] text-slate-600">{item.lastMessage || 'Empty conversation'}</span>
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
    <form className="shrink-0 border-t border-slate-800 bg-slate-950/80 p-2.5" onSubmit={event => { event.preventDefault(); void chat.send() }}>
      <div className="flex items-end gap-2 rounded-xl border border-slate-700 bg-slate-900 p-1.5 focus-within:border-slate-500">
        <label htmlFor="strategy-prompt" className="sr-only">Research message</label>
        <textarea id="strategy-prompt" aria-label="Research message" placeholder={chat.selected ? 'Ask Quant about a strategy…' : 'Start a new chat to ask Quant…'} value={chat.draft} disabled={locked || !chat.selected} maxLength={4000} onChange={event => chat.setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (!event.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled) event.currentTarget.form?.requestSubmit() } }} rows={2} className="min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600" />
        <button type="submit" aria-label="Send to Quant" title="Send" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-950 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-white disabled:bg-slate-800 disabled:text-slate-600" disabled={!chat.selected || chat.busy || chat.aiChecking || chat.aiCancelling || chat.pendingAction === 'ai' || chat.pendingAction === 'create' || !chat.aiConfiguration?.configured || !chat.draft.trim() || chat.messagesLoading}><Icon name="send" className="h-4 w-4" /></button>
      </div>
      <div className="mt-1 flex min-h-5 items-center justify-between gap-2 px-1"><span className="text-[10px] text-slate-700">{chat.draft.length ? `${chat.draft.length}/4000` : 'Enter to send · Shift+Enter for a new line'}</span><ProviderDetails chat={chat} /></div>
    </form>

    <Modal open={confirmDelete} label="Delete conversation" onClose={() => { if (!chat.busy) setConfirmDelete(false) }}>
      <div className="m-auto max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-6 text-slate-200"><h3 className="font-semibold">Delete conversation?</h3><p className="my-4 break-words text-sm text-slate-400">Permanently delete “{chat.selected?.title}” and its messages. This cannot be undone.</p><div className="flex justify-end gap-2"><button className={menuButton} disabled={chat.busy} onClick={() => setConfirmDelete(false)}>Cancel</button><button className={`${menuButton} border-red-400/30 text-red-200 hover:bg-red-400/10`} disabled={chat.busy} onClick={() => void chat.remove().then(done => { if (done) setConfirmDelete(false) })}>Confirm delete</button></div>{chat.mutationError && <p role="alert" className="mt-3 text-xs text-red-300">{chat.mutationError}</p>}</div>
    </Modal>
  </section>
}

function Welcome({ name, onGenerateFromImage, onBrainstorm }: { name: string; onGenerateFromImage?: () => void; onBrainstorm?: () => void }) {
  return <div className="grid min-h-full place-items-center px-5 py-10 text-center"><div className="w-full max-w-xs"><div className="mx-auto grid h-9 w-9 place-items-center rounded-lg border border-slate-700 bg-slate-900 text-sm font-bold text-slate-200">Q</div><h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-100">Welcome back, {name}</h2><p className="mt-1 text-xs text-slate-500">Develop and review a trading idea.</p><div className="mt-5 grid gap-2"><button type="button" disabled={!onGenerateFromImage} onClick={onGenerateFromImage} className={menuButton}><span className="flex items-center justify-center gap-2"><Icon name="image" className="h-4 w-4" />Generate from Image</span></button><button type="button" disabled={!onBrainstorm} onClick={onBrainstorm} className={menuButton}><span className="flex items-center justify-center gap-2"><Icon name="spark" className="h-4 w-4" />Brainstorm Ideas</span></button></div></div></div>
}

function ProviderStatus({ chat }: { chat: ChatState }) {
  const provider = chat.aiConfiguration?.provider === 'gemini' ? 'Gemini' : chat.aiConfiguration?.provider === 'openai' ? 'OpenAI' : 'AI'
  const state = chat.aiChecking ? 'checking' : chat.aiConfiguration?.configured ? 'ready' : 'offline'
  return <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500"><span className={`h-1.5 w-1.5 rounded-full ${state === 'ready' ? 'bg-slate-400' : state === 'checking' ? 'animate-pulse bg-slate-600' : 'bg-red-400'}`} />{provider} · {state === 'ready' ? 'AI ready' : state === 'checking' ? 'Checking' : 'Offline'}</p>
}

function ProviderDetails({ chat }: { chat: ChatState }) {
  return <details className="relative"><summary aria-label="AI provider details" title="AI provider details" className="list-none cursor-pointer rounded p-1 text-slate-600 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-slate-300"><Icon name="info" className="h-3.5 w-3.5" /></summary><div className="absolute bottom-7 right-0 z-20 w-64 rounded-lg border border-slate-700 bg-slate-900 p-3 text-left text-[11px] leading-4 text-slate-400 shadow-2xl"><p className="font-semibold text-slate-200">{chat.aiConfiguration?.configured ? `${chat.aiConfiguration.provider === 'gemini' ? 'Gemini' : 'OpenAI'} · ${chat.aiConfiguration.model}` : 'AI provider offline'}</p><p className="mt-2">Up to 20 recent saved messages may be sent to the configured provider. Do not include secrets. No trades are executed.</p>{chat.aiConfiguration?.provider === 'gemini' && <p className="mt-2 text-amber-200">Use synthetic data only. Provider retention policies apply.</p>}</div></details>
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
