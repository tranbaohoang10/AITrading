import { memo } from 'react'
import { useChartClock } from './useChartClock'
import { formatChartDate } from './chartTimezone'

export const LivePriceAxisBadge = memo(function LivePriceAxisBadge({ price, x, y, width, color, timezone }: { price: string; x: number; y: number; width: number; color: string; timezone: string }) {
  const now = useChartClock()
  return <g data-testid="live-price-axis-badge" pointerEvents="none"><rect x={x} y={y} width={width} height={32} rx={2} fill={color} /><text x={x + 4} y={y + 12} fill="#f8f6f0" fontSize={10} fontFamily="monospace">{price}</text><text data-testid="price-clock" x={x + 4} y={y + 25} fill="#f8f6f0" fontSize={9} fontFamily="monospace">{formatChartDate(now, timezone, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</text></g>
})
