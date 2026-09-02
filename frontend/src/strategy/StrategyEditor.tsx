import { useContext, useState } from 'react'
import { buttonClass, inputClass } from '../auth/AuthForm'
import { ConversationContext } from '../chat/ConversationContext'
import { Modal } from '../components/Modal'
import { DatasetChart } from '../market/DatasetChart'
import { useMarket } from '../market/MarketContext'
import { useStrategy } from './StrategyContext'
import sample from './sample.json'

export function StrategyEditor() {
  const s = useStrategy()!, market = useMarket(), chat = useContext(ConversationContext)
  const [showChart, setShowChart] = useState(false), [newOpen, setNewOpen] = useState(false), [newTitle, setNewTitle] = useState('')
  const [confirm, setConfirm] = useState<null | { message: string; action: () => void }>(null)
  const blocked = s.busy || s.uncertain || s.loading
  const replace = (action: () => void) => { if (s.dirty) setConfirm({ message: 'Replace unsaved editor changes? Saved revisions will remain unchanged.', action }); else action() }
  const chooseSample = () => replace(() => s.replace(s.title, JSON.stringify(sample, null, 2)))
  const selected = s.selected
  const latestUser = chat?.messages.at(-1)?.role === 'user' ? chat.messages.at(-1)! : null
  const proposalSourceMatches = !!chat?.selected && (!s.generation || s.generation.conversationId === chat.selected.id)
  const canGenerate = !!selected && !!chat?.selected && !!latestUser && !!chat.aiConfiguration?.configured && !chat.draft.trim() && !chat.messagesLoading && !chat.messageError && !s.dirty && !s.generationBusy && !s.generationUncertain
  const mismatch = selected?.status === 'VALIDATED' && market?.selected && (selected.symbol !== market.selected.symbol || selected.timeframe !== market.selected.timeframe)
  return <section aria-label="My Script" className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2.5">
      <div className="mr-2"><p className="eyebrow">Strategy</p><h2 className="text-sm font-semibold">DSL Editor</h2></div>
      <label className="flex min-w-0 flex-1 basis-48 items-center gap-2 text-xs text-slate-500"><span className="sr-only">Strategy</span><select aria-label="Strategy" value={selected?.strategyId ?? ''} disabled={blocked} className="min-h-9 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 text-slate-100" onChange={event => { const id = event.target.value; replace(() => void s.select(id)) }}>
        <option value="" disabled>Select a strategy</option>
        {selected && !s.items.some(item => item.id === selected.strategyId) && <option value={selected.strategyId}>{selected.title}</option>}
        {s.items.map(item => <option key={item.id} value={item.id}>{item.title} · r{item.revision}</option>)}
      </select></label>
      <button className={buttonClass} disabled={blocked} onClick={() => replace(() => { setNewTitle(''); setNewOpen(true) })}>New strategy</button>
      <button aria-label="Refresh strategies" title="Refresh strategy list" className={buttonClass} disabled={s.listLoading || blocked} onClick={() => void s.loadList()}>Refresh</button>
      {s.nextCursor && <button className={buttonClass} disabled={s.listLoading || blocked} onClick={() => void s.loadList(true)}>More strategies</button>}
      {market && <button className={`${buttonClass} 2xl:hidden`} onClick={() => setShowChart(!showChart)}>{showChart ? 'Show editor' : 'Show chart'}</button>}
    </div>
    <div className={`grid min-h-0 flex-1 ${market ? '2xl:grid-cols-2' : ''}`}>
      <div className={`${showChart && market ? 'hidden 2xl:block' : ''} min-h-0 min-w-0 overflow-y-auto p-3 sm:p-4`}>
        <details className="help-details mb-3"><summary>Help & workflow</summary><p>Private immutable revisions. Validation does not run AI or a backtest. Pine and MQL5 export only a saved VALIDATED revision.</p></details>
        {s.listLoading && <p role="status">Loading strategies…</p>}
        {s.loading && <p role="status">Loading strategy…</p>}
        {s.error && <p role="alert" className="mb-3 break-words text-sm text-rose-300">{s.error}</p>}
        {s.notice && <p role="status" className="mb-3 text-xs text-emerald-300">{s.notice}</p>}
        {s.uncertain && <div className="my-3 space-y-2"><p className="text-xs text-amber-200">Outcome uncertain. The editor is locked until the original request is retried. Do not reload while unsaved data matters.</p><button className={buttonClass} disabled={s.busy} onClick={() => void s.retry()}>Retry strategy request</button></div>}
        {!selected && !s.loading && <div className="py-10 text-center"><h3 className="text-base font-semibold">No strategy</h3><p className="mt-1 text-sm text-slate-500">Create or select a saved strategy.</p></div>}
        {selected && <>
          {chat && <details aria-label="AI strategy proposal" className="help-details mb-4"><summary>AI proposal</summary><div className="space-y-3 pb-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className={`status-chip ${chat.aiConfiguration?.configured ? 'status-chip--success' : ''}`}>{chat.aiConfiguration?.configured ? 'AI Connected' : 'AI unchecked'}</span><button className={buttonClass} disabled={chat.aiChecking || s.generationBusy} onClick={() => void chat.checkAiConfiguration()}>{chat.aiChecking ? 'Checking AI…' : 'Check AI availability'}</button></div>
            <p className="leading-5 text-slate-400">Uses the selected conversation as bounded context. Returned JSON stays inert and requires validation plus explicit acceptance. Nothing is executed or backtested.</p>
            {chat.aiConfiguration && <p>Provider: {chat.aiConfiguration.configured ? `${chat.aiConfiguration.provider} · ${chat.aiConfiguration.model}` : 'not configured'}</p>}
            {chat.aiConfiguration?.provider === 'gemini' && <p className="text-amber-200">Only synthetic/test data may be sent during prototype provider verification. Review private content before generating.</p>}
            {!chat.selected && <p className="text-amber-200">Select a private conversation first.</p>}
            {chat.selected && !latestUser && <p className="text-amber-200">The selected conversation needs a latest saved user message.</p>}
            {chat.draft.trim() && <p className="text-amber-200">Save or clear the unsaved chat draft before generating.</p>}
            {s.dirty && <p className="text-amber-200">Save or reload strategy editor changes before generating.</p>}
            {s.generationError && <p role="alert" className="break-words text-rose-300">{s.generationError}</p>}
            {s.generationUncertain && <p className="text-amber-200">Provider outcome is pending or uncertain. Check the original request; do not create a replacement request.</p>}
            <div className="flex flex-wrap gap-2">
              <button className={buttonClass} disabled={!canGenerate} onClick={() => void s.generateProposal()}>{s.generationBusy ? 'Working…' : 'Generate proposal'}</button>
              {s.generationUncertain && <button className={buttonClass} disabled={s.generationBusy || !proposalSourceMatches} onClick={() => void s.checkGeneration()}>Check proposal status</button>}
              {s.generation?.state === 'PENDING' && <button className={buttonClass} disabled={s.generationBusy || !proposalSourceMatches} onClick={() => void s.cancelGeneration()}>Cancel proposal</button>}
            </div>
            {s.generation && <div className="space-y-2 border-t border-slate-800 pt-3">
              <p>State: <strong>{s.generation.state}</strong> · {s.generation.provider} / {s.generation.model}</p>
              <p className="break-all text-slate-400">Frozen context: messages {s.generation.contextStart}–{s.generation.sourceSequence} ({s.generation.contextCount}) · SHA-256 {s.generation.contextHash}</p>
              {!proposalSourceMatches && <p className="text-amber-200">Select the proposal's original conversation before changing its state.</p>}
              {s.generation.proposal && <><p className="whitespace-pre-wrap">{s.generation.proposal.explanation}</p>
                {!!s.generation.proposal.assumptions.length && <ul className="list-disc space-y-1 pl-5">{s.generation.proposal.assumptions.map((value, index) => <li key={index}>{value}</li>)}</ul>}
                {s.generation.proposal.kind === 'clarification' && <div><p className="font-semibold">Clarification required</p><ul className="list-disc space-y-1 pl-5">{s.generation.proposal.questions.map((value, index) => <li key={index}>{value}</li>)}</ul></div>}
                {s.generation.proposal.dslJson && <pre aria-label="AI DSL proposal preview" className="max-h-72 overflow-auto whitespace-pre-wrap break-all border border-slate-800 p-2 font-mono text-[11px]">{s.generation.proposal.dslJson}</pre>}</>}
              {(s.generation.state === 'READY' || s.generation.state === 'CLARIFICATION') && <div className="flex flex-wrap gap-2">
                {s.generation.state === 'READY' && <button className={buttonClass} disabled={s.generationBusy || !proposalSourceMatches || s.dirty} onClick={() => setConfirm({ message: 'Accept this validated AI proposal as exactly one new immutable strategy revision? This does not execute, export, or backtest it.', action: () => void s.acceptGeneration() })}>Accept as validated revision</button>}
                <button className={buttonClass} disabled={s.generationBusy || !proposalSourceMatches} onClick={() => void s.rejectGeneration()}>Reject proposal</button>
              </div>}
              {s.generation.state === 'ACCEPTED' && <p className="text-emerald-300">Accepted as immutable revision {s.generation.acceptedRevision}.</p>}
            </div>}
          </div></details>}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><span className="sr-only">Saved r{selected.revision} · {selected.status}</span><div className="flex min-w-0 items-center gap-2"><h3 className="truncate text-base font-semibold">{selected.title}</h3><span className={`status-chip ${selected.status === 'VALIDATED' ? 'status-chip--success' : 'status-chip--warning'}`}>{selected.status}</span><span className="text-xs font-mono text-slate-500">r{selected.revision}</span></div><span className={`text-xs ${s.dirty ? 'text-amber-200' : 'text-slate-500'}`}>{s.dirty ? 'Unsaved changes' : 'Editor matches saved revision'}</span></div>
          <label className="mb-3 block space-y-1 text-xs">Strategy title<input className={inputClass} maxLength={120} disabled={blocked} value={s.title} onChange={event => s.edit('title', event.target.value)} /></label>
          <label className="block space-y-1 text-xs text-slate-400">Strategy DSL<textarea aria-label="Strategy JSON" className={`${inputClass} min-h-80 resize-y font-mono text-xs leading-5`} spellCheck={false} disabled={blocked} value={s.draft} onChange={event => s.edit('draft', event.target.value)} /></label>
          <p className="my-2 text-right text-[10px] text-slate-600">{new TextEncoder().encode(s.draft).length.toLocaleString()} / 65,536 bytes</p>
          <div className="flex flex-wrap gap-2">
            <button className={buttonClass} disabled={blocked || !s.title.trim()} onClick={() => void s.save('DRAFT')}>Save draft</button>
            <button className={`${buttonClass} primary-button`} disabled={blocked || s.validating} onClick={() => void s.validate()}>{s.validating ? 'Validating…' : 'Validate'}</button>
            <button aria-label="Save validated revision" className={buttonClass} disabled={blocked || !s.title.trim()} onClick={() => void s.save('VALIDATED')}>Save validated</button>
          </div>
          {s.validation && <div className="my-3 border-l-2 border-slate-600 pl-3 text-xs" role="status">{s.validation.valid ? <p className="text-emerald-300">Current text passes DSL validation. It is not saved by this check.</p> : <><p className="text-amber-200">Current text is not valid DSL.</p><ul className="mt-2 space-y-1 break-all">{s.validation.errors.map((error, i) => <li key={i}>{error.path || '/'} · {error.code}</li>)}</ul></>}</div>}
          <div className="my-4 flex flex-wrap gap-2">
            <button className={buttonClass} disabled={blocked} onClick={() => replace(() => void s.select(selected.strategyId))}>Reload current revision</button>
            <button className={buttonClass} disabled={blocked} onClick={chooseSample}>Load synthetic DSL example</button>
            <button className={buttonClass} disabled={blocked} onClick={() => setConfirm({ message: `Delete ${selected.title} and all its revisions? Unsaved edits will also be lost. Datasets and conversations stay intact.`, action: () => void s.remove() })}>Delete strategy</button>
          </div>
          {selected.status === 'VALIDATED' && <details className="my-3 border-t border-slate-800 pt-2 text-xs"><summary>Saved validated metadata</summary><dl className="space-y-2 break-all py-3"><dt>Canonical SHA-256</dt><dd>{selected.hash}</dd><dt>Schema / validator / minimum bars</dt><dd>{selected.schemaVersion} / {selected.validatorVersion} / {selected.minimumBars}</dd><dt>Market context</dt><dd>{selected.symbol} · {selected.timeframe} · UTC</dd></dl><pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]">{selected.canonicalJson}</pre></details>}
          <section aria-label="Revision history" className="mt-4 space-y-2 border-t border-slate-800 pt-3">
            <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">Saved revisions</h3><button className={buttonClass} disabled={s.historyLoading || blocked} onClick={() => void s.loadHistory()}>Refresh history</button></div>
            {s.historyLoading && <p role="status" className="text-xs">Loading history…</p>}
            <ul className="space-y-1">{s.versions.map(item => <li key={item.revision}><button className="w-full break-words border border-slate-800 px-3 py-2 text-left text-xs hover:bg-slate-900" disabled={blocked} onClick={() => void s.inspect(item.revision)}>View revision {item.revision} · {item.status} · {item.title}</button></li>)}</ul>
            {s.nextBefore && <button className={buttonClass} disabled={s.historyLoading || blocked} onClick={() => void s.loadHistory(true)}>Older revisions</button>}
            {s.preview && <section aria-label="Historical revision" className="space-y-3 border border-slate-700 p-3"><p className="text-xs">Read-only r{s.preview.revision} · {s.preview.status}</p><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all text-xs">{s.preview.draftText || '(empty draft)'}</pre><div className="flex flex-wrap gap-2"><button className={buttonClass} disabled={blocked} onClick={() => { const version = s.preview!; replace(() => s.replace(version.title, version.draftText)) }}>Use revision in editor</button><button className={buttonClass} onClick={s.closePreview}>Close history preview</button></div></section>}
          </section>
        </>}
      </div>
      {market && <div className={`${showChart ? 'flex' : 'hidden 2xl:flex'} min-h-0 min-w-0 flex-col border-l border-slate-800`}>
        <div className="shrink-0 space-y-1 border-b border-slate-800 p-3 text-xs text-slate-400"><p>Chart context only · no saved dataset binding or execution</p>{selected?.status === 'VALIDATED' && <p>Saved strategy: {selected.symbol} · {selected.timeframe}{s.dirty ? ' (editor has unsaved changes)' : ''}</p>}{mismatch && <p role="note" className="text-amber-200">Dataset symbol or timeframe does not match the saved validated strategy.</p>}</div>
        <div className="min-h-0 flex-1"><DatasetChart /></div>
      </div>}
    </div>
    <Modal open={newOpen} label="New strategy" onClose={() => { if (!s.busy) setNewOpen(false) }}><form className="mx-auto w-[min(420px,92vw)] space-y-4 border border-slate-700 bg-slate-950 p-5" onSubmit={async event => { event.preventDefault(); if (await s.create(newTitle)) setNewOpen(false) }}><h2 className="text-lg font-semibold">New strategy</h2><label className="block space-y-1 text-xs">New strategy title<input className={inputClass} required maxLength={120} disabled={blocked} value={newTitle} onChange={event => setNewTitle(event.target.value)} /></label><p className="text-xs text-slate-400">Creates an empty DRAFT revision. No strategy is generated or executed.</p>{s.error && <p role="alert" className="text-sm text-rose-300">{s.error}</p>}<div className="flex gap-2"><button className={buttonClass} disabled={blocked}>Create strategy</button><button type="button" className={buttonClass} disabled={s.busy} onClick={() => setNewOpen(false)}>Cancel creation</button></div></form></Modal>
    <Modal open={!!confirm} label="Confirm strategy action" onClose={() => setConfirm(null)}><div className="mx-auto w-[min(440px,92vw)] space-y-4 border border-slate-700 bg-slate-950 p-5"><p className="break-words text-sm text-slate-300">{confirm?.message}</p><div className="flex gap-2"><button className={buttonClass} onClick={() => setConfirm(null)}>Keep editing</button><button className={buttonClass} onClick={() => { const action = confirm?.action; setConfirm(null); action?.() }}>Confirm action</button></div></div></Modal>
  </section>
}
