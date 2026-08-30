import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import {
  baselineMetrics,
  completedMetrics,
  completedTrades,
  generatedMql5,
  generatedPineScript,
  generatedStrategyDsl,
  initialMql5,
  initialPineScript,
  initialStrategyDsl,
} from '../data/mockData'
import type { BacktestMetric, ChatMessage, Trade, WorkspaceTab } from '../types'

type TradingState = {
  activeTab: WorkspaceTab
  prompt: string
  messages: ChatMessage[]
  generationStatus: 'idle' | 'loading' | 'error' | 'success'
  generationError: string
  strategyDsl: string
  pineScript: string
  mql5: string
  backtestStatus: 'idle' | 'loading' | 'complete'
  metrics: BacktestMetric[]
  trades: Trade[]
}

type Action =
  | { type: 'set-tab'; tab: WorkspaceTab }
  | { type: 'set-prompt'; prompt: string }
  | { type: 'generation-start'; prompt: string }
  | { type: 'generation-error'; message: string }
  | { type: 'generation-complete' }
  | { type: 'backtest-start' }
  | { type: 'backtest-complete' }

const initialState: TradingState = {
  activeTab: 'chart',
  prompt: '',
  messages: [
    { id: 1, role: 'assistant', text: 'Tell me the market idea you want to explore. I will prepare a read-only mock strategy for review.' },
  ],
  generationStatus: 'idle',
  generationError: '',
  strategyDsl: initialStrategyDsl,
  pineScript: initialPineScript,
  mql5: initialMql5,
  backtestStatus: 'idle',
  metrics: baselineMetrics,
  trades: [],
}

function reducer(state: TradingState, action: Action): TradingState {
  switch (action.type) {
    case 'set-tab':
      return { ...state, activeTab: action.tab }
    case 'set-prompt':
      return { ...state, prompt: action.prompt, generationError: '', generationStatus: state.generationStatus === 'error' ? 'idle' : state.generationStatus }
    case 'generation-start':
      return {
        ...state,
        generationStatus: 'loading',
        generationError: '',
        messages: [...state.messages, { id: Date.now(), role: 'user', text: action.prompt }],
      }
    case 'generation-error':
      return { ...state, generationStatus: 'error', generationError: action.message }
    case 'generation-complete':
      return {
        ...state,
        prompt: '',
        generationStatus: 'success',
        strategyDsl: generatedStrategyDsl,
        pineScript: generatedPineScript,
        mql5: generatedMql5,
        messages: [
          ...state.messages,
          { id: Date.now() + 1, role: 'assistant', text: 'Mock strategy generated from one Strategy DSL source. Review the three code tabs, then run Backtest separately when ready.' },
        ],
      }
    case 'backtest-start':
      return { ...state, backtestStatus: 'loading' }
    case 'backtest-complete':
      return { ...state, backtestStatus: 'complete', metrics: completedMetrics, trades: completedTrades, activeTab: 'backtest-results' }
  }
}

type TradingContextValue = TradingState & {
  setActiveTab: (tab: WorkspaceTab) => void
  setPrompt: (prompt: string) => void
  generateStrategy: () => void
  runBacktest: () => void
}

const TradingContext = createContext<TradingContextValue | null>(null)

export function TradingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const generationTimer = useRef<number | undefined>(undefined)
  const backtestTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => {
    window.clearTimeout(generationTimer.current)
    window.clearTimeout(backtestTimer.current)
    generationTimer.current = undefined
    backtestTimer.current = undefined
  }, [])

  const value = useMemo<TradingContextValue>(() => ({
    ...state,
    setActiveTab: (tab) => dispatch({ type: 'set-tab', tab }),
    setPrompt: (prompt) => {
      if (generationTimer.current === undefined) dispatch({ type: 'set-prompt', prompt })
    },
    generateStrategy: () => {
      if (generationTimer.current !== undefined) return
      const cleanPrompt = state.prompt.trim()
      if (!cleanPrompt) {
        dispatch({ type: 'generation-error', message: 'Describe a strategy before generating.' })
        return
      }
      if (cleanPrompt.length > 4000) {
        dispatch({ type: 'generation-error', message: 'Keep the strategy description within 4000 characters.' })
        return
      }
      dispatch({ type: 'generation-start', prompt: cleanPrompt })
      generationTimer.current = window.setTimeout(() => {
        generationTimer.current = undefined
        dispatch({ type: 'generation-complete' })
      }, 650)
    },
    runBacktest: () => {
      if (backtestTimer.current !== undefined) return
      dispatch({ type: 'backtest-start' })
      backtestTimer.current = window.setTimeout(() => {
        backtestTimer.current = undefined
        dispatch({ type: 'backtest-complete' })
      }, 800)
    },
  }), [state])

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>
}

export function useTrading() {
  const context = useContext(TradingContext)
  if (!context) throw new Error('useTrading must be used inside TradingProvider')
  return context
}
