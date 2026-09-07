import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { read, write, view, type ReplayView } from '../replay/api'
import { CandleChart } from '../market/CandleChart'

export function ReplayJournalContext({ id, onSource }: { id: string; onSource: (replay: boolean) => void }) {
  const auth = useAuth(), [data, setData] = useState<{ provider: string; instrument: string; timeframe: string; session: string; simulation: boolean; execution: { entryTime: string; exitTime: string; entry: number; exit: number; stop: number; target: number; ambiguity: string | null } } | null>(null)
  const [chart, setChart] = useState<ReplayView | null>(null), [error, setError] = useState('')
  useEffect(() => {
    let active = true
    if (!auth) return
    void read(auth.user.id, `/journal/${id}/provenance`).then(async raw => {
      const result = raw as { source: string; provenance: typeof data }
      if (!active) return
      onSource(result.source === 'REPLAY'); setData(result.provenance)
      if (result.source === 'REPLAY' && result.provenance) {
        try { const replay = view(await read(auth.user.id, `/replay/${result.provenance.session}`)); if (active) setChart(replay) }
        catch { if (active) setError('Saved Replay chart is currently unavailable. Execution facts are preserved.') }
      }
    }).catch(() => { if (active) setError('Cannot load saved provenance.') })
    return () => { active = false }
  }, [id, auth?.user.id])
  if (!data) return error ? <p className="text-xs text-amber-300">{error}</p> : null
  const execution = data.execution
  const markers = chart ? [{ time: execution.entryTime, kind: 'ENTRY', price: execution.entry }, { time: execution.exitTime, kind: 'EXIT', price: execution.exit }].map((m, id) => ({ id, kind: m.kind, price: m.price, barIndex: chart.candles.findIndex(c => c.time === m.time) })).filter(m => m.barIndex >= 0) : []
  return <div className="space-y-2 text-xs"><p>Source: Replay Trading · SIMULATION</p><p>{data.provider} · {data.instrument} · {data.timeframe}</p><p className="break-all">Session {data.session}</p><p>Entry {execution.entry} · Exit {execution.exit} · SL {execution.stop} · TP {execution.target}</p>{execution.ambiguity && <p className="text-amber-300">Both SL and TP touched: conservative stop-first execution.</p>}{error && <p>{error}</p>}{chart && <div className="flex h-80 flex-col"><CandleChart fitDrawingPrices page={{ dataset: { symbol: `${data.provider} ${data.instrument}` }, items: chart.candles }} timeframe={data.timeframe} dataSource="saved replay" markers={markers} drawings={[{ id: 'saved-sl', type: 'horizontal', locked: true, points: [{ time: execution.entryTime, price: execution.stop }] }, { id: 'saved-tp', type: 'horizontal', locked: true, points: [{ time: execution.entryTime, price: execution.target }] }]}/></div>}</div>
}

export function DailyNote({ date, zone, currency }: { date: string; zone: string; currency: string }) {
  const auth = useAuth(), [note, setNote] = useState(''), [version, setVersion] = useState(0), [ready, setReady] = useState(false), [status, setStatus] = useState('')
  const path = `/journal/day-note?${new URLSearchParams({ date, zone, currency })}`
  useEffect(() => {
    let active = true
    if (auth) void read(auth.user.id, path).then(raw => { if (active) { const v = raw as { note: string; version: number }; setNote(v.note); setVersion(v.version); setReady(true) } }).catch(() => { if (active) setStatus('Cannot load daily note.') })
    return () => { active = false }
  }, [auth?.user.id, path])
  return <div className="my-3 grid gap-2"><label className="text-xs">Daily note<textarea disabled={!ready} className="block min-h-20 w-full rounded border border-slate-700 bg-slate-950 p-2" value={note} maxLength={4000} onChange={e => setNote(e.target.value)}/></label><button disabled={!ready} onClick={async () => { if (!auth) return; setReady(false); try { const v = await write(auth.user.id, '/journal/day-note', { date, zone, currency, note, version }) as { version: number }; setVersion(v.version); setStatus('Daily note saved.') } catch { setStatus('Save failed or version changed. Your note is preserved; retry the unchanged note if the connection failed.') } finally { setReady(true) } }}>Save daily note</button><p className="text-xs" role="status">{status}</p></div>
}
