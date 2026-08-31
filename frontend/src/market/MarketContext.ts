import { createContext, useContext } from 'react'
import type { CandlePage, Dataset, ImportDraft } from './api'

export type MarketState = {
  items: Dataset[]; nextCursor: string | null; selected: Dataset | null; page: CandlePage | null
  window: number; busy: boolean; uncertain: boolean; listLoading: boolean; pageLoading: boolean
  listError: string; pageError: string; mutationError: string; notice: string
  select: (item: Dataset) => void; loadList: (more?: boolean) => Promise<void>
  loadPage: (start?: number) => Promise<void>; setWindow: (size: number) => void
  importData: (draft?: ImportDraft) => Promise<boolean>; remove: () => Promise<boolean>
}
export const MarketContext = createContext<MarketState | null>(null)
export function useMarket() { return useContext(MarketContext) }
