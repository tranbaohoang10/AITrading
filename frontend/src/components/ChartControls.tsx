import { useRef, useState } from 'react'
import { Icon } from './Icon'
import type { DrawingTool } from '../market/chartTypes'

const tools = [
  ['cursor', 'Select'],
  ['trend', 'Trend line'],
  ['horizontal', 'Horizontal line'],
  ['brush', 'Brush'],
  ['text', 'Text note'],
  ['ruler', 'Measure'],
] as const

const toolButton = 'icon-tool grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-35'

export function ChartToolsRail({ selected: controlled, onSelect, canUndo = false, canRedo = false, canDelete = false, hasDrawings = false, onUndo, onRedo, onDelete, onClear }: {
  selected?: DrawingTool; onSelect?: (tool: DrawingTool) => void
  canUndo?: boolean; canRedo?: boolean; canDelete?: boolean; hasDrawings?: boolean
  onUndo?: () => void; onRedo?: () => void; onDelete?: () => void; onClear?: () => void
} = {}) {
  const [local, setLocal] = useState<DrawingTool>('cursor')
  const selected = controlled ?? local
  const choose = (tool: DrawingTool) => { if (onSelect) onSelect(tool); else setLocal(tool) }
  return <aside aria-label="Chart tools" className="chart-tools flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-slate-800 bg-slate-925 px-1 sm:h-auto sm:w-10 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:px-0 sm:py-1.5">
    {tools.map(([name, label]) => <button key={name} type="button" aria-label={label} aria-pressed={selected === name} title={label} data-tooltip={label} onClick={() => choose(name)} className={`${toolButton} ${selected === name ? 'bg-slate-800 text-slate-100' : ''}`}><Icon name={name} className="h-4 w-4" /></button>)}
    <span className="mx-1 h-5 w-px shrink-0 bg-slate-800 sm:my-1 sm:h-px sm:w-5" aria-hidden="true" />
    <button type="button" disabled={!canUndo} aria-label="Undo drawing" title="Undo drawing" data-tooltip="Undo" onClick={onUndo} className={toolButton}><Icon name="undo" className="h-4 w-4" /></button>
    <button type="button" disabled={!canRedo} aria-label="Redo drawing" title="Redo drawing" data-tooltip="Redo" onClick={onRedo} className={toolButton}><Icon name="redo" className="h-4 w-4" /></button>
    <button type="button" disabled={!canDelete} aria-label="Delete selected drawing" title="Delete selected drawing" data-tooltip="Delete" onClick={onDelete} className={toolButton}><Icon name="trash" className="h-4 w-4" /></button>
    <button type="button" disabled={!hasDrawings} aria-label="Clear drawings" title="Clear drawings" data-tooltip="Clear" onClick={onClear} className={toolButton}><Icon name="close" className="h-4 w-4" /></button>
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
