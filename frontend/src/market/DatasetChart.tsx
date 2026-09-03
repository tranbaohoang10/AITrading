import { useState } from 'react'
import { buttonClass } from '../auth/AuthForm'
import { Modal } from '../components/Modal'
import { CandleChart } from './CandleChart'
import { ImportForm } from './ImportForm'
import { useMarket } from './MarketContext'
import { ChartToolsRail, ChartUtilities } from '../components/ChartControls'
import { Icon } from '../components/Icon'

export function DatasetChart() {
  const market = useMarket()!
  const [importing, setImporting] = useState(false), [deleting, setDeleting] = useState(false)
  const blocked = market.busy || market.uncertain
  const selected = market.selected, page = market.page
  return <section aria-label="Chart" data-testid="chart-view" className="flex h-full min-h-0 flex-col overflow-hidden">
    <div data-testid="chart-toolbar" className="flex h-10 shrink-0 items-center gap-1.5 border-b border-slate-800 bg-slate-925 px-2">
      <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 text-[10px] font-medium text-slate-600 sm:max-w-xl">Dataset<select aria-label="Dataset" className="h-8 min-w-0 flex-1 rounded-md border border-slate-800 bg-slate-950 px-2 text-xs font-medium text-slate-200 outline-none focus:border-slate-600" value={selected?.id ?? ''} disabled={blocked} onChange={event => { const item = market.items.find(value => value.id === event.target.value); if (item) market.select(item) }}>
        <option value="" disabled>Select a dataset</option>
        {selected && !market.items.some(item => item.id === selected.id) && <option value={selected.id}>{selected.name}</option>}
        {market.items.map(item => <option key={item.id} value={item.id}>{item.name} · {item.symbol} · {item.timeframe}</option>)}
      </select></label>
      {selected && <><span className="status-chip hidden md:inline-flex">{selected.symbol}</span><span className="status-chip hidden md:inline-flex">{selected.timeframe}</span></>}
      <button className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-2.5 text-[11px] font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-40" disabled={blocked} onClick={() => setImporting(true)}><Icon name="upload" className="h-3.5 w-3.5" />Import CSV</button>
      {market.nextCursor && <button aria-label="More datasets" title="More datasets" className="icon-tool grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-slate-300" disabled={market.listLoading || blocked} onClick={() => void market.loadList(true)}><Icon name="more" className="h-4 w-4" /></button>}
      <ChartUtilities hasChart={!!page} refreshing={market.listLoading} onRefresh={() => void market.loadList()} />
    </div>
    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      <ChartToolsRail />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4">
      {market.listLoading && <p role="status" className="text-xs text-slate-400">Loading datasets…</p>}
      {market.listError && <p role="alert" className="text-sm text-rose-300">{market.listError}</p>}
      {market.notice && <p role="status" className="text-xs text-emerald-300">{market.notice}</p>}
      {market.mutationError && !importing && <p role="alert" className="text-sm text-rose-300">{market.mutationError}</p>}
      {market.uncertain && !importing && <button className={buttonClass} disabled={market.busy} onClick={() => void market.importData()}>Retry import</button>}
      {!selected && !market.listLoading && <div className="my-auto py-10 text-center"><span className="sr-only">Your market datasets</span><div className="mx-auto mb-3 grid h-9 w-9 place-items-center rounded-lg border border-slate-800 bg-slate-925 text-slate-600"><Icon name="chart" className="h-4 w-4" /></div><h2 className="text-sm font-semibold text-slate-200">No market data</h2><p className="mt-1 text-xs text-slate-600">{market.items.length ? 'Select a dataset to begin.' : 'Import an OHLCV dataset to begin.'}</p><button className="mt-4 min-h-9 rounded-md border border-slate-700 bg-slate-800 px-3 text-xs font-semibold text-slate-200 hover:bg-slate-700" disabled={blocked} onClick={() => setImporting(true)}>Import CSV</button></div>}
      {selected && <>
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-base font-semibold text-slate-100">{selected.name}</h2><p className="mt-1 text-xs text-slate-500">{selected.symbol} · {selected.timeframe} · {selected.candleCount} candles</p></div>
          <button className={buttonClass} disabled={blocked} onClick={() => setDeleting(true)}>Delete dataset</button></div>
        <details className="help-details"><summary>Source & data details</summary><p className="break-words"><span className={selected.sourceKind === 'SYNTHETIC' ? 'text-amber-200' : 'text-slate-300'}>{selected.sourceKind === 'SYNTHETIC' ? 'SYNTHETIC — not market prices' : 'USER UPLOAD — source unverified'}</span> · {selected.sourceLabel}</p></details>
        {selected.gapCount > 0 && <p role="note" className="border-l-2 border-amber-400 pl-3 text-xs text-amber-200">{selected.gapCount} missing candle intervals. No candles were filled; gap-free backtests must reject this dataset.</p>}
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><label>Candle window <select aria-label="Candle window" value={market.window} disabled={blocked} className="border border-slate-700 bg-slate-900 p-2 text-slate-100" onChange={event => market.setWindow(Number(event.target.value))}>{[50, 100, 200].map(size => <option key={size} value={size}>{size} bars</option>)}</select></label>
          <button className={buttonClass} disabled={blocked || market.pageLoading || !page || page.start === 0} onClick={() => void market.loadPage(Math.max(0, page!.start - market.window))}>Older candles</button>
          <button className={buttonClass} disabled={blocked || market.pageLoading || !page || page.start + page.items.length >= page.total} onClick={() => void market.loadPage(page!.start + market.window)}>Newer candles</button>
          {page && <span>{page.start + (page.items.length ? 1 : 0)}–{page.start + page.items.length} / {page.total}</span>}
        </div>
        {market.pageLoading && <p role="status" className="py-8 text-sm text-slate-400">Loading candles…</p>}
        {market.pageError && <div><p role="alert" className="text-sm text-rose-300">{market.pageError}</p><button className={buttonClass} onClick={() => void market.loadPage()}>Retry candles</button></div>}
        {page && <div data-chart-export><CandleChart key={`${page.dataset.id}:${page.start}:${page.items.length}`} page={page} /></div>}
        <details className="shrink-0 border-t border-slate-800 pt-2 text-[11px] text-slate-500"><summary className="cursor-pointer py-1">Dataset provenance and hashes</summary><dl className="space-y-1 break-all py-2"><dt>Date range · UTC</dt><dd>{selected.firstTime} → {selected.lastTime}</dd><dt>Canonical OHLCV SHA-256</dt><dd>{selected.dataHash}</dd><dt>Original CSV SHA-256</dt><dd>{selected.rawHash}</dd><dt>Format</dt><dd>{selected.formatVersion} · fingerprints do not verify source authenticity</dd></dl></details>
      </>}
      </div>
    </div>
    <Modal open={importing} label="Import market data" onClose={() => { if (!blocked) setImporting(false) }}><ImportForm onClose={() => setImporting(false)} onComplete={() => setImporting(false)} /></Modal>
    <Modal open={deleting} label="Delete dataset" onClose={() => { if (!market.busy) setDeleting(false) }}>
      <div className="mx-auto w-[min(420px,92vw)] space-y-4 border border-slate-700 bg-slate-950 p-5 text-slate-100"><h2 className="text-lg font-semibold">Delete dataset?</h2><p className="break-words text-sm text-slate-400">Permanently delete {selected?.name} and its candles from your account?</p>
        {market.mutationError && <p role="alert" className="text-sm text-rose-300">{market.mutationError}</p>}
        <div className="flex gap-3"><button className={buttonClass} disabled={market.busy} onClick={() => setDeleting(false)}>Cancel deletion</button><button className={buttonClass} disabled={market.busy} onClick={async () => { if (await market.remove()) setDeleting(false) }}>Confirm deletion</button></div></div>
    </Modal>
  </section>
}
