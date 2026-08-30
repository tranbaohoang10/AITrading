import { Icon } from './Icon'
import { brand } from '../brand'

export type NavigationItem = {
  label: string
  icon: string
  action: string
}

export const navigationItems: NavigationItem[] = [
  { label: 'Workspace', icon: 'workspace', action: 'workspace' },
  { label: 'AI Strategy', icon: 'chart', action: 'ai-chat' },
  { label: 'Backtest', icon: 'chart', action: 'backtest-results' },
  { label: 'My Code', icon: 'code', action: 'my-code' },
  { label: 'Trading Journal', icon: 'journal', action: 'trading-journal' },
  { label: 'Strategies', icon: 'layers', action: 'strategies' },
  { label: 'Settings', icon: 'settings', action: 'settings' },
  { label: 'Account', icon: 'user', action: 'account' },
]

export function GlobalSidebar({ onNavigate, compact = false, activeAction = 'workspace' }: { onNavigate: (action: string) => void; compact?: boolean; activeAction?: string }) {
  return (
    <aside
      aria-label="Global navigation"
      data-testid={compact ? 'compact-sidebar' : 'global-sidebar'}
      className="flex h-screen w-[68px] shrink-0 flex-col items-center border-r border-slate-800 bg-slate-950 py-4"
    >
      <div className="mb-6 grid h-10 w-10 place-items-center rounded-sm bg-sky-400 text-sm font-black text-slate-950" title={brand.name}>
        {brand.initials}
      </div>
      <nav className="flex flex-1 flex-col items-center gap-1" aria-label="Primary">
        {navigationItems.slice(0, 6).map((item) => (
          <button
            key={item.action}
            type="button"
            aria-label={item.label}
            title={item.label}
            aria-current={activeAction === item.action ? 'page' : undefined}
            onClick={() => onNavigate(item.action)}
            className={`grid min-h-11 min-w-11 place-items-center rounded-sm text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-sky-400 ${activeAction === item.action ? 'bg-slate-800 text-sky-300' : ''}`}
          >
            <Icon name={item.icon} />
          </button>
        ))}
      </nav>
      <div className="flex flex-col gap-1 border-t border-slate-800 pt-3">
        {navigationItems.slice(6).map((item) => (
          <button
            key={item.action}
            type="button"
            aria-label={item.label}
            title={item.label}
            onClick={() => onNavigate(item.action)}
            className="grid min-h-11 min-w-11 place-items-center rounded-sm text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Icon name={item.icon} />
          </button>
        ))}
      </div>
    </aside>
  )
}
