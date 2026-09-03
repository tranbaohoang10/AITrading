import type { WorkspaceTab } from '../types'
import { Icon } from './Icon'
import { useLayoutEffect } from 'react'

let pendingKeyboardFocus: WorkspaceTab | null = null

export const workspaceTabs: Array<{ id: WorkspaceTab; label: string; icon: string }> = [
  { id: 'chart', label: 'Chart', icon: 'chart' },
  { id: 'strategy-dsl', label: 'Strategy DSL', icon: 'code' },
  { id: 'pine-script', label: 'Pine Script', icon: 'pine' },
  { id: 'mql5', label: 'MQL5', icon: 'terminal' },
  { id: 'backtest-results', label: 'Backtest Results', icon: 'performance' },
  { id: 'trades', label: 'Trades', icon: 'list' },
]

export function WorkspaceNavigation({ activeTab, onChange }: { activeTab: WorkspaceTab; onChange: (tab: WorkspaceTab) => void }) {
  useLayoutEffect(() => {
    if (pendingKeyboardFocus !== activeTab) return
    document.getElementById(`tab-${activeTab}`)?.focus(); pendingKeyboardFocus = null
  }, [activeTab])
  return <div role="tablist" aria-label="Workspace views" className="flex shrink-0 items-center gap-0.5">
    {workspaceTabs.map((tab, index) => <button key={tab.id} role="tab" id={`tab-${tab.id}`} aria-controls={`panel-${tab.id}`} aria-label={tab.label} title={tab.label} data-tooltip={tab.label} aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1} type="button" onClick={() => onChange(tab.id)} onKeyDown={event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % workspaceTabs.length : event.key === 'ArrowLeft' ? (index + workspaceTabs.length - 1) % workspaceTabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? workspaceTabs.length - 1 : -1
      if (next < 0) return
      event.preventDefault(); pendingKeyboardFocus = workspaceTabs[next].id; onChange(workspaceTabs[next].id)
    }} className={`icon-tool grid h-8 w-8 place-items-center rounded-md transition focus-visible:ring-2 focus-visible:ring-slate-300 ${activeTab === tab.id ? 'bg-slate-800 text-slate-100' : 'text-slate-600 hover:bg-slate-900 hover:text-slate-300'}`}><Icon name={tab.icon} className="h-4 w-4" /></button>)}
  </div>
}
