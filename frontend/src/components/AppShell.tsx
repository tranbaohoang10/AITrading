import { useEffect, useState } from 'react'
import { useTrading } from '../context/TradingContext'
import { useViewportMode } from '../hooks/useViewportMode'
import type { MobileView, WorkspaceTab } from '../types'
import { AiChat } from './AiChat'
import { BacktestResults } from './BacktestResults'
import { ChartView } from './ChartView'
import { CodeViewer } from './CodeViewer'
import { GlobalSidebar } from './GlobalSidebar'
import { Icon } from './Icon'
import { NavigationDrawer } from './NavigationDrawer'
import { PlaceholderView } from './PlaceholderView'
import { TradesView } from './TradesView'
import { TradingWorkspace } from './TradingWorkspace'
import { brand } from '../brand'
import { Modal } from './Modal'
import { AccountView } from '../auth/AccountView'

const mobileTitles: Record<MobileView, string> = {
  'ai-chat': 'AI Chat', chart: 'Chart', 'strategy-dsl': 'Strategy DSL', 'pine-script': 'Pine Script', mql5: 'MQL5',
  'backtest-results': 'Backtest Results', trades: 'Trades', 'my-code': 'My Code', 'trading-journal': 'Trading Journal',
  strategies: 'Strategies', settings: 'Settings', account: 'Account',
}

const workspaceViews: WorkspaceTab[] = ['chart', 'strategy-dsl', 'pine-script', 'mql5', 'backtest-results', 'trades']

export function AppShell() {
  const mode = useViewportMode()
  const trading = useTrading()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tabletChatOpen, setTabletChatOpen] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('chart')
  const [chatWidth, setChatWidth] = useState(360)
  const [resizing, setResizing] = useState(false)
  const [platformView, setPlatformView] = useState<MobileView | null>(null)

  useEffect(() => {
    if (!resizing) return
    const resize = (event: MouseEvent) => setChatWidth(Math.min(400, Math.max(320, event.clientX - 68)))
    const stop = () => setResizing(false)
    window.addEventListener('mousemove', resize)
    window.addEventListener('mouseup', stop)
    return () => { window.removeEventListener('mousemove', resize); window.removeEventListener('mouseup', stop) }
  }, [resizing])

  const navigateDesktop = (action: string) => {
    setPlatformView(null)
    if (action === 'ai-chat') {
      if (mode === 'tablet') setTabletChatOpen(true)
      else document.getElementById('strategy-prompt')?.focus()
    } else if (workspaceViews.includes(action as WorkspaceTab)) trading.setActiveTab(action as WorkspaceTab)
    else if (action === 'workspace') trading.setActiveTab('chart')
    else if (action in mobileTitles) setPlatformView(action as MobileView)
  }

  const selectMobileView = (view: MobileView) => {
    setMobileView(view)
    if (workspaceViews.includes(view as WorkspaceTab)) trading.setActiveTab(view as WorkspaceTab)
  }

  if (mode === 'desktop') {
    return (
      <div data-layout="desktop" className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
        <GlobalSidebar onNavigate={navigateDesktop} activeAction={platformView ?? 'workspace'} />
        <div style={{ width: chatWidth }} className="h-full shrink-0"><AiChat /></div>
        <div
          role="separator"
          aria-label="Resize AI Chat"
          aria-orientation="vertical"
          aria-valuemin={320}
          aria-valuemax={400}
          aria-valuenow={chatWidth}
          tabIndex={0}
          onMouseDown={() => setResizing(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') setChatWidth((width) => Math.max(320, width - 10))
            if (event.key === 'ArrowRight') setChatWidth((width) => Math.min(400, width + 10))
          }}
          className="group relative w-1 shrink-0 cursor-col-resize bg-slate-800 hover:bg-sky-400 focus-visible:bg-sky-400 focus-visible:outline-none"
        ><span className="absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-slate-600 group-hover:bg-sky-300" /></div>
        {platformView ? <div className="min-w-0 flex-1"><MobileContent view={platformView} /></div> : <TradingWorkspace mode={mode} />}
      </div>
    )
  }

  if (mode === 'tablet') {
    return (
      <div data-layout="tablet" className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
        <GlobalSidebar compact onNavigate={navigateDesktop} activeAction={platformView ?? 'workspace'} />
        <div className="relative min-w-0 flex-1">
          <button type="button" aria-label="Open AI Chat" title="Open AI Chat" onClick={() => setTabletChatOpen(true)} className="absolute bottom-5 right-5 z-20 flex min-h-12 items-center gap-2 rounded-sm bg-slate-400 px-4 text-sm font-bold text-slate-950  focus-visible:ring-2 focus-visible:ring-white"><Icon name="chat" />Chat</button>
          {platformView ? <MobileContent view={platformView} /> : <TradingWorkspace mode={mode} />}
        </div>
        <Modal open={tabletChatOpen} label="AI Chat" onClose={() => setTabletChatOpen(false)} testId="tablet-chat-drawer">
          <div className="relative ml-auto h-full w-[min(440px,88vw)] border-l border-slate-700">
            <button type="button" aria-label="Close AI Chat" title="Close AI Chat" onClick={() => setTabletChatOpen(false)} className="absolute right-3 top-3 z-10 grid min-h-11 min-w-11 place-items-center rounded-lg bg-slate-800 text-slate-200 focus-visible:ring-2 focus-visible:ring-sky-400"><Icon name="close" /></button><AiChat />
          </div>
        </Modal>
      </div>
    )
  }

  return (
    <div data-layout="mobile" className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex min-h-16 items-center justify-between border-b border-slate-800 px-3">
        <button type="button" aria-label="Open navigation" title="Open navigation" onClick={() => setDrawerOpen(true)} className="grid min-h-11 min-w-11 place-items-center rounded-sm text-slate-200 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-sky-400"><Icon name="menu" /></button>
        <div className="text-center"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-300">{brand.name}</p><h1 className="text-sm font-semibold text-white">{mobileTitles[mobileView]}</h1></div>
        <span className="h-11 w-11" aria-hidden="true" />
      </header>
      <NavigationDrawer open={drawerOpen} activeView={mobileView} onClose={() => setDrawerOpen(false)} onSelect={selectMobileView} />
      <main data-testid="mobile-active-view" data-view={mobileView} className="min-h-0 flex-1 overflow-hidden">
        <MobileContent view={mobileView} />
      </main>
    </div>
  )
}

function MobileContent({ view }: { view: MobileView }) {
  const { strategyDsl, pineScript, mql5 } = useTrading()
  switch (view) {
    case 'ai-chat': return <AiChat />
    case 'chart': return <ChartView />
    case 'strategy-dsl': return <CodeViewer title="Strategy DSL" language="JSON · validated mock structure" code={strategyDsl} />
    case 'pine-script': return <CodeViewer title="Pine Script" language="Pine Script · read-only mock" code={pineScript} />
    case 'mql5': return <CodeViewer title="MQL5" language="MQL5 · read-only mock" code={mql5} />
    case 'backtest-results': return <BacktestResults />
    case 'trades': return <TradesView mode="mobile" />
    case 'my-code': return <PlaceholderView title="My Code" />
    case 'trading-journal': return <PlaceholderView title="Trading Journal" />
    case 'strategies': return <PlaceholderView title="Strategies" />
    case 'settings': return <PlaceholderView title="Settings" />
    case 'account': return <AccountView />
  }
}
