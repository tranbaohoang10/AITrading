import { LiveChart } from '../market/LiveChart'
import { useMemo, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { createMarketDataProvider } from '../market/MarketDataProviders'

export function ChartView({ workspaceNavigation }: { workspaceNavigation?: ReactNode } = {}) {
  const auth = useAuth()
  const provider = useMemo(() => createMarketDataProvider(auth?.user.id), [auth?.user.id])
  return <LiveChart workspaceNavigation={workspaceNavigation} provider={provider} />
}
