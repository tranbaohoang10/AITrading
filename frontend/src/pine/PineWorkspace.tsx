import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { ApiError, currentUser } from '../auth/api'
import { useStrategy } from '../strategy/StrategyContext'
import type { Revision } from '../strategy/api'
import { exportPine } from './api'
import type { Artifact } from './api'

const button = 'min-h-10 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-emerald-400'

export function PineWorkspace() {
  const auth = useAuth(), strategy = useStrategy(), source = strategy?.selected
  if (!auth || !source) return <div className="p-5 text-sm text-slate-400">Select a saved strategy in Strategy DSL to export Pine Script.</div>
  if (source.status !== 'VALIDATED') return <div className="p-5 text-sm text-slate-400">Revision {source.revision} is DRAFT. Validate and save it in Strategy DSL before exporting. No demo code is substituted.</div>
  return <SavedPine key={`${auth.user.id}:${source.strategyId}:${source.revision}:${source.hash}`} source={source} accountId={auth.user.id} dirty={!!strategy?.dirty} />
}

function SavedPine({ source, accountId, dirty }: { source: Revision; accountId: string; dirty: boolean }) {
  const auth = useAuth()
  const [artifact, setArtifact] = useState<Artifact | null>(null)
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const alive = useRef(false), running = useRef(false), clear = useRef(auth?.clear)
  clear.current = auth?.clear
  // This component is keyed by immutable source/account; drafts do not remount it.
  const captured = useRef(source)
  async function load(create: boolean) {
    if (running.current) return
    running.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const result = await exportPine(captured.current, accountId, create)
      if (!alive.current) return
      if ((await currentUser(accountId)).id !== accountId) throw new ApiError(401)
      if (alive.current) { setArtifact(result); setNotice(create ? 'Saved export ready. Repeated generation returns this same artifact.' : '') }
    } catch (failure) {
      if (!alive.current) return
      if (failure instanceof ApiError && failure.status === 401) clear.current?.()
      else if (!create && failure instanceof ApiError && failure.status === 404) { setArtifact(null); setNotice('No saved export is available for this revision. Generate it below.') }
      else setError(failure instanceof Error ? failure.message : 'Cannot load Pine export. Retry without changing the source revision.')
    } finally { if (alive.current) setBusy(false); running.current = false }
  }
  useEffect(() => {
    alive.current = true
    void load(false)
    return () => { alive.current = false }
    // Source/account are immutable for this keyed instance.
  }, [])
  async function copy() {
    if (!artifact) return
    try { await navigator.clipboard.writeText(artifact.code); if (alive.current) setNotice('Pine source copied. Official target validation is still required.') }
    catch { if (alive.current) setError('Clipboard unavailable. Select the source below and copy it manually.') }
  }
  function download() {
    if (!artifact) return
    let url: string | undefined
    try {
      url = URL.createObjectURL(new Blob([artifact.code], { type: 'text/plain;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url; link.download = `strategy-${artifact.strategyId}-r${artifact.revision}-${artifact.codeHash.slice(0, 12)}.pine`
      document.body.append(link); link.click(); link.remove()
      setNotice('Pine source downloaded. This does not certify compilation or trading performance.')
    } catch { setError('Download unavailable. Copy the source manually.') }
    finally { if (url) URL.revokeObjectURL(url) }
  }
  return <section aria-label="Pine research export" className="flex h-full min-h-0 flex-col overflow-auto text-sm">
    <header className="space-y-3 border-b border-slate-800 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="eyebrow">Code export</p><h2 className="text-base font-semibold text-slate-100">Pine Script</h2><p className="mt-1 break-words text-xs text-slate-500">{source.title} · r{source.revision} · {source.symbol} / {source.timeframe}</p></div><span className="status-chip status-chip--warning">Research only</span></div>
      {dirty && <p role="note" className="text-amber-200">Unsaved edits are excluded. This exports saved revision {source.revision} only; your draft stays unchanged.</p>}
      <details className="help-details"><summary>Export limits & risk</summary><p className="text-amber-200">Experimental Pine v6 indicator with a closed-bar simulator. Not native Strategy Tester or live orders. Official compiler/runtime validation is pending.</p><p>Requires a matching standard chart and exact contiguous UTC window (up to 5000 bars). Float rounding can change near-threshold signals. Historical results do not guarantee profit.</p><p className="break-all font-mono">DSL SHA256: {source.hash}</p></details>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy} onClick={() => void load(true)}>{busy ? 'Loading…' : artifact ? 'Regenerate / retry saved revision' : 'Generate saved revision'}</button>
        <button className={button} disabled={busy} onClick={() => void load(false)}>Reload export</button>
        <button className={button} disabled={!artifact || busy} onClick={() => void copy()}>Copy Pine source</button>
        <button className={button} disabled={!artifact || busy} onClick={download}>Download .pine</button>
      </div>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {notice && <p role="status" className="text-slate-300">{notice}</p>}
      {artifact && <details className="text-xs text-slate-400"><summary className="cursor-pointer py-2">Export provenance and limitations</summary><p className="break-all py-2">{artifact.generatorVersion} · schema {artifact.schemaVersion} · validator {artifact.validatorVersion}<br />Code SHA256: {artifact.codeHash}<br />Created: {artifact.createdAt}</p><ul className="list-disc space-y-1 pl-5">{artifact.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></details>}
    </header>
    {artifact && <pre tabIndex={0} aria-label="Generated Pine source" className="min-h-48 flex-1 overflow-auto bg-[#090c0b] p-4 font-mono text-xs leading-6 text-slate-300"><code>{artifact.code}</code></pre>}
  </section>
}
