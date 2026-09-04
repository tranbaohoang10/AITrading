import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import type { DrawingTool, MagnetMode } from '../market/chartTypes'

type ToolItem = { tool: DrawingTool; label: string; icon: string }
type ToolGroup = { id: string; label: string; items: ToolItem[] }

const groups: ToolGroup[] = [
  { id: 'lines', label: 'Lines', items: [{ tool: 'trend', label: 'Trend Line', icon: 'trend' }, { tool: 'horizontal', label: 'Horizontal Line', icon: 'horizontal' }, { tool: 'vertical', label: 'Vertical Line', icon: 'vertical' }, { tool: 'ray', label: 'Ray', icon: 'ray' }] },
  { id: 'fib', label: 'Fibonacci', items: [{ tool: 'fibRetracement', label: 'Fib Retracement', icon: 'fib' }, { tool: 'fibExtension', label: 'Fib Extension', icon: 'fib' }] },
  { id: 'draw', label: 'Draw and shapes', items: [{ tool: 'rectangle', label: 'Rectangle', icon: 'rectangle' }, { tool: 'brush', label: 'Brush', icon: 'brush' }, { tool: 'ellipse', label: 'Ellipse', icon: 'shapes' }] },
  { id: 'text', label: 'Text', items: [{ tool: 'text', label: 'Text', icon: 'text' }, { tool: 'note', label: 'Note', icon: 'text' }, { tool: 'callout', label: 'Callout', icon: 'text' }] },
  { id: 'position', label: 'Position and risk', items: [{ tool: 'longPosition', label: 'Long Position', icon: 'longPosition' }, { tool: 'shortPosition', label: 'Short Position', icon: 'shortPosition' }] },
  { id: 'measure', label: 'Measure', items: [{ tool: 'ruler', label: 'Ruler', icon: 'ruler' }, { tool: 'priceRange', label: 'Price Range', icon: 'ruler' }, { tool: 'dateRange', label: 'Date Range', icon: 'ruler' }, { tool: 'datePriceRange', label: 'Date & Price Range', icon: 'ruler' }] },
]

const toolButton = 'icon-tool grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-35'

