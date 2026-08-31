import { useState } from 'react'
import { useConversations, type ChatState } from './ConversationContext'
import { Modal } from '../components/Modal'

const control = 'min-h-10 rounded-sm border border-slate-700 px-3 text-xs text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-40'
export function PersistentChat() {
  const chat = useConversations()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const locked = chat.busy || chat.uncertain || chat.aiCancelling
  return <section aria-label="AI Chat" data-testid="ai-chat" className="flex h-full min-h-0 flex-col bg-slate-900 text-slate-200">
    <header className="shrink-0 border-b border-slate-800 px-4 py-3">
      <h2 className="text-sm font-semibold">Quant / Research conversations</h2>
      <p className="mt-1 text-xs text-slate-400">Private saved messages · AI requests are always explicit</p>
      <div className="mt-3 flex gap-2"><button className={control} disabled={chat.busy || chat.aiCancelling || (chat.uncertain && chat.pendingAction !== 'create')} onClick={() => void chat.create()}>{chat.pendingAction === 'create' ? 'Retry New Chat' : 'New Chat'}</button><button className={control} disabled={locked || chat.listLoading} onClick={() => void chat.loadList()}>Refresh list</button></div>
      {chat.listLoading && <p role="status" className="mt-2 text-xs">Loading conversations…</p>}
      {chat.listError && <p role="alert" className="mt-2 text-xs text-red-300">{chat.listError}</p>}
      {!chat.listLoading && !chat.listError && !chat.items.length && <p className="mt-2 text-xs text-slate-400">No conversations yet. Start a New Chat.</p>}
      <nav aria-label="Saved conversations" className="mt-2 max-h-32 space-y-1 overflow-y-auto">
        {chat.items.map(item => <button key={item.id} disabled={locked} aria-current={chat.selected?.id === item.id ? 'page' : undefined} onClick={() => chat.select(item)} className={`block min-h-12 w-full border-l-2 px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-sky-400 ${chat.selected?.id === item.id ? 'border-slate-300 bg-slate-800' : 'border-transparent hover:bg-slate-800/60'}`}>
          <span className="block truncate text-xs font-medium">{item.title}</span><span className="block truncate text-xs text-slate-400">{item.lastMessage || 'No messages'}</span><time dateTime={item.updatedAt} className="block text-[10px] text-slate-500">{new Date(item.updatedAt).toLocaleString()}</time>
        </button>)}
      </nav>
      {chat.nextCursor && <button className={`${control} mt-2`} disabled={locked || chat.listLoading} onClick={() => void chat.loadList(true)}>Load more conversations</button>}
    </header>
    {chat.selected ? <>
      <TitleEditor key={`${chat.selected.id}:${chat.selected.title}`} chat={chat} onDelete={() => setConfirmDelete(true)} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-label="Conversation messages">
        {chat.messagesLoading && <p role="status" className="text-xs">Loading messages…</p>}
        {chat.messageError && <p role="alert" className="text-xs text-red-300">{chat.messageError}</p>}
        <button className={`${control} mb-3`} disabled={locked || chat.messagesLoading} onClick={() => void chat.loadMessages()}>Reload messages</button>
        {chat.nextBefore && <button className={`${control} mb-3 ml-2`} disabled={locked || chat.messagesLoading} onClick={() => void chat.loadMessages(true)}>Load earlier messages</button>}
        {!chat.messages.length && !chat.messagesLoading && !chat.messageError && <p className="text-xs text-slate-400">This conversation has no messages.</p>}
        <div className="space-y-4">{chat.messages.map(message => <article key={message.sequence} className="border-l border-slate-600 pl-3"><p className="text-[10px] uppercase text-slate-400">{message.role === 'user' ? 'You' : 'Assistant'} · <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p></article>)}</div>
      </div>
      <form className="shrink-0 border-t border-slate-800 p-3" onSubmit={event => { event.preventDefault(); void chat.save() }}>
        <label htmlFor="strategy-prompt" className="text-xs text-slate-400">Research message</label>
        <textarea id="strategy-prompt" value={chat.draft} disabled={locked} maxLength={4000} onChange={event => chat.setDraft(event.target.value)} rows={2} className="mt-1 w-full resize-none border border-slate-700 bg-slate-950 px-3 py-2 text-sm focus:outline-sky-400" />
        <p className="my-1 text-[10px] text-slate-400">{chat.draft.length}/4000 · 100 conversations / 2000 messages each</p>
        <button className={`${control} w-full bg-slate-200 font-semibold !text-slate-950 hover:bg-white`} disabled={chat.busy || chat.aiCancelling || chat.pendingAction === 'ai' || chat.pendingAction === 'create' || !chat.draft.trim() || chat.messagesLoading} type="submit">{chat.busy && chat.pendingAction !== 'ai' ? 'Saving…' : chat.pendingAction === 'save' ? 'Retry save' : 'Save message'}</button>
      </form>
    </> : <div className="min-h-0 flex-1 p-5 text-sm text-slate-400">Select a conversation or start a New Chat. Messages are saved to your account; strategy generation will be connected separately.</div>}
    <AiControls chat={chat} />
    {chat.mutationError && <p role="alert" className="shrink-0 px-3 pb-3 text-xs text-red-300">{chat.mutationError}{chat.uncertain && ' The outcome is uncertain. Retry the same operation to avoid duplicates.'}</p>}
    {chat.notice && <p role="status" className="shrink-0 px-3 pb-3 text-xs text-slate-300">{chat.notice}</p>}
    <Modal open={confirmDelete} label="Delete conversation" onClose={() => { if (!chat.busy) setConfirmDelete(false) }}>
      <div className="m-auto max-w-sm border border-slate-700 bg-slate-900 p-6 text-slate-200"><h3 className="font-semibold">Delete conversation?</h3><p className="my-4 break-words text-sm">Permanently delete “{chat.selected?.title}” and its messages. This cannot be undone.</p><div className="flex gap-3"><button className={control} disabled={chat.busy} onClick={() => setConfirmDelete(false)}>Cancel</button><button className={control} disabled={chat.busy} onClick={() => void chat.remove().then(done => { if (done) setConfirmDelete(false) })}>Confirm delete</button></div>{chat.mutationError && <p role="alert" className="mt-3 text-xs text-red-300">{chat.mutationError}</p>}</div>
    </Modal>
  </section>
}

