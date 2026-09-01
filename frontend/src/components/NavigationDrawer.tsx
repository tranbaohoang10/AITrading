import type { MobileView } from '../types'
import { Icon } from './Icon'
import { navigationItems } from './GlobalSidebar'
import { brand } from '../brand'
import { Modal } from './Modal'

const workspaceViews: Array<{ label: string; view: MobileView; icon: string }> = [
  { label: 'AI Chat', view: 'ai-chat', icon: 'chat' },
  { label: 'Chart', view: 'chart', icon: 'chart' },
  { label: 'Strategy DSL', view: 'strategy-dsl', icon: 'code' },
  { label: 'Pine Script', view: 'pine-script', icon: 'code' },
  { label: 'MQL5', view: 'mql5', icon: 'code' },
  { label: 'Backtest Results', view: 'backtest-results', icon: 'chart' },
  { label: 'Trades', view: 'trades', icon: 'journal' },
]

const routeMap: Record<string, MobileView> = {
  workspace: 'chart',
  'ai-chat': 'ai-chat',
  'backtest-results': 'backtest-results',
  'my-code': 'my-code',
  'trading-journal': 'trading-journal',
  documents: 'documents',
  strategies: 'strategies',
  settings: 'settings',
  account: 'account',
}

export function NavigationDrawer({ open, activeView, onClose, onSelect }: { open: boolean; activeView: MobileView; onClose: () => void; onSelect: (view: MobileView) => void }) {
  if (!open) return null

  const select = (view: MobileView) => {
    onSelect(view)
    onClose()
  }

  return (
    <Modal open={open} label="Mobile navigation" onClose={onClose} testId="navigation-drawer">
      <aside className="relative h-full w-[min(88vw,340px)] overflow-y-auto border-r border-slate-700 bg-slate-950 p-4 " aria-label="Mobile navigation">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">{brand.name}</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Navigate</h2>
          </div>
          <button type="button" aria-label="Close navigation" title="Close navigation" onClick={onClose} className="grid min-h-11 min-w-11 place-items-center rounded-sm text-slate-300 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-400">
            <Icon name="close" />
          </button>
        </div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace views</p>
        <nav className="space-y-1" aria-label="Workspace views">
          {workspaceViews.map((item) => (
            <button key={item.view} type="button" onClick={() => select(item.view)} className={`flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm font-medium ${activeView === item.view ? 'bg-sky-400/15 text-sky-300' : 'text-slate-300 hover:bg-slate-800'}`}>
              <Icon name={item.icon} className="h-4 w-4" />{item.label}
            </button>
          ))}
        </nav>
        <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Platform</p>
        <nav className="space-y-1" aria-label="Platform navigation">
          {navigationItems.map((item) => (
            <button key={item.action} type="button" onClick={() => select(routeMap[item.action])} className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-sm font-medium text-slate-300 hover:bg-slate-800">
              <Icon name={item.icon} className="h-4 w-4" />{item.label}
            </button>
          ))}
        </nav>
      </aside>
    </Modal>
  )
}
