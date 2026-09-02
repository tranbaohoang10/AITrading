import type { MobileView } from '../types'
import { Icon } from './Icon'
import { brand } from '../brand'
import { Modal } from './Modal'

const primaryViews: Array<{ label: string; view: MobileView; icon: string }> = [
  { label: 'Assistant', view: 'ai-chat', icon: 'chat' },
  { label: 'Strategies', view: 'strategy-dsl', icon: 'code' },
  { label: 'Backtesting', view: 'backtest-results', icon: 'chart' },
  { label: 'Journal', view: 'trading-journal', icon: 'journal' },
  { label: 'Library', view: 'documents', icon: 'layers' },
  { label: 'Account', view: 'account', icon: 'user' },
]

const workspaceTools: Array<{ label: string; view: MobileView; icon: string }> = [
  { label: 'Chart', view: 'chart', icon: 'chart' },
  { label: 'Pine Script', view: 'pine-script', icon: 'code' },
  { label: 'MQL5', view: 'mql5', icon: 'code' },
  { label: 'Trades', view: 'trades', icon: 'journal' },
  { label: 'Image Analysis', view: 'image-analysis', icon: 'chart' },
]

export function NavigationDrawer({ open, activeView, onClose, onSelect }: { open: boolean; activeView: MobileView; onClose: () => void; onSelect: (view: MobileView) => void }) {
  if (!open) return null
  const select = (view: MobileView) => { onSelect(view); onClose() }
  const itemClass = (active: boolean) => `flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition ${active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`

  return <Modal open={open} label="Mobile navigation" onClose={onClose} testId="navigation-drawer">
    <aside className="relative h-full w-[min(86vw,312px)] overflow-y-auto border-r border-slate-800 bg-slate-950 p-3" aria-label="Mobile navigation">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3"><span className="quant-mark">{brand.initials}</span><div><p className="text-xs font-semibold text-slate-200">{brand.name}</p><h2 className="text-xs font-normal text-slate-500">Navigation</h2></div></div>
        <button type="button" aria-label="Close navigation" title="Close navigation" onClick={onClose} className="grid min-h-10 min-w-10 place-items-center rounded-md text-slate-400 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300"><Icon name="close" /></button>
      </div>
      <nav className="space-y-1" aria-label="Primary navigation">{primaryViews.map(item => <button key={item.view} type="button" onClick={() => select(item.view)} className={itemClass(activeView === item.view)}><Icon name={item.icon} className="h-4 w-4" />{item.label}</button>)}</nav>
      <details className="help-details mt-5"><summary>Workspace tools</summary><nav className="space-y-1 pb-2" aria-label="Workspace views">{workspaceTools.map(item => <button key={item.view} type="button" onClick={() => select(item.view)} className={itemClass(activeView === item.view)}><Icon name={item.icon} className="h-4 w-4" />{item.label}</button>)}</nav></details>
    </aside>
  </Modal>
}
