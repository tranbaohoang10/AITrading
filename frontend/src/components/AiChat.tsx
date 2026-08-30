import { useTrading } from '../context/TradingContext'
import { Icon } from './Icon'

const quickActions = ['Build a trend strategy', 'Define risk rules', 'Explain this mock setup']

export function AiChat() {
  const { messages, prompt, setPrompt, generateStrategy, generationStatus, generationError } = useTrading()

  return (
    <section aria-label="AI Chat" data-testid="ai-chat" className="flex h-full min-h-0 flex-col bg-slate-900/95">
      <header className="border-b border-slate-800 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-400/15 text-slate-300"><Icon name="chart" className="h-4 w-4" /></span>
          <div>
            <h2 className="text-sm font-semibold text-white">Quant / Strategy research</h2>
            <p className="text-xs text-slate-500">Mock workspace · no external API</p>
          </div>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
        <div className="rounded-sm border border-sky-400/20 bg-sky-400/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-300">Start with an idea</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">Describe entries, exits, timeframe, and risk. Generated examples remain read-only mock data.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <button key={action} type="button" disabled={generationStatus === 'loading'} onClick={() => setPrompt(action)} className="min-h-9 rounded-sm border border-slate-700 px-3 text-xs text-slate-300 hover:border-sky-400 hover:text-white focus-visible:ring-2 focus-visible:ring-sky-400">
                {action}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4" aria-live="polite">
          {messages.map((message) => (
            <article key={message.id} className={`max-w-[92%] rounded-sm px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'ml-auto bg-sky-500 text-slate-950' : 'border border-slate-800 bg-slate-950 text-slate-300'}`}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-70">{message.role === 'user' ? 'You' : 'Copilot'}</p>
              {message.text}
            </article>
          ))}
          {generationStatus === 'loading' && (
            <div role="status" className="flex items-center gap-3 rounded-sm border border-slate-400/20 bg-slate-400/5 px-4 py-3 text-sm text-slate-200">
              <span className="h-2 w-2 animate-pulse rounded-sm bg-slate-300" />Generating mock Strategy DSL and platform views…
            </div>
          )}
          {generationStatus === 'success' && (
            <p role="status" className="flex items-center gap-2 text-xs text-emerald-300"><span aria-hidden="true">✓</span> Strategy views updated. Backtest has not run.</p>
          )}
          {generationError && <p role="alert" className="rounded-sm border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200"><span aria-hidden="true">!</span> {generationError}</p>}
        </div>
      </div>

      <div className="border-t border-slate-800 bg-slate-950/70 p-4">
        <label htmlFor="strategy-prompt" className="sr-only">Strategy prompt</label>
        <textarea id="strategy-prompt" value={prompt} disabled={generationStatus === 'loading'} maxLength={4000} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe a strategy…" rows={3} className="w-full resize-none rounded-sm border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white placeholder:text-slate-600 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30" />
        <p className="mt-1 text-xs text-slate-500">Demo only · {prompt.length}/4000 · not saved</p>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" disabled aria-label="Attach reference" title="Attach reference — available with the future document library" className="grid min-h-11 min-w-11 place-items-center rounded-sm border border-slate-700 text-slate-300 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-40">
            <Icon name="paperclip" className="h-4 w-4" />
          </button>
          <button type="button" disabled={generationStatus === 'loading'} onClick={generateStrategy} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-sm bg-sky-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-sky-300 focus-visible:ring-2 focus-visible:ring-white disabled:cursor-wait disabled:opacity-60">
            <Icon name="chart" className="h-4 w-4" />{generationStatus === 'loading' ? 'Generating…' : 'Generate Strategy'}
          </button>
        </div>
      </div>
    </section>
  )
}
