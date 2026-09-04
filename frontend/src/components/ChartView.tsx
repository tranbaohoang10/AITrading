import { LiveChart } from '../market/LiveChart'
import type { ReactNode } from 'react'

export function ChartView({ workspaceNavigation }: { workspaceNavigation?: ReactNode } = {}) {
  return <LiveChart workspaceNavigation={workspaceNavigation} />
}
