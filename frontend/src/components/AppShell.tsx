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
import { useStrategy } from '../strategy/StrategyContext'
import { StrategyEditor } from '../strategy/StrategyEditor'
import { useJournal } from '../journal/JournalContext'
import { JournalWorkspace } from '../journal/JournalWorkspace'
import { PineWorkspace } from '../pine/PineWorkspace'
import { Mql5Workspace } from '../mql5/Mql5Workspace'
import { DocumentWorkspace } from '../document/DocumentWorkspace'
import { ImageAnalysisWorkspace } from '../image/ImageAnalysisWorkspace'


const mobileTitles: Record<MobileView, string> = {
  'ai-chat': 'Assistant', chart: 'Chart', 'strategy-dsl': 'Strategy DSL', 'pine-script': 'Pine Script', mql5: 'MQL5',
  'backtest-results': 'Backtest Results', trades: 'Trades', 'my-code': 'My Code', 'trading-journal': 'Trading Journal',
  strategies: 'Strategies', documents: 'Documents', 'image-analysis': 'Image Analysis', settings: 'Settings', account: 'Account',
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
    const resize = (event: MouseEvent) => setChatWidth(Math.min(420, Math.max(320, event.clientX)))
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
        <div style={{ width: chatWidth }} className="h-full shrink-0"><AiChat onGenerateFromImage={() => setPlatformView('image-analysis')} onOpenNavigation={() => setDrawerOpen(true)} /></div>
        <div
          role="separator"
          aria-label="Resize AI Chat"
          aria-orientation="vertical"
          aria-valuemin={320}
          aria-valuemax={420}
          aria-valuenow={chatWidth}
          tabIndex={0}
          onMouseDown={() => setResizing(true)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') setChatWidth((width) => Math.max(320, width - 8))
            if (event.key === 'ArrowRight') setChatWidth((width) => Math.min(420, width + 8))
          }}
          className="group relative w-px shrink-0 cursor-col-resize bg-slate-800 hover:bg-slate-600 focus-visible:bg-slate-400 focus-visible:outline-none"
        />
        {platformView ? <div className="min-w-0 flex-1"><MobileContent view={platformView} onNavigate={setPlatformView} /></div> : <TradingWorkspace mode={mode} onNavigate={navigateDesktop} />}
        <NavigationDrawer open={drawerOpen} activeView={platformView ?? 'chart'} onClose={() => setDrawerOpen(false)} onSelect={view => { setDrawerOpen(false); navigateDesktop(view) }} />
      </div>
    )
  }

  if (mode === 'tablet') {
    return (
      <div data-layout="tablet" className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
        <GlobalSidebar compact onNavigate={navigateDesktop} activeAction={platformView ?? 'workspace'} />
        <div className="relative min-w-0 flex-1">
          <button type="button" aria-label="Open AI Chat" title="Open AI Chat" onClick={() => setTabletChatOpen(true)} className="absolute bottom-5 right-5 z-20 flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 shadow-xl hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300"><Icon name="chat" className="h-4 w-4" />Assistant</button>
          {platformView ? <MobileContent view={platformView} onNavigate={setPlatformView} /> : <TradingWorkspace mode={mode} onNavigate={navigateDesktop} />}
        </div>
        <Modal open={tabletChatOpen} label="AI Chat" onClose={() => setTabletChatOpen(false)} testId="tablet-chat-drawer">
          <div className="relative ml-auto h-full w-[min(440px,88vw)] border-l border-slate-700">
            <button type="button" aria-label="Close AI Chat" title="Close AI Chat" onClick={() => setTabletChatOpen(false)} className="absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-md bg-slate-800 text-slate-300 hover:text-white focus-visible:ring-2 focus-visible:ring-slate-300"><Icon name="close" className="h-4 w-4" /></button><AiChat onGenerateFromImage={() => { setTabletChatOpen(false); setPlatformView('image-analysis') }} />
          </div>
        </Modal>
      </div>
    )
  }

  return (
    <div data-layout="mobile" className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <header className="flex min-h-14 items-center justify-between border-b border-slate-800 px-2">
        <button type="button" aria-label="Open navigation" title="Open navigation" onClick={() => setDrawerOpen(true)} className="grid min-h-10 min-w-10 place-items-center rounded-md text-slate-400 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-300"><Icon name="menu" /></button>
        <div className="text-center"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{brand.name}</p><h1 className="text-xs font-semibold text-white">{mobileTitles[mobileView]}</h1></div>
        <span className="h-11 w-11" aria-hidden="true" />
      </header>
      <NavigationDrawer open={drawerOpen} activeView={mobileView} onClose={() => setDrawerOpen(false)} onSelect={selectMobileView} />
      <main data-testid="mobile-active-view" data-view={mobileView} className="min-h-0 flex-1 overflow-hidden">
        <MobileContent view={mobileView} onNavigate={selectMobileView} />
      </main>
    </div>
  )
}

function MobileContent({ view, onNavigate }: { view: MobileView; onNavigate?: (view: MobileView) => void }) {
  const { strategyDsl, pineScript, mql5 } = useTrading()
  const strategy = useStrategy()
  const journal = useJournal()
  if (strategy && ['strategy-dsl', 'my-code', 'strategies'].includes(view)) return <StrategyEditor />
  switch (view) {
    case 'ai-chat': return <AiChat onGenerateFromImage={() => onNavigate?.('image-analysis')} />
    case 'chart': return <ChartView />
    case 'strategy-dsl': return <CodeViewer title="Strategy DSL" language="JSON · validated mock structure" code={strategyDsl} />
    case 'pine-script': return strategy ? <PineWorkspace /> : <CodeViewer title="Pine Script" language="Pine Script · read-only mock" code={pineScript} />
    case 'mql5': return strategy ? <Mql5Workspace /> : <CodeViewer title="MQL5" language="MQL5 · read-only mock" code={mql5} />
    case 'backtest-results': return <BacktestResults />
    case 'trades': return <TradesView mode="mobile" />
    case 'my-code': return <PlaceholderView title="My Code" />
    case 'trading-journal': return journal ? <JournalWorkspace /> : <PlaceholderView title="Trading Journal" />
    case 'documents': return <DocumentWorkspace />
    case 'image-analysis': return <ImageAnalysisWorkspace />
    case 'strategies': return <PlaceholderView title="Strategies" />
    case 'settings': return <PlaceholderView title="Settings" />
    case 'account': return <AccountView />
  }
}
