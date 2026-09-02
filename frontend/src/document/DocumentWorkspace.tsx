import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { buttonClass, inputClass } from '../auth/AuthForm'
import * as api from './api'

export function DocumentWorkspace() {
  const auth = useAuth()
  const [docs, setDocs] = useState<api.Document[]>([]), [target, setTarget] = useState(''), [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null), [question, setQuestion] = useState(''), [answer, setAnswer] = useState<api.Answer | null>(null)
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const load = () => { setLoading(true); return api.list(auth?.user.id).then(setDocs).catch(() => setError('Could not load private documents.')).finally(() => setLoading(false)) }
  useEffect(() => { void load() }, [])

  async function upload(event: FormEvent) {
    event.preventDefault()
    if (!file || busy) return
    const current = docs.find(document => document.id === target)
    setBusy(true); setError('')
    try {
      await api.upload(file, title, current?.currentVersion ?? 0, current?.id ?? null, crypto.randomUUID(), auth?.user.id)
      setTitle(''); setFile(null); setTarget(''); await load()
    } catch { setError('Upload was rejected or its outcome is uncertain. Reload before retrying.') }
    finally { setBusy(false) }
  }

  async function remove(document: api.Document) {
    if (busy) return
    setBusy(true); setError('')
    try { await api.remove(document.id, document.currentVersion, auth?.user.id); if (target === document.id) setTarget(''); await load() }
    catch { setError('Delete was rejected or the document changed. Reload before retrying.') }
    finally { setBusy(false) }
  }

  async function ask(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setAnswer(null)
    try { setAnswer(await api.ask(question, auth?.user.id)) }
    catch { setError('RAG request failed. No answer or citation was fabricated.') }
    finally { setBusy(false) }
  }

  return <section aria-label="Private document library" className="h-full overflow-y-auto bg-slate-950 p-3 text-slate-100 sm:p-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Research sources</p><h1 className="text-xl font-semibold">Library</h1></div><span className="status-chip">Private</span></header>
    <details className="help-details mt-3"><summary>Library safety</summary><p>Owned text/PDF evidence. Files are data, never instructions; no URLs, tools or code execution.</p></details>
    {error && <p role="alert" className="my-4 text-rose-200">{error}</p>}
    {busy && <p role="status" className="mt-3 text-sm text-slate-400">Processing private document request…</p>}
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <form onSubmit={upload} className="terminal-panel space-y-3 p-4" aria-label="Upload private document">
        <div><p className="eyebrow">Sources</p><h2 className="font-semibold">Documents</h2></div>
        <select className={inputClass} aria-label="Document version target" value={target} onChange={event => setTarget(event.target.value)}><option value="">Create a new document</option>{docs.map(document => <option key={document.id} value={document.id}>Replace {document.title} · v{document.currentVersion}</option>)}</select>
        <input className={inputClass} aria-label="Document title" placeholder="Document title" required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} />
        <input aria-label="Document file" type="file" required accept=".txt,text/plain,.pdf,application/pdf" onChange={event => setFile(event.target.files?.[0] ?? null)} className="w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border file:border-slate-700 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200" />
        <details className="help-details"><summary>Upload limits</summary><p>TXT or PDF only, maximum 2 MiB; PDF maximum 50 pages and extracted text 100 KiB.</p></details>
        <button className={`${buttonClass} primary-button`} disabled={busy}>{target ? 'Upload next version' : 'Upload document'}</button>
        {loading ? <p role="status" className="text-sm text-slate-400">Loading private documents…</p> : docs.length === 0 ? <p className="text-sm text-slate-500">No private documents yet.</p> : null}
        <ul aria-label="Owned documents" className="divide-y divide-slate-800">{docs.map(document => <li key={document.id} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0 truncate"><span className="font-medium">{document.title}</span><span className="ml-2 text-xs text-slate-500">v{document.currentVersion}</span></span><button type="button" disabled={busy} onClick={() => void remove(document)} className="text-xs text-rose-300">Delete</button></li>)}</ul>
      </form>
      <form onSubmit={ask} className="terminal-panel space-y-3 p-4" aria-label="Ask private documents">
        <div><p className="eyebrow">Private RAG</p><h2 className="font-semibold">Ask with citations</h2></div>
        <textarea className={`${inputClass} min-h-28`} aria-label="Document question" placeholder="Ask your library…" required maxLength={1000} value={question} onChange={event => setQuestion(event.target.value)} />
        <button className={`${buttonClass} primary-button`} disabled={busy}>Retrieve and answer</button>
        {answer && <article aria-label="RAG answer" className="space-y-3 border-t border-slate-800 pt-4"><p>{answer.answer}</p>{answer.provider && <p className="text-xs text-slate-500">{answer.provider} · {answer.model}</p>}<ol className="space-y-2">{answer.citations.map((citation, index) => <li key={`${citation.documentId}:${citation.version}:${citation.chunkIndex}`} className="rounded-md border border-slate-800 p-3 text-sm"><strong>[C{index + 1}] {citation.title} · v{citation.version}{citation.pageNumber ? ` · page ${citation.pageNumber}` : ''}</strong><p className="mt-1 whitespace-pre-wrap break-words text-slate-300">{citation.excerpt}</p></li>)}</ol><p className="text-xs text-slate-400">Private-source research answer; verify citations. Not financial advice or a profitability guarantee.</p></article>}
      </form>
    </div>
  </section>
}