export function ChartToolsRail({ selected: controlled, onSelect, hasDrawings = false, onClear, magnet = 'off', onMagnetChange, allDrawingsLocked = false, onToggleLockAll, allDrawingsHidden = false, onToggleHideAll }: {
  selected?: DrawingTool; onSelect?: (tool: DrawingTool) => void
  canDelete?: boolean; hasDrawings?: boolean; onDelete?: () => void; onClear?: () => void
  magnet?: MagnetMode; onMagnetChange?: (mode: MagnetMode) => void; stayInMode?: boolean; onToggleStay?: () => void; onObjectTree?: () => void
  allDrawingsLocked?: boolean; onToggleLockAll?: () => void; allDrawingsHidden?: boolean; onToggleHideAll?: () => void
} = {}) {
  const containerRef = useRef<HTMLElement>(null)
  const [local, setLocal] = useState<DrawingTool>('cursor'), [openMenu, setOpenMenu] = useState<string | null>(null), [confirmClear, setConfirmClear] = useState(false)
  const [lastUsed, setLastUsed] = useState<Record<string, DrawingTool>>({ navigation: 'cursor', lines: 'trend', fib: 'fibRetracement', draw: 'rectangle', text: 'text', position: 'longPosition', measure: 'ruler' })
  const selected = controlled ?? local
  const choose = (tool: DrawingTool, group?: string) => { if (onSelect) onSelect(tool); else setLocal(tool); if (group) setLastUsed(value => ({ ...value, [group]: tool })); setOpenMenu(null); setConfirmClear(false) }

  useEffect(() => {
    const outside = (event: MouseEvent) => { if (!containerRef.current?.contains(event.target as Node)) { setOpenMenu(null); setConfirmClear(false) } }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpenMenu(null); setConfirmClear(false) } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [])

  const flyout = (id: string, label: string, items: ToolItem[]) => openMenu === id && <div className="drawing-flyout absolute left-0 top-10 z-50 w-56 rounded-lg border border-slate-700 bg-slate-900 p-1.5 shadow-2xl sm:left-11 sm:top-0"><p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500">{label}</p>{items.map(item => <button key={item.label} type="button" aria-label={item.label} title={item.label} onClick={() => choose(item.tool, id)} className={`flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[11px] ${selected === item.tool ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><Icon name={item.icon} className="h-3.5 w-3.5"/><span>{item.label}</span></button>)}</div>

  return <aside ref={containerRef} aria-label="Chart tools" className="chart-tools flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-slate-800 bg-slate-925 px-1 sm:h-auto sm:w-11 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:px-0 sm:py-1.5">
    <div className="group relative flex h-8 w-11 shrink-0 items-center rounded-md hover:bg-slate-800">
      <button type="button" aria-label="Cursor or Crosshair" aria-pressed={selected === 'cursor' || selected === 'crosshair'} title="Cursor / Crosshair" data-tooltip="Cursor / Crosshair" onClick={() => choose(lastUsed.navigation, 'navigation')} className={`${toolButton} flex-1 ${selected === 'cursor' || selected === 'crosshair' ? 'bg-slate-800 text-slate-100' : ''}`}><Icon name={lastUsed.navigation === 'crosshair' ? 'crosshair' : 'cursor'} className="h-4 w-4"/></button>
      <button type="button" aria-label="Show Cursor and Crosshair menu" title="Cursor and Crosshair" onClick={() => setOpenMenu(openMenu === 'navigation' ? null : 'navigation')} className="grid h-8 w-3 place-items-center rounded-r-md text-slate-500 opacity-0 transition hover:bg-slate-700 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 group-hover:opacity-100 group-focus-within:opacity-100"><Icon name="chevronRight" className="h-2 w-2"/></button>
      {flyout('navigation', 'Cursor / Crosshair', [{ tool: 'cursor', label: 'Cursor', icon: 'cursor' }, { tool: 'crosshair', label: 'Crosshair', icon: 'crosshair' }])}
    </div>
    {groups.map(group => {
      const active = group.items.some(item => item.tool === selected), main = group.items.find(item => item.tool === lastUsed[group.id]) ?? group.items[0]
      return <div key={group.id} className="group relative flex h-8 w-11 shrink-0 items-center rounded-md hover:bg-slate-800">
        <button type="button" aria-label={`${group.label} tools`} aria-pressed={active} title={main.label} data-tooltip={main.label} onClick={() => choose(main.tool, group.id)} className={`${toolButton} flex-1 ${active ? 'bg-slate-800 text-slate-100' : ''}`}><Icon name={main.icon} className="h-4 w-4"/></button>
        <button type="button" aria-label={`Show ${group.label} menu`} title={`Show ${group.label} menu`} onClick={() => setOpenMenu(openMenu === group.id ? null : group.id)} className="grid h-8 w-3 place-items-center rounded-r-md text-slate-500 opacity-0 transition hover:bg-slate-700 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 group-hover:opacity-100 group-focus-within:opacity-100"><Icon name="chevronRight" className="h-2 w-2"/></button>
        {flyout(group.id, group.label, group.items)}
      </div>
    })}
    <div className="group relative h-8 w-11 shrink-0">
      <button type="button" aria-label="More drawing controls" aria-pressed={openMenu === 'more'} title="More drawing controls" data-tooltip="More" onClick={() => { setOpenMenu(openMenu === 'more' ? null : 'more'); setConfirmClear(false) }} className={`${toolButton} mx-auto ${openMenu === 'more' ? 'bg-slate-800 text-slate-100' : ''}`}><Icon name="more" className="h-4 w-4"/></button>
      {openMenu === 'more' && <div className="drawing-flyout absolute left-0 top-10 z-50 w-56 rounded-lg border border-slate-700 bg-slate-900 p-1.5 shadow-2xl sm:left-11 sm:top-auto sm:bottom-0"><p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-slate-500">More</p><div className="px-1 pb-1"><p className="px-1 py-1 text-[9px] uppercase tracking-wide text-slate-600">Magnet</p><div className="flex gap-1">{(['off', 'weak', 'strong'] as MagnetMode[]).map(mode => <button key={mode} type="button" aria-pressed={magnet === mode} onClick={() => onMagnetChange?.(mode)} className={`min-h-7 rounded px-2 text-[10px] capitalize ${magnet === mode ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{mode}</button>)}</div></div><button type="button" disabled={!hasDrawings || !onToggleLockAll} aria-pressed={allDrawingsLocked} onClick={onToggleLockAll} className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-[11px] text-slate-300 hover:bg-slate-800 disabled:text-slate-600"><Icon name={allDrawingsLocked ? 'lock' : 'unlock'} className="h-3.5 w-3.5"/>Lock All Drawings</button><button type="button" disabled={!hasDrawings || !onToggleHideAll} aria-pressed={allDrawingsHidden} onClick={onToggleHideAll} className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-[11px] text-slate-300 hover:bg-slate-800 disabled:text-slate-600"><Icon name={allDrawingsHidden ? 'eyeOff' : 'eye'} className="h-3.5 w-3.5"/>Hide All Drawings</button>{confirmClear ? <div className="mt-1 rounded-md border border-rose-900/80 bg-rose-950/30 p-1.5"><p className="px-1 text-[10px] text-rose-200">Remove all drawings?</p><div className="mt-1 flex gap-1"><button type="button" aria-label="Confirm remove all drawings" onClick={() => { onClear?.(); setOpenMenu(null); setConfirmClear(false) }} className="rounded bg-rose-700 px-2 py-1 text-[10px] font-semibold text-white">Remove</button><button type="button" aria-label="Cancel remove all drawings" onClick={() => setConfirmClear(false)} className="rounded px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800">Cancel</button></div></div> : <button type="button" disabled={!hasDrawings || !onClear} onClick={() => setConfirmClear(true)} className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-[11px] text-rose-300 hover:bg-slate-800 disabled:text-slate-600"><Icon name="trash" className="h-3.5 w-3.5"/>Remove All Drawings</button>}</div>}
    </div>
  </aside>
}

