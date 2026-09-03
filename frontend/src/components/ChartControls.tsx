import { useRef, useState } from 'react'
import { Icon } from './Icon'
import type { DrawingTool, MagnetMode } from '../market/chartTypes'

type ToolItem = { tool?: DrawingTool; label: string; shortcut?: string; disabled?: boolean; reason?: string }
const groups: Array<{ id: string; label: string; icon: string; items: ToolItem[] }> = [
  { id: 'lines', label: 'Lines', icon: 'trend', items: [
    { tool: 'trend', label: 'Trend Line', shortcut: 'Alt + T' }, { tool: 'ray', label: 'Ray' }, { tool: 'extended', label: 'Extended Line' },
    { tool: 'horizontal', label: 'Horizontal Line', shortcut: 'Alt + H' }, { tool: 'horizontalRay', label: 'Horizontal Ray' }, { tool: 'vertical', label: 'Vertical Line', shortcut: 'Alt + V' },
    { tool: 'cross', label: 'Cross Line' }, { tool: 'parallelChannel', label: 'Parallel Channel' },
  ] },
  { id: 'fib', label: 'Fibonacci', icon: 'fib', items: [
    { tool: 'fibRetracement', label: 'Fib Retracement' }, { tool: 'fibExtension', label: 'Fib Extension' },
    { label: 'Fib Fan', disabled: true, reason: 'Requires verified fan geometry' }, { label: 'Gann Fan', disabled: true, reason: 'Deferred · advanced geometry' },
  ] },
  { id: 'patterns', label: 'Patterns', icon: 'pattern', items: [
    { label: 'ABCD Pattern', disabled: true, reason: 'Deferred · multi-anchor editing' }, { label: 'Head & Shoulders', disabled: true, reason: 'Deferred · multi-anchor editing' },
    { label: 'Elliott / Harmonics', disabled: true, reason: 'Deferred · advanced pattern library' },
  ] },
  { id: 'measure', label: 'Measure & Position', icon: 'ruler', items: [
    { tool: 'ruler', label: 'Ruler' }, { tool: 'priceRange', label: 'Price Range' }, { tool: 'dateRange', label: 'Date Range' }, { tool: 'datePriceRange', label: 'Date & Price Range' },
    { tool: 'longPosition', label: 'Long Position' }, { tool: 'shortPosition', label: 'Short Position' },
  ] },
  { id: 'shapes', label: 'Shapes', icon: 'shapes', items: [
    { tool: 'rectangle', label: 'Rectangle' }, { tool: 'ellipse', label: 'Ellipse' }, { tool: 'arrow', label: 'Arrow' }, { tool: 'brush', label: 'Brush' }, { tool: 'polyline', label: 'Polyline' },
    { label: 'Triangle / Path', disabled: true, reason: 'Deferred · multi-anchor editing' },
  ] },
  { id: 'text', label: 'Text & Notes', icon: 'text', items: [
    { tool: 'text', label: 'Text' }, { tool: 'note', label: 'Note' }, { tool: 'callout', label: 'Callout' },
  ] },
]

const toolButton = 'icon-tool grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-35'

