import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

export function CodeViewer({ title, language, code }: { title: string; language: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const resetTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(resetTimer.current), [])

  const copy = async () => {
    setCopied(false)
    setError('')
    window.clearTimeout(resetTimer.current)
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(code)
      setCopied(true)
      resetTimer.current = window.setTimeout(() => setCopied(false), 1200)
    } catch {
      setError('Copy unavailable. Select the code and copy it manually.')
    }
  }

  return (
    <section aria-label={title} data-testid="code-viewer" className="flex h-full min-h-0 flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><h2 className="font-semibold text-white">{title}</h2><p className="mt-1 text-xs text-slate-500">Read-only · generated from the same mock Strategy DSL version</p></div>
        <button type="button" onClick={copy} className="flex min-h-11 items-center gap-2 rounded-sm border border-slate-700 px-3 text-sm text-slate-200 hover:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-400">
          <Icon name="copy" className="h-4 w-4" />{copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-rose-200">{error}</p>}
      <div className="min-h-0 flex-1 overflow-auto rounded-sm border border-slate-800 bg-[#050b13]" data-testid="code-scroll-container">
        <div className="sticky top-0 border-b border-slate-800 bg-slate-950 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">{language}</div>
        <pre className="min-h-full min-w-max p-5 text-[13px] leading-6 text-sky-100"><code>{code}</code></pre>
      </div>
    </section>
  )
}
