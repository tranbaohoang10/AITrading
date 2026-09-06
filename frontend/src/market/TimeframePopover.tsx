import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TIMEFRAMES, timeframeLabel, type Timeframe } from './chartMath'

export function TimeframePopover({ value, eod, onChange }: { value: Timeframe; eod: boolean; onChange: (value: Timeframe) => void }) {
  const trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const close = () => { setPosition(null); trigger.current?.focus() }
  useEffect(() => {
    if (!position) return
    menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null) }
    const resize = () => { setPosition(null); trigger.current?.focus() }
    window.addEventListener('pointerdown', outside); window.addEventListener('resize', resize)
    return () => { window.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize) }
  }, [position])
  return <><button ref={trigger} aria-label="Timeframe" aria-haspopup="menu" aria-expanded={!!position} className="shrink-0 rounded px-2 py-2 text-xs text-slate-200 focus-visible:ring-2" onClick={() => { if (position) close(); else { const rect = trigger.current!.getBoundingClientRect(); setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 208)), top: Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 300)) }) } }}>{timeframeLabel(value)}</button>
    {position && createPortal(<div ref={menu} role="menu" aria-label="Timeframe choices" className="fixed z-[100] max-h-[calc(100dvh-16px)] w-48 overflow-y-auto rounded border border-slate-600 bg-slate-900 p-2 text-slate-100 shadow-xl" style={position} onKeyDown={event => {
      if (event.key === 'Escape' || event.key === 'Tab') { if (event.key === 'Escape') event.preventDefault(); close() }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const buttons = [...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')], index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus() }
    }}>{TIMEFRAMES.map(tf => <button key={tf} role="menuitemradio" aria-checked={tf === value} disabled={eod && tf !== '1d'} className="block min-h-8 w-full px-2 text-left text-xs focus-visible:ring-2 disabled:text-slate-500" onClick={() => { onChange(tf); close() }}>{timeframeLabel(tf)}</button>)}{eod && <p className="text-xs text-slate-400">ECB reference data is available in 1D only.</p>}</div>, document.body)}
  </>
}
