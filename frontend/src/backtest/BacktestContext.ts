import { createContext, useContext } from 'react'
import type * as api from './api'
import type { Brief, Revision } from '../strategy/api'
import type { Dataset } from '../market/api'

export type BacktestContextValue = {
  items: api.Job[]; selected: api.Job | null; result: api.Result | null; page: api.FrozenPage | null
  strategies: Brief[]; datasets: Dataset[]; versions: Brief[]; revision: Revision | null
  strategyId: string; datasetId: string; configured: boolean | null
  loading: boolean; busy: boolean; uncertain: boolean; error: string; chartError: string; chartLoading: boolean
  load: () => Promise<void>; select: (id: string) => Promise<void>; window: (start: number) => Promise<void>
  chooseStrategy: (id: string) => Promise<void>; chooseRevision: (version: number) => Promise<void>; chooseDataset: (id: string) => void
  start: () => Promise<void>; retry: () => Promise<void>; retryIntent: () => Promise<void>; cancel: () => Promise<void>; remove: () => Promise<void>
}
export const BacktestContext = createContext<BacktestContextValue | null>(null)
export const useBacktest = () => useContext(BacktestContext)
