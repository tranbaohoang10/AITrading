import { Icon } from './Icon'
import { brand } from '../brand'

export type NavigationItem = {
  label: string
  icon: string
  action: string
}

export const navigationItems: NavigationItem[] = [
  { label: 'Assistant', icon: 'chat', action: 'ai-chat' },
  { label: 'Strategies', icon: 'code', action: 'strategies' },
  { label: 'Backtesting', icon: 'chart', action: 'backtest-results' },
  { label: 'Journal', icon: 'journal', action: 'trading-journal' },
  { label: 'Library', icon: 'layers', action: 'documents' },
  { label: 'Account', icon: 'user', action: 'account' },
]

export function GlobalSidebar({ onNavigate, compact = false, activeAction = 'workspace' }: { onNavigate: (action: string) => void; compact?: boolean; activeAction?: string }) {
  return (
    <aside
      aria-label="Global navigation"
      data-testid={compact ? 'compact-sidebar' : 'global-sidebar'}
      className="flex h-screen w-[60px] shrink-0 flex-col items-center border-r border-slate-800 bg-slate-950 py-2"
    >
      <button type="button" className="quant-mark mb-4" title="Workspace" aria-label="Workspace" aria-current={activeAction === 'workspace' ? 'page' : undefined} onClick={() => onNavigate('workspace')}>
        {brand.initials}
      </button>
      <nav className="flex flex-1 flex-col items-center gap-1" aria-label="Primary">
        {navigationItems.map((item) => (
          <button
            key={item.action}
            type="button"
            aria-label={item.label}
            title={item.label}
            aria-current={activeAction === item.action ? 'page' : undefined}
            onClick={() => onNavigate(item.action)}
            className={`relative grid min-h-10 min-w-10 place-items-center rounded-md text-slate-600 transition hover:bg-slate-900 hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-slate-300 ${activeAction === item.action ? 'bg-slate-800 text-white after:absolute after:-left-2.5 after:h-4 after:w-px after:bg-slate-300' : ''}`}
          >
            <Icon name={item.icon} />
          </button>
        ))}
      </nav>
    </aside>
  )
}