export function ChartToolsRail({ selected: controlled, onSelect, canDelete = false, hasDrawings = false, onDelete, onClear, magnet = 'off', onMagnetChange, stayInMode = false, onToggleStay, onObjectTree }: {
  selected?: DrawingTool; onSelect?: (tool: DrawingTool) => void
  canDelete?: boolean; hasDrawings?: boolean
  onDelete?: () => void; onClear?: () => void
  magnet?: MagnetMode; onMagnetChange?: (mode: MagnetMode) => void; stayInMode?: boolean; onToggleStay?: () => void; onObjectTree?: () => void
} = {}) {
  const [local, setLocal] = useState<DrawingTool>('cursor')
  const selected = controlled ?? local
  const choose = (tool: DrawingTool, details?: HTMLDetailsElement | null) => { if (onSelect) onSelect(tool); else setLocal(tool); details?.removeAttribute('open') }
  return <aside aria-label="Chart tools" className="chart-tools flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-slate-800 bg-slate-925 px-1 sm:h-auto sm:w-10 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:px-0 sm:py-1.5">
    <button type="button" aria-label="Select" aria-pressed={selected === 'cursor'} title="Select" data-tooltip="Select · Esc" onClick={() => choose('cursor')} className={`${toolButton} ${selected === 'cursor' ? 'bg-slate-800 text-slate-100' : ''}`}><Icon name="cursor" className="h-4 w-4" /></button>
    {groups.map(group => <details key={group.id} className="group/tool relative shrink-0">
      <summary aria-label={`${group.label} tools`} title={`${group.label} tools`} data-tooltip={group.label} className={`${toolButton} list-none cursor-pointer ${group.items.some(item => item.tool === selected) ? 'bg-slate-800 text-slate-100' : ''}`}><Icon name={group.icon} className="h-4 w-4"/><Icon name="chevronRight" className="absolute bottom-0.5 right-0.5 h-2 w-2 opacity-50"/></summary>
      <div className="drawing-flyout absolute left-0 top-10 z-50 w-64 rounded-lg border border-slate-700 bg-[#17191e] p-1.5 shadow-2xl sm:left-10 sm:top-0">
        <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[.14em] text-slate-600">{group.label}</p>
        {group.items.map(item => <button key={item.label} type="button" disabled={item.disabled} title={item.reason ?? item.label} aria-label={item.disabled ? `${item.label} unavailable` : item.label} onClick={event => item.tool && choose(item.tool, event.currentTarget.closest('details'))} className={`flex min-h-8 w-full items-center rounded-md px-2 text-left text-[11px] ${item.tool === selected ? 'bg-slate-700 text-white' : item.disabled ? 'text-slate-600' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><span>{item.label}</span>{item.shortcut && <span className="ml-auto font-mono text-[9px] text-slate-600">{item.shortcut}</span>}{item.disabled && <span className="ml-auto text-[9px]">Soon</span>}</button>)}
      </div>
    </details>)}
    <span className="mx-1 h-5 w-px shrink-0 bg-slate-800 sm:my-1 sm:h-px sm:w-5" aria-hidden="true" />
    <details className="relative shrink-0"><summary aria-label="Drawing utilities" title="Drawing utilities" data-tooltip="Utilities" className={`${toolButton} list-none cursor-pointer`}><Icon name="magnet" className="h-4 w-4"/><Icon name="chevronRight" className="absolute bottom-0.5 right-0.5 h-2 w-2 opacity-50"/></summary><div className="drawing-flyout absolute left-0 top-10 z-50 w-60 rounded-lg border border-slate-700 bg-[#17191e] p-1.5 shadow-2xl sm:left-10 sm:top-auto sm:bottom-0">
      <button type="button" onClick={event => { onObjectTree?.(); event.currentTarget.closest('details')?.removeAttribute('open') }} className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-[11px] text-slate-300 hover:bg-slate-800"><Icon name="layers" className="h-3.5 w-3.5"/>Object Tree</button>
      <button type="button" disabled={!canDelete} onClick={onDelete} className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-[11px] text-slate-300 hover:bg-slate-800 disabled:text-slate-600"><Icon name="trash" className="h-3.5 w-3.5"/>Delete selected <span className="ml-auto font-mono text-[9px]">Del</span></button>
      <button type="button" disabled={!hasDrawings} onClick={onClear} className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-[11px] text-slate-300 hover:bg-slate-800 disabled:text-slate-600"><Icon name="close" className="h-3.5 w-3.5"/>Clear drawings</button>
      <div className="my-1 border-t border-slate-700"/><p className="px-2 py-1 text-[9px] uppercase tracking-wider text-slate-600">Magnet</p>
      <div className="grid grid-cols-3 gap-1">{(['off', 'weak', 'strong'] as MagnetMode[]).map(mode => <button key={mode} type="button" aria-pressed={magnet === mode} onClick={() => onMagnetChange?.(mode)} className={`min-h-7 rounded text-[9px] capitalize ${magnet === mode ? 'bg-slate-700 text-white' : 'bg-slate-900 text-slate-500 hover:text-slate-200'}`}>{mode}</button>)}</div>
      <button type="button" aria-pressed={stayInMode} onClick={onToggleStay} className={`mt-1 flex min-h-8 w-full items-center rounded-md px-2 text-[11px] ${stayInMode ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>Stay in drawing mode<span className="ml-auto">{stayInMode ? 'On' : 'Off'}</span></button>
    </div></details>
  </aside>
}

async function chartPng() {
  const svg = document.querySelector<SVGSVGElement>('[data-chart-export] svg')
  if (!svg) throw new Error('No chart is available to capture.')
  const bounds = svg.getBoundingClientRect()
  const width = Math.max(320, Math.round(bounds.width || 1200))
  const height = Math.max(200, Math.round(bounds.height || 675))
  const copy = svg.cloneNode(true) as SVGSVGElement
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('width', String(width))
  copy.setAttribute('height', String(height))
  const source = new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' })
  const sourceUrl = URL.createObjectURL(source)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Chart capture failed.')); image.src = sourceUrl })
    const canvas = document.createElement('canvas')
    canvas.width = width * Math.min(window.devicePixelRatio || 1, 2)
    canvas.height = height * Math.min(window.devicePixelRatio || 1, 2)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Chart capture is unavailable in this browser.')
    context.scale(canvas.width / width, canvas.height / height)
    context.fillStyle = '#08090b'; context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Chart capture failed.')), 'image/png'))
  } finally { URL.revokeObjectURL(sourceUrl) }
}

export function ChartUtilities({ hasChart, onRefresh, refreshing = false }: { hasChart: boolean; onRefresh?: () => void; refreshing?: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null)
  const [status, setStatus] = useState('')
  const run = async (action: 'download' | 'copy') => {
    setStatus('Preparing chart…')
    try {
      const blob = await chartPng()
      if (action === 'download') {
        const url = URL.createObjectURL(blob), link = document.createElement('a')
        link.href = url; link.download = 'quant-chart.png'; link.click(); URL.revokeObjectURL(url)
        setStatus('PNG downloaded.')
      } else {
        if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Image clipboard is unavailable in this browser.')
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setStatus('Chart copied.')
      }
      menu.current?.removeAttribute('open')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Chart capture failed.') }
  }
  return <div className="ml-auto flex items-center gap-1">
    {status && <span role="status" className="hidden max-w-40 truncate text-[10px] text-slate-500 lg:inline">{status}</span>}
    {onRefresh && <button type="button" aria-label="Refresh datasets" title="Refresh datasets" data-tooltip="Refresh" disabled={refreshing} onClick={onRefresh} className={toolButton}><Icon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button>}
    <details ref={menu} className="relative">
      <summary aria-label="Chart capture and export" title="Chart capture and export" data-tooltip="Capture" className={`${toolButton} list-none cursor-pointer`}><Icon name="camera" className="h-4 w-4" /></summary>
      <div className="absolute right-0 top-10 z-40 w-52 rounded-lg border border-slate-700 bg-slate-900 p-1.5 shadow-2xl">
        <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[.12em] text-slate-600">Chart capture</p>
        <button type="button" disabled={!hasChart} onClick={() => void run('download')} className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-slate-300 hover:bg-slate-800 disabled:text-slate-600"><Icon name="download" className="h-4 w-4" />Download PNG</button>
        <button type="button" disabled={!hasChart} onClick={() => void run('copy')} className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-slate-300 hover:bg-slate-800 disabled:text-slate-600"><Icon name="copy" className="h-4 w-4" />Copy to clipboard</button>
        <button type="button" disabled title="Chart image attachments are not supported yet" className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-slate-600"><Icon name="send" className="h-4 w-4" />Send to chat <span className="ml-auto text-[9px]">Soon</span></button>
      </div>
    </details>
  </div>
}
