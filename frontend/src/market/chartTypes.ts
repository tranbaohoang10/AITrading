export type ChartType = 'candles' | 'bars' | 'line' | 'area'
export type DrawingTool = 'cursor' | 'trend' | 'ray' | 'horizontal' | 'vertical' | 'rectangle' | 'arrow' | 'brush' | 'text' | 'ruler'
export type Point = { x: number; y: number }
export type Drawing = { id: string; type: Exclude<DrawingTool, 'cursor'>; points: Point[]; text?: string }
export type IndicatorConfig = { id: string; type: 'sma' | 'ema' | 'rsi'; period: number; color: string; visible: boolean }
export type ChartSettings = {
  chartType: ChartType
  showSymbol: boolean; showOhlc: boolean; showVolume: boolean; showPriceLine: boolean; showLastValue: boolean; showGrid: boolean
  candleBorders: boolean; candleWicks: boolean
  bullColor: string; bearColor: string; background: string; gridColor: string
  spacing: number; timezone: 'UTC' | 'Asia/Ho_Chi_Minh' | 'America/New_York' | 'Europe/London'
}

export const defaultChartSettings: ChartSettings = {
  chartType: 'candles', showSymbol: true, showOhlc: true, showVolume: true, showPriceLine: true, showLastValue: true, showGrid: true,
  candleBorders: true, candleWicks: true, bullColor: '#22c55e', bearColor: '#ef4444', background: '#080a0d', gridColor: '#20252d', spacing: 65, timezone: 'UTC',
}