function AiControls({ chat }: { chat: ChatState }) {
  const pending = chat.pendingAction === 'ai'
  const latest = chat.messages.at(-1)
  return <section aria-label="AI provider controls" className="max-h-64 shrink-0 overflow-y-auto border-t border-slate-800 p-3 text-xs">
    <div className="flex flex-wrap items-center gap-2"><button className={control} disabled={chat.aiChecking || chat.busy || pending || chat.aiCancelling} onClick={() => void chat.checkAiConfiguration()}>{chat.aiChecking ? 'Checking AI…' : 'Check AI availability'}</button>
      <span className="text-slate-400">{chat.aiConfiguration?.configured ? `${chat.aiConfiguration.provider === 'gemini' ? 'Gemini' : 'OpenAI'} · ${chat.aiConfiguration.model}` : chat.aiConfiguration ? 'AI is not configured on the server.' : 'Provider availability not checked.'}</span></div>
    <p className="my-2 leading-5 text-slate-400">Ask AI sends up to 20 recent saved messages from this conversation to the configured provider. Provider retention policies apply. Do not include secrets. Research output may be wrong; no trades are executed.</p>
    {chat.aiConfiguration?.provider === 'gemini' && <p className="my-2 leading-5 text-amber-200">Gemini prototype: use synthetic test data only. Free-tier content may be used to improve provider products. Do not send real private data.</p>}
    <div className="flex flex-wrap gap-2"><button className={control} disabled={chat.busy || chat.aiChecking || chat.aiCancelling || chat.uncertain || !chat.aiConfiguration?.configured || !chat.selected || chat.messagesLoading || !!chat.messageError || !!chat.draft.trim() || latest?.role !== 'user'} onClick={() => void chat.askAi()}>Ask AI</button>
      {pending && <><button className={control} disabled={chat.busy || chat.aiCancelling} onClick={() => void chat.checkAiStatus()}>Check AI status</button><button className={control} disabled={chat.busy || chat.aiCancelling} onClick={() => void chat.askAi()}>Retry same AI request</button><button className={control} disabled={chat.aiCancelling} onClick={() => void chat.cancelAi()}>{chat.aiCancelling ? 'Cancelling AI…' : 'Cancel AI request'}</button></>}
    </div>
    {pending && <p role="status" className="mt-2">{chat.busy ? 'Waiting for AI. No reply is saved until the server confirms it.' : 'AI outcome is pending or uncertain. Check status or retry the same request; do not create a duplicate.'}</p>}
    {chat.aiTurn && <p className="mt-2 text-slate-400">AI request: {chat.aiTurn.state} · context messages {chat.aiTurn.contextStart}–{chat.aiTurn.contextEnd} · {chat.aiTurn.model}</p>}
    {chat.aiError && <p role="alert" className="mt-2 text-red-300">{chat.aiError}</p>}
  </section>
}

/** Reset the editable title synchronously with conversation identity/server title. */
function TitleEditor({ chat, onDelete }: { chat: ChatState; onDelete: () => void }) {
  const [title, setTitle] = useState(chat.selected?.title ?? '')
  const locked = chat.busy || chat.uncertain || chat.aiCancelling
  return <form className="flex shrink-0 gap-2 border-b border-slate-800 p-3" onSubmit={event => { event.preventDefault(); void chat.rename(title) }}>
    <label className="min-w-0 flex-1 text-[10px] text-slate-400">Conversation title<input value={title} onChange={event => setTitle(event.target.value)} disabled={locked} maxLength={120} required className="mt-1 min-h-10 w-full border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 focus:outline-sky-400" /></label>
    <button className={`${control} mt-5`} disabled={locked || chat.messagesLoading} type="submit">Rename</button><button className={`${control} mt-5`} disabled={locked || chat.messagesLoading} type="button" onClick={onDelete}>Delete</button>
  </form>
}
