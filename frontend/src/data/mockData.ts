import type { BacktestMetric, Trade } from '../types'

export const initialStrategyDsl = `{
  "schemaVersion": "strategy-dsl.mock.v1",
  "strategyVersion": "mvp-demo-001",
  "name": "EMA Momentum Confirmation",
  "market": { "symbol": "BTCUSDT", "timeframe": "1h", "timezone": "UTC" },
  "signals": {
    "long": ["ema_fast crosses_above ema_slow", "rsi > 52"],
    "short": ["ema_fast crosses_below ema_slow", "rsi < 48"],
    "confirmation": "bar_close"
  },
  "risk": { "stopLossPercent": 1.2, "takeProfitPercent": 2.4, "riskPerTradePercent": 1 }
}`

export const generatedStrategyDsl = `{
  "schemaVersion": "strategy-dsl.mock.v1",
  "strategyVersion": "mvp-demo-002",
  "name": "Trend Pullback Confirmation",
  "market": { "symbol": "BTCUSDT", "timeframe": "1h", "timezone": "UTC" },
  "signals": {
    "long": ["close > ema_50", "rsi crosses_above 50"],
    "short": ["close < ema_50", "rsi crosses_below 50"],
    "confirmation": "bar_close"
  },
  "risk": { "stopLossPercent": 1.0, "takeProfitPercent": 2.0, "riskPerTradePercent": 0.75 }
}`

export const initialPineScript = `//@version=6
// Read-only mock derived from strategy-dsl.mock.v1 / mvp-demo-001
strategy("EMA Momentum Confirmation", overlay=true)
fast = ta.ema(close, 12)
slow = ta.ema(close, 26)
longSignal = ta.crossover(fast, slow) and ta.rsi(close, 14) > 52
if barstate.isconfirmed and longSignal
    strategy.entry("Long", strategy.long)`

export const generatedPineScript = `//@version=6
// Read-only mock derived from strategy-dsl.mock.v1 / mvp-demo-002
strategy("Trend Pullback Confirmation", overlay=true)
trend = ta.ema(close, 50)
momentum = ta.rsi(close, 14)
longSignal = close > trend and ta.crossover(momentum, 50)
if barstate.isconfirmed and longSignal
    strategy.entry("Long", strategy.long)`

export const initialMql5 = `// Read-only mock derived from strategy-dsl.mock.v1 / mvp-demo-001
void OnTick() {
  if (!IsNewClosedBar()) return;
  double fast = ReadEMA(12, 1);
  double slow = ReadEMA(26, 1);
  if (CrossedAbove(fast, slow)) SubmitMockSignal(ORDER_TYPE_BUY);
}`

export const generatedMql5 = `// Read-only mock derived from strategy-dsl.mock.v1 / mvp-demo-002
void OnTick() {
  if (!IsNewClosedBar()) return;
  double trend = ReadEMA(50, 1);
  double momentum = ReadRSI(14, 1);
  if (Close(1) > trend && CrossedAboveLevel(momentum, 50))
    SubmitMockSignal(ORDER_TYPE_BUY);
}`

export const baselineMetrics: BacktestMetric[] = [
  { label: 'Total Return', value: '—', detail: 'Run the mock backtest' },
  { label: 'Win Rate', value: '—', detail: 'No run yet' },
  { label: 'Max Drawdown', value: '—', detail: 'No run yet' },
  { label: 'Profit Factor', value: '—', detail: 'No run yet' },
  { label: 'Number of Trades', value: '0', detail: 'No run yet' },
]

export const completedMetrics: BacktestMetric[] = [
  { label: 'Total Return', value: '+18.42%', detail: '+$1,842 simulated' },
  { label: 'Win Rate', value: '61.8%', detail: '21 wins / 13 losses' },
  { label: 'Max Drawdown', value: '-6.31%', detail: 'Peak-to-trough' },
  { label: 'Profit Factor', value: '1.74', detail: 'Gross profit / loss' },
  { label: 'Number of Trades', value: '34', detail: 'Mock sample' },
]

export const completedTrades: Trade[] = [
  { id: 'T-1042', symbol: 'BTCUSDT', side: 'Long', entry: '64,280', exit: '65,440', stopLoss: '63,510', takeProfit: '65,820', pnl: '+$180.42', result: 'Win', time: '06 Aug · 14:00' },
  { id: 'T-1041', symbol: 'BTCUSDT', side: 'Short', entry: '65,120', exit: '64,630', stopLoss: '65,900', takeProfit: '63,560', pnl: '+$76.18', result: 'Win', time: '05 Aug · 09:00' },
  { id: 'T-1040', symbol: 'BTCUSDT', side: 'Long', entry: '64,740', exit: '64,080', stopLoss: '64,080', takeProfit: '66,060', pnl: '-$102.65', result: 'Loss', time: '04 Aug · 18:00' },
  { id: 'T-1039', symbol: 'BTCUSDT', side: 'Long', entry: '63,890', exit: '65,010', stopLoss: '63,120', takeProfit: '65,430', pnl: '+$174.09', result: 'Win', time: '03 Aug · 11:00' },
]

export const equityPoints = [34, 31, 38, 36, 45, 43, 54, 51, 63, 59, 70, 76, 72, 84, 91]
