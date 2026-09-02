import { Icon } from './Icon'
import { brand } from '../brand'

export type NavigationItem = {
  label: string
  icon: string
  action: string
}

export const navigationItems: NavigationItem[] = [
  { label: 'Workspace', icon: 'workspace', action: 'workspace' },
  { label: 'AI Strategy', icon: 'chat', action: 'ai-chat' },
  { label: 'Backtest', icon: 'chart', action: 'backtest-results' },
  { label: 'My Code', icon: 'code', action: 'my-code' },
  { label: 'Trading Journal', icon: 'journal', action: 'trading-journal' },
  { label: 'Documents', icon: 'layers', action: 'documents' },
  { label: 'Image Analysis', icon: 'chart', action: 'image-analysis' },
  { label: 'Strategies', icon: 'layers', action: 'strategies' },
  { label: 'Settings', icon: 'settings', action: 'settings' },
  { label: 'Account', icon: 'user', action: 'account' },
]

export function GlobalSidebar({ onNavigate, compact = false, activeAction = 'workspace' }: { onNavigate: (action: string) => void; compact?: boolean; activeAction?: string }) {
  return (
    <aside
      aria-label="Global navigation"
      data-testid={compact ? 'compact-sidebar' : 'global-sidebar'}
      className="flex h-screen w-[68px] shrink-0 flex-col items-center border-r border-slate-800 bg-slate-950 py-3"
    >
      <div className="quant-mark mb-5" title={brand.name} aria-label={brand.name}>
        {brand.initials}
      </div>
      <nav className="flex flex-1 flex-col items-center gap-1.5" aria-label="Primary">
        {navigationItems.slice(0, 6).map((item) => (
          <button
            key={item.action}
            type="button"
            aria-label={item.label}
            title={item.label}
            aria-current={activeAction === item.action ? 'page' : undefined}
            onClick={() => onNavigate(item.action)}
            className={`relative grid min-h-10 min-w-10 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-400 ${activeAction === item.action ? 'bg-slate-800 text-emerald-300 after:absolute after:-left-3.5 after:h-5 after:w-0.5 after:rounded-full after:bg-emerald-400' : ''}`}
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
            className="grid min-h-10 min-w-10 place-items-center rounded-md text-slate-500 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Icon name={item.icon} />
          </button>
        ))}
      </div>
    </aside>
  )
}
