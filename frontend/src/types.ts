export type ViewportMode = 'desktop' | 'tablet' | 'mobile'

export type WorkspaceTab =
  | 'chart'
  | 'strategy-dsl'
  | 'pine-script'
  | 'mql5'
  | 'backtest-results'
  | 'trades'

export type MobileView =
  | WorkspaceTab
  | 'ai-chat'
  | 'my-code'
  | 'trading-journal'
  | 'documents'
  | 'strategies'
  | 'settings'
  | 'account'

export type ChatMessage = {
  id: number
  role: 'assistant' | 'user'
  text: string
}

export type BacktestMetric = {
  label: string
  value: string
  detail: string
}

export type Trade = {
  id: string
  symbol: string
  side: 'Long' | 'Short'
  entry: string
  exit: string
  stopLoss: string
  takeProfit: string
  pnl: string
  result: 'Win' | 'Loss'
  time: string
}
