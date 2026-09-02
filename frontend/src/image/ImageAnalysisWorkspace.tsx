import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { buttonClass, inputClass } from '../auth/AuthForm'
import * as api from './api'

export function ImageAnalysisWorkspace() {
  const auth = useAuth(), identity = auth?.user.id, epoch = useRef(0)
  const [items, setItems] = useState<api.Saved[]>([]), [selected, setSelected] = useState<api.Saved | null>(null), [file, setFile] = useState<File | null>(null)
  const [question, setQuestion] = useState('Describe only visible chart evidence and clearly mark missing context.')
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('')

  useEffect(() => {
    const current = ++epoch.current
    setItems([]); setSelected(null); setLoading(true)
    api.list(identity).then(value => { if (current === epoch.current) setItems(value) }).catch(() => { if (current === epoch.current) setError('Could not load image analyses.') }).finally(() => { if (current === epoch.current) setLoading(false) })
    return () => { epoch.current++ }
  }, [identity])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!file || busy) return
    const current = epoch.current
    setBusy(true); setError('')
    try {
      const value = await api.analyze(file, question, crypto.randomUUID(), identity)
      if (current === epoch.current) { setSelected(value); setItems(previous => [value, ...previous.filter(item => item.id !== value.id)]) }
    } catch { if (current === epoch.current) setError('Image analysis failed. No result was fabricated.') }
    finally { if (current === epoch.current) setBusy(false) }
  }

  const analysis = selected?.analysis
  return <section aria-label="Chart image analysis" className="h-full overflow-y-auto bg-slate-950 p-3 text-slate-100 sm:p-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Visual research</p><h1 className="text-xl font-semibold">Image analysis</h1></div><span className="status-chip">Evidence only</span></header>
    <details className="help-details mt-3"><summary>Image safety</summary><p>PNG/JPEG pixels and visible text are untrusted data. No URLs, tools, code or automatic strategy execution.</p></details>
    {error && <p role="alert" className="my-3 text-rose-200">{error}</p>}
    {busy && <p role="status" className="my-3 text-slate-400">Analyzing canonical image…</p>}
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,.7fr)_minmax(0,1.3fr)]">
      <form aria-label="Analyze chart image" onSubmit={submit} className="terminal-panel space-y-3 p-4">
        <h2 className="font-semibold">Analyze chart</h2>
        <input aria-label="Chart image file" type="file" required accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={event => setFile(event.target.files?.[0] ?? null)} className="w-full text-xs text-slate-400 file:mr-3 file:rounded-md file:border file:border-slate-700 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200" />
        <textarea aria-label="Image research question" className={`${inputClass} min-h-28`} required maxLength={1000} value={question} onChange={event => setQuestion(event.target.value)} />
        <button className={`${buttonClass} primary-button`} disabled={busy}>Analyze image</button>
        <details className="help-details"><summary>Upload limits</summary><p>Maximum 2 MiB, 4096×4096 and 16 million pixels. Metadata is removed before provider processing.</p></details>
        <h2 className="pt-2 text-sm font-semibold">Recent analyses</h2>
        {loading ? <p role="status" className="text-sm text-slate-500">Loading analyses…</p> : items.length === 0 ? <p className="text-sm text-slate-500">No image analyses yet.</p> : <ul className="space-y-1">{items.map(item => <li key={item.id}><button type="button" className="min-h-10 w-full rounded-md px-2 text-left text-xs text-emerald-300 hover:bg-slate-800" onClick={() => setSelected(item)}>{new Date(item.createdAt).toLocaleString()} · {item.width}×{item.height}</button></li>)}</ul>}
      </form>
      {selected && analysis ? <article aria-label="Structured image analysis" className="terminal-panel space-y-4 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Structured result</h2><span className="status-chip">Confidence {(analysis.confidence * 100).toFixed(0)}%</span></div><Section title="Visible evidence" values={analysis.visibleEvidence.map(evidence => `${evidence.id} — ${evidence.observation} (${evidence.location})`)} /><Section title="Visible text / OCR" values={analysis.visibleText} /><Section title="Inferences" values={analysis.inferences.map(inference => `${inference.statement} [${inference.evidenceIds.join(', ') || 'no supporting evidence'}]`)} /><Section title="Missing data" values={analysis.missingData} /><details className="help-details"><summary>Limitations & provider</summary><p>{selected.provider} · {selected.model}</p><Section title="Limitations" values={analysis.limitations} /><p className="text-amber-200">Research interpretation only. Verify the image and missing context. Not financial advice, a profit claim, or an accepted strategy.</p></details></article> : <div className="terminal-panel grid min-h-64 place-items-center p-6 text-center text-sm text-slate-500">Select or create an analysis.</div>}
    </div>
  </section>
}

function Section({ title, values }: { title: string; values: string[] }) {
  return <section><h2 className="text-sm font-semibold">{title}</h2>{values.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{values.map((value, index) => <li className="whitespace-pre-wrap break-words" key={index}>{value}</li>)}</ul> : <p className="mt-1 text-sm text-slate-500">None reported.</p>}</section>
}
