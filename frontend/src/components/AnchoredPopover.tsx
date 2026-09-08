import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function anchoredPosition(rect: Pick<DOMRect, 'left' | 'bottom'>, width: number) {
  return { left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(width, window.innerWidth - 16) - 8)), top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 48)) }
}

export function AnchoredPopover({ label, title = label, triggerContent, children, width = 280 }: {
  label: string; title?: string; triggerContent: ReactNode; width?: number
  children: (close: () => void) => ReactNode
}) {
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const close = () => { setPosition(null); trigger.current?.focus() }
  useEffect(() => {
    if (!position) return
    panel.current?.querySelector<HTMLElement>('select, input, button')?.focus()
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close() }
    const resize = () => close()
    window.addEventListener('pointerdown', outside); window.addEventListener('resize', resize)
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize) }
  }, [position])
  return <><button type="button" ref={trigger} aria-label={label} title={title} aria-haspopup="dialog" aria-expanded={!!position} className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-slate-200 hover:bg-slate-800/60 focus-visible:ring-2 ${position ? 'bg-slate-800/60' : ''}`} onClick={() => {
    if (position) close()
    else { const rect = trigger.current!.getBoundingClientRect(); setPosition(anchoredPosition(rect, width)) }
  }}>{triggerContent}</button>{position && createPortal(<div ref={panel} role="dialog" aria-label={title} className="fixed z-[100] overflow-auto rounded-lg border border-slate-600 bg-slate-900 p-3 text-slate-100 shadow-xl" style={{ ...position, width: Math.min(width, window.innerWidth - 16), maxHeight: window.innerHeight - position.top - 8 }} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
    if (event.key === 'Tab') {
      const items = [...panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)')]
      if (event.shiftKey && document.activeElement === items[0] || !event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); close() }
    }
  }}>{children(close)}</div>, document.body)}</>
}
