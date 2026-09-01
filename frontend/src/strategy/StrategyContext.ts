import { createContext, useContext } from 'react'
import type * as api from './api'
import type { Generation } from './generationApi'

export type StrategyContextValue = {
  items: api.Brief[]; nextCursor: string | null; selected: api.Revision | null; title: string; draft: string; dirty: boolean
  busy: boolean; loading: boolean; listLoading: boolean; validating: boolean; uncertain: boolean; error: string; notice: string
  validation: api.Validation | null; versions: api.Brief[]; nextBefore: number | null; preview: api.Revision | null; historyLoading: boolean
  generation: Generation | null; generationBusy: boolean; generationUncertain: boolean; generationError: string
  edit: (field: 'title' | 'draft', value: string) => void; replace: (title: string, draft: string) => void
  select: (id: string) => Promise<void>; loadList: (more?: boolean) => Promise<void>; loadHistory: (more?: boolean) => Promise<void>
  inspect: (revision: number) => Promise<void>; closePreview: () => void; validate: () => Promise<void>
  create: (title: string) => Promise<boolean>; save: (mode: api.Status) => Promise<boolean>; retry: () => Promise<boolean>; remove: () => Promise<boolean>
  generateProposal: () => Promise<void>; checkGeneration: () => Promise<void>; acceptGeneration: () => Promise<void>; rejectGeneration: () => Promise<void>; cancelGeneration: () => Promise<void>
}
export const StrategyContext = createContext<StrategyContextValue | null>(null)
export const useStrategy = () => useContext(StrategyContext)
