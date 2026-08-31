import { useState } from 'react'
import { buttonClass } from '../auth/AuthForm'
import { Modal } from '../components/Modal'
import { CandleChart } from './CandleChart'
import { ImportForm } from './ImportForm'
import { useMarket } from './MarketContext'

export function DatasetChart() {
  const market = useMarket()!
  const [importing, setImporting] = useState(false), [deleting, setDeleting] = useState(false)
  const blocked = market.busy || market.uncertain
  const selected = market.selected, page = market.page
  return <section aria-label="Chart" data-testid="chart-view" className="flex h-full min-h-0 flex-col overflow-y-auto">
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3">
      <label className="flex min-h-10 min-w-0 flex-1 basis-full items-center gap-2 text-xs text-slate-400 sm:basis-48">Dataset<select aria-label="Dataset" className="min-w-0 flex-1 border border-slate-700 bg-slate-900 p-2 text-slate-100" value={selected?.id ?? ''} disabled={blocked} onChange={event => { const item = market.items.find(value => value.id === event.target.value); if (item) market.select(item) }}>
        <option value="" disabled>Select a dataset</option>
        {selected && !market.items.some(item => item.id === selected.id) && <option value={selected.id}>{selected.name}</option>}
        {market.items.map(item => <option key={item.id} value={item.id}>{item.name} · {item.symbol} · {item.timeframe}</option>)}
      </select></label>
      <button className={buttonClass} disabled={blocked} onClick={() => setImporting(true)}>Import CSV</button>
      <button className={buttonClass} disabled={market.listLoading || blocked} onClick={() => void market.loadList()}>Refresh datasets</button>
      {market.nextCursor && <button className={buttonClass} disabled={market.listLoading || blocked} onClick={() => void market.loadList(true)}>More datasets</button>}
    </div>
    <div className="flex flex-1 flex-col gap-3 p-4">
      {market.listLoading && <p role="status" className="text-xs text-slate-400">Loading datasets…</p>}
      {market.listError && <p role="alert" className="text-sm text-rose-300">{market.listError}</p>}
      {market.notice && <p role="status" className="text-xs text-emerald-300">{market.notice}</p>}
      {market.mutationError && !importing && <p role="alert" className="text-sm text-rose-300">{market.mutationError}</p>}
      {market.uncertain && !importing && <button className={buttonClass} disabled={market.busy} onClick={() => void market.importData()}>Retry import</button>}
      {!selected && !market.listLoading && <div className="my-auto space-y-3 py-10"><h2 className="text-lg font-semibold">Your market datasets</h2><p className="max-w-lg text-sm leading-6 text-slate-400">{market.items.length ? 'Select a saved dataset above or import another CSV.' : 'Import a CSV to inspect your own OHLCV candles. No market feed or sample price is shown as real data.'}</p><button className={buttonClass} disabled={blocked} onClick={() => setImporting(true)}>{market.items.length ? 'Import another dataset' : 'Import your first dataset'}</button></div>}
      {selected && <>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-lg font-semibold text-slate-100">{selected.name}</h2><p className="mt-1 text-xs text-slate-400">{selected.symbol} · {selected.timeframe} · UTC · {selected.candleCount} closed candles</p></div>
          <button className={buttonClass} disabled={blocked} onClick={() => setDeleting(true)}>Delete dataset</button></div>
        <p className="break-words text-xs text-slate-400"><span className={selected.sourceKind === 'SYNTHETIC' ? 'text-amber-200' : 'text-slate-300'}>{selected.sourceKind === 'SYNTHETIC' ? 'SYNTHETIC — not market prices' : 'USER UPLOAD — source unverified'}</span> · {selected.sourceLabel}</p>
        {selected.gapCount > 0 && <p role="note" className="border-l-2 border-amber-400 pl-3 text-xs text-amber-200">{selected.gapCount} missing candle intervals. No candles were filled; gap-free backtests must reject this dataset.</p>}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><label>Candle window <select aria-label="Candle window" value={market.window} disabled={blocked} className="border border-slate-700 bg-slate-900 p-2 text-slate-100" onChange={event => market.setWindow(Number(event.target.value))}>{[50, 100, 200].map(size => <option key={size} value={size}>{size} bars</option>)}</select></label>
          <button className={buttonClass} disabled={blocked || market.pageLoading || !page || page.start === 0} onClick={() => void market.loadPage(Math.max(0, page!.start - market.window))}>Older candles</button>
          <button className={buttonClass} disabled={blocked || market.pageLoading || !page || page.start + page.items.length >= page.total} onClick={() => void market.loadPage(page!.start + market.window)}>Newer candles</button>
          {page && <span>{page.start + (page.items.length ? 1 : 0)}–{page.start + page.items.length} / {page.total}</span>}
        </div>
        {market.pageLoading && <p role="status" className="py-8 text-sm text-slate-400">Loading candles…</p>}
        {market.pageError && <div><p role="alert" className="text-sm text-rose-300">{market.pageError}</p><button className={buttonClass} onClick={() => void market.loadPage()}>Retry candles</button></div>}
        {page && <CandleChart key={`${page.dataset.id}:${page.start}:${page.items.length}`} page={page} />}
        <details className="shrink-0 border-t border-slate-800 pt-2 text-[11px] text-slate-500"><summary className="cursor-pointer py-1">Dataset provenance and hashes</summary><dl className="space-y-1 break-all py-2"><dt>Date range · UTC</dt><dd>{selected.firstTime} → {selected.lastTime}</dd><dt>Canonical OHLCV SHA-256</dt><dd>{selected.dataHash}</dd><dt>Original CSV SHA-256</dt><dd>{selected.rawHash}</dd><dt>Format</dt><dd>{selected.formatVersion} · fingerprints do not verify source authenticity</dd></dl></details>
      </>}
    </div>
    <Modal open={importing} label="Import market data" onClose={() => { if (!blocked) setImporting(false) }}><ImportForm onClose={() => setImporting(false)} onComplete={() => setImporting(false)} /></Modal>
    <Modal open={deleting} label="Delete dataset" onClose={() => { if (!market.busy) setDeleting(false) }}>
      <div className="mx-auto w-[min(420px,92vw)] space-y-4 border border-slate-700 bg-slate-950 p-5 text-slate-100"><h2 className="text-lg font-semibold">Delete dataset?</h2><p className="break-words text-sm text-slate-400">Permanently delete {selected?.name} and its candles from your account?</p>
        {market.mutationError && <p role="alert" className="text-sm text-rose-300">{market.mutationError}</p>}
        <div className="flex gap-3"><button className={buttonClass} disabled={market.busy} onClick={() => setDeleting(false)}>Cancel deletion</button><button className={buttonClass} disabled={market.busy} onClick={async () => { if (await market.remove()) setDeleting(false) }}>Confirm deletion</button></div></div>
    </Modal>
  </section>
}
