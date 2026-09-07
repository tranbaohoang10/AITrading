import { LiveChart } from '../market/LiveChart'
import { useMemo, type ReactNode } from 'react'
import { useOpenReplay } from '../replay/ReplayHost'
import { useAuth } from '../auth/AuthContext'
import { createMarketDataProvider } from '../market/MarketDataProviders'

export function ChartView({ workspaceNavigation }: { workspaceNavigation?: ReactNode } = {}) {
  const auth = useAuth()
  const openReplay = useOpenReplay()
  const provider = useMemo(() => createMarketDataProvider(auth?.user.id), [auth?.user.id])
  return <div className="relative h-full min-h-0"><LiveChart workspaceNavigation={workspaceNavigation} provider={provider} />{auth && openReplay && <button className="absolute bottom-10 right-3 z-30 rounded border border-violet-700 bg-slate-950 px-3 py-1 text-xs text-violet-200" onClick={openReplay}>Replay</button>}</div>
}
