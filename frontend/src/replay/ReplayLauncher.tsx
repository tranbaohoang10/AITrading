import { AnchoredPopover } from '../components/AnchoredPopover'

export type ReplayLaunch = { provider: string; instrument: string; timeframe: string; from: string; to: string; initialBalance: string; commissionBps: string; slippageBps: string }

export function ReplayLauncher({ selecting, selectedTime, onSelectStart, onCancel }: { selecting: boolean; selectedTime?: string; onSelectStart: () => void; onCancel: () => void }) {
  return <AnchoredPopover label="Open Bar Replay" title="Bar Replay" width={340} triggerContent={<svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 4v16M8 16V9m4 7V5m4 8V7M8 20h7"/><path d="m17 14 5 3.5-5 3.5Z"/></svg>}>
    {close => <div className="grid gap-3 text-xs"><strong>Bar Replay · Simulation</strong><p className="text-slate-400">Choose the starting candle directly on the chart. Candles to its right are marked as unrevealed before Replay starts.</p>{selectedTime && <p>Selected: <strong>{new Date(selectedTime).toLocaleString()}</strong></p>}<button className="rounded border border-slate-600 px-3 py-2 hover:bg-slate-800" onClick={() => { onSelectStart(); close() }}>{selecting ? 'Choose another candle' : 'Select start on chart'}</button>{(selecting || selectedTime) && <button className="rounded border border-slate-700 px-3 py-2 hover:bg-slate-800" onClick={() => { onCancel(); close() }}>Cancel Replay selection</button>}</div>}
  </AnchoredPopover>
}