async function chartPng() {
  const svg = document.querySelector<SVGSVGElement>('[data-chart-export] svg')
  if (!svg) throw new Error('No chart is available to capture.')
  const bounds = svg.getBoundingClientRect(), width = Math.max(320, Math.round(bounds.width || 1200)), height = Math.max(200, Math.round(bounds.height || 675))
  const copy = svg.cloneNode(true) as SVGSVGElement; copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); copy.setAttribute('width', String(width)); copy.setAttribute('height', String(height))
  const sourceUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' }))
  try { const image = new Image(); await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Chart capture failed.')); image.src = sourceUrl }); const canvas = document.createElement('canvas'); canvas.width = width * Math.min(window.devicePixelRatio || 1, 2); canvas.height = height * Math.min(window.devicePixelRatio || 1, 2); const context = canvas.getContext('2d'); if (!context) throw new Error('Chart capture is unavailable in this browser.'); context.scale(canvas.width / width, canvas.height / height); context.fillStyle = '#08090b'; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height); return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Chart capture failed.')), 'image/png')) } finally { URL.revokeObjectURL(sourceUrl) }
}

export function ChartUtilities({ hasChart, onRefresh, refreshing = false }: { hasChart: boolean; onRefresh?: () => void; refreshing?: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null); const [status, setStatus] = useState('')
  const run = async (action: 'download' | 'copy') => { setStatus('Preparing chart…'); try { const blob = await chartPng(); if (action === 'download') { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'quant-chart.png'; link.click(); URL.revokeObjectURL(url); setStatus('PNG downloaded.') } else { if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Image clipboard is unavailable in this browser.'); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); setStatus('Chart copied.') }; menu.current?.removeAttribute('open') } catch (error) { setStatus(error instanceof Error ? error.message : 'Chart capture failed.') } }
  return <div className="ml-auto flex items-center gap-1">{status && <span role="status" className="hidden max-w-40 truncate text-[10px] text-slate-500 lg:inline">{status}</span>}{onRefresh && <button type="button" aria-label="Refresh datasets" title="Refresh datasets" data-tooltip="Refresh" disabled={refreshing} onClick={onRefresh} className={toolButton}><Icon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}/></button>}<details ref={menu} className="relative"><summary aria-label="Chart capture and export" title="Chart capture and export" data-tooltip="Capture" className={`${toolButton} list-none cursor-pointer`}><Icon name="camera" className="h-4 w-4"/></summary><div className="absolute right-0 top-10 z-40 w-52 rounded-lg border border-slate-700 bg-slate-900 p-1.5 shadow-2xl"><p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-600">Chart capture</p><button type="button" disabled={!hasChart} onClick={() => void run('download')} className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-slate-300 hover:bg-slate-800 disabled:text-slate-600"><Icon name="download" className="h-4 w-4"/>Download PNG</button><button type="button" disabled={!hasChart} onClick={() => void run('copy')} className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-slate-300 hover:bg-slate-800 disabled:text-slate-600"><Icon name="copy" className="h-4 w-4"/>Copy to clipboard</button></div></details></div>
}
