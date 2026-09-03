import { useContext, useState } from 'react'
import { brand } from '../brand'
import { useAuth } from '../auth/AuthContext'
import { ConversationContext } from '../chat/ConversationContext'
import { Icon } from './Icon'

export type NavigationItem = { label: string; icon: string; action: string }

export const navigationItems: NavigationItem[] = [
  { label: 'Assistant', icon: 'chat', action: 'ai-chat' }, { label: 'Strategies', icon: 'code', action: 'strategies' },
  { label: 'Backtesting', icon: 'chart', action: 'backtest-results' }, { label: 'Journal', icon: 'journal', action: 'trading-journal' },
  { label: 'Library', icon: 'layers', action: 'documents' }, { label: 'Account', icon: 'user', action: 'account' },
]

const groups: Array<{ label: string; items: NavigationItem[] }> = [
  { label: 'Trading', items: [{ label: 'Workspace', icon: 'workspace', action: 'workspace' }, { label: 'Strategies', icon: 'code', action: 'strategies' }, { label: 'Backtesting', icon: 'performance', action: 'backtest-results' }] },
  { label: 'Assistant', items: [{ label: 'Quant Assistant', icon: 'chat', action: 'ai-chat' }] },
  { label: 'Research', items: [{ label: 'Journal', icon: 'journal', action: 'trading-journal' }, { label: 'Library & Documents', icon: 'layers', action: 'documents' }, { label: 'Image Analysis', icon: 'image', action: 'image-analysis' }] },
]

export function GlobalSidebar({ onNavigate, compact = false, activeAction = 'workspace' }: { onNavigate: (action: string) => void; compact?: boolean; activeAction?: string }) {
  const [expanded, setExpanded] = useState(false)
  const chat = useContext(ConversationContext), auth = useAuth()
  const navigate = (action: string) => { onNavigate(action); setExpanded(false) }
  const initials = auth?.user.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'Q'
  return <>
    <aside aria-label="Global navigation" data-testid={compact ? 'compact-sidebar' : 'global-sidebar'} className="relative z-50 flex h-screen w-[52px] shrink-0 flex-col items-center border-r border-slate-800 bg-slate-950 py-2">
      <button type="button" className="quant-mark" title="Open Quant navigation" aria-label="Workspace" aria-expanded={expanded} aria-current={activeAction === 'workspace' ? 'page' : undefined} onClick={() => { onNavigate('workspace'); setExpanded(value => !value) }}>{brand.initials}</button>
    </aside>
    {expanded && <><button type="button" aria-label="Close Quant navigation" className="fixed inset-0 z-40 cursor-default bg-black/45" onClick={() => setExpanded(false)} /><aside aria-label="Expanded navigation" className="fixed bottom-0 left-[52px] top-0 z-50 flex w-[min(304px,calc(100vw-52px))] flex-col border-r border-slate-700 bg-[#0b0d10] shadow-2xl">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-3"><div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md border border-slate-700 text-[10px] font-bold text-slate-200">Q</span><span className="text-sm font-semibold tracking-tight text-slate-100">Quant</span></div><button type="button" aria-label="Close navigation panel" title="Close" onClick={() => setExpanded(false)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-800 hover:text-white"><Icon name="close" className="h-4 w-4"/></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">{groups.map(group => <section key={group.label} className="mb-4"><h2 className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[.16em] text-slate-600">{group.label}</h2><nav aria-label={group.label} className="space-y-0.5">{group.items.map(item => <button key={item.action} type="button" aria-current={activeAction === item.action ? 'page' : undefined} onClick={() => navigate(item.action)} className={`flex min-h-9 w-full items-center gap-2.5 rounded-md px-2 text-left text-xs transition ${activeAction === item.action ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'}`}><Icon name={item.icon} className="h-4 w-4"/><span className="min-w-0 flex-1 truncate">{item.label}</span><Icon name="chevronRight" className="h-3 w-3 text-slate-700"/></button>)}</nav></section>)}
        <section><div className="flex items-center justify-between px-2 pb-1.5"><h2 className="text-[9px] font-semibold uppercase tracking-[.16em] text-slate-600">Chats</h2><button aria-label="New chat" title="New chat" disabled={!chat || chat.busy} onClick={() => { void chat?.create(); navigate('ai-chat') }} className="grid h-6 w-6 place-items-center rounded text-slate-600 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-30"><Icon name="plus" className="h-3.5 w-3.5"/></button></div>{!chat && <p className="px-2 py-2 text-[10px] text-slate-700">Sign in to view chats</p>}{chat && !chat.items.length && <p className="px-2 py-2 text-[10px] text-slate-700">No saved conversations</p>}<nav aria-label="Recent chats" className="space-y-0.5">{chat?.items.slice(0, 8).map(item => <button key={item.id} disabled={chat.busy || chat.uncertain} aria-current={chat.selected?.id === item.id ? 'page' : undefined} onClick={() => { chat.select(item); navigate('ai-chat') }} className={`flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left ${chat.selected?.id === item.id ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-200'}`}><Icon name="chat" className="h-3.5 w-3.5 shrink-0"/><span className="min-w-0 flex-1 truncate text-[11px] font-medium">{item.title}</span></button>)}</nav></section>
      </div>
      <button type="button" onClick={() => navigate('account')} className="flex min-h-14 shrink-0 items-center gap-2.5 border-t border-slate-800 px-3 text-left hover:bg-slate-900"><span className="grid h-8 w-8 place-items-center rounded-full border border-slate-700 bg-slate-800 text-[10px] font-semibold text-slate-200">{initials}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-slate-200">{auth?.user.displayName ?? 'Account'}</span><span className="block truncate text-[10px] text-slate-600">{auth?.user.email ?? 'Profile & security'}</span></span><Icon name="settings" className="h-4 w-4 text-slate-600"/></button>
    </aside></>}
  </>
}
