export type ChartType = 'candles' | 'bars' | 'line' | 'area'
export type DrawingTool =
  | 'cursor' | 'crosshair'
  | 'trend' | 'ray' | 'extended' | 'horizontal' | 'horizontalRay' | 'vertical' | 'cross' | 'parallelChannel'
  | 'fibRetracement' | 'fibExtension'
  | 'ruler' | 'priceRange' | 'dateRange' | 'datePriceRange' | 'longPosition' | 'shortPosition'
  | 'rectangle' | 'ellipse' | 'arrow' | 'brush' | 'polyline'
  | 'text' | 'note' | 'callout'
export type ChartPoint = { time: string; price: number }
export type Drawing = {
  id: string; type: Exclude<DrawingTool, 'cursor' | 'crosshair'>; points: ChartPoint[]; name?: string; text?: string; visible?: boolean; locked?: boolean
}
export type MagnetMode = 'off' | 'weak' | 'strong'
export type IndicatorConfig = { id: string; type: 'sma' | 'ema' | 'rsi'; period: number; color: string; visible: boolean }
export type ChartSettings = {
  chartType: ChartType
  showSymbol: boolean; showOhlc: boolean; showVolume: boolean; showPriceLine: boolean; showLastValue: boolean; showGrid: boolean
  showCrosshair: boolean; showIndicatorTitles: boolean; showIndicatorValues: boolean
  candleBorders: boolean; candleWicks: boolean
  bullColor: string; bearColor: string; background: string; gridColor: string; textColor: string; separatorColor: string
  spacing: number; timezone: 'UTC' | 'Asia/Ho_Chi_Minh' | 'America/New_York' | 'Europe/London'
}

export const defaultChartSettings: ChartSettings = {
  chartType: 'candles', showSymbol: true, showOhlc: true, showVolume: true, showPriceLine: true, showLastValue: true, showGrid: true,
  showCrosshair: true, showIndicatorTitles: true, showIndicatorValues: true,
  candleBorders: true, candleWicks: true, bullColor: '#3ca58c', bearColor: '#df5a60', background: '#141518', gridColor: '#2a2b2f', textColor: '#e4e1da', separatorColor: '#3a3b40', spacing: 65, timezone: 'UTC',
}

export const drawingLabels: Record<Exclude<DrawingTool, 'cursor' | 'crosshair'>, string> = {
  trend: 'Trend Line', ray: 'Ray', extended: 'Extended Line', horizontal: 'Horizontal Line', horizontalRay: 'Horizontal Ray', vertical: 'Vertical Line', cross: 'Cross Line', parallelChannel: 'Parallel Channel',
  fibRetracement: 'Fib Retracement', fibExtension: 'Fib Extension', ruler: 'Ruler', priceRange: 'Price Range', dateRange: 'Date Range', datePriceRange: 'Date & Price Range', longPosition: 'Long Position', shortPosition: 'Short Position',
  rectangle: 'Rectangle', ellipse: 'Ellipse', arrow: 'Arrow', brush: 'Brush', polyline: 'Polyline', text: 'Text', note: 'Note', callout: 'Callout',
}
