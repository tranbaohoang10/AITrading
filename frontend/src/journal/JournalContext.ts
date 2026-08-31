import { createContext, useContext } from 'react'
import type * as api from './api'
import type { CandlePage, Dataset } from '../market/api'

export type JournalState = {
  filter: api.Filter; report: api.Summary | null; items: api.Entry[]; nextCursor: string | null
  selected: api.Entry | null; draft: api.Input; dirty: boolean; busy: boolean; loading: boolean; reportLoading: boolean
  uncertain: boolean; error: string; notice: string; confirmation: string; datasets: Dataset[]
  chart: CandlePage | null; chartLoading: boolean; chartError: string; chartWarning: string
  edit: (field: keyof api.Input, value: string) => void; select: (id: string) => void; newEntry: () => void
  refresh: () => void; load: () => Promise<void>; applyFilter: (filter: api.Filter) => Promise<void>; more: () => Promise<void>
  save: () => Promise<void>; retry: () => Promise<void>; remove: () => void; confirm: () => void; cancel: () => void
  loadChart: (start?: number) => Promise<void>
}
export const JournalContext = createContext<JournalState | null>(null)
export const useJournal = () => useContext(JournalContext)
