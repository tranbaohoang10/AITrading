export function AssetIcon({ symbol }: { symbol: string }) {
  const base = symbol.split('-')[0]
  if (base === 'BTC') return <span role="img" aria-label="Bitcoin" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#f7931a] text-[13px] font-bold leading-none text-white">₿</span>
  if (base === 'ETH') return <span role="img" aria-label="Ethereum" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#627eea] text-[11px] font-bold leading-none text-white">Ξ</span>
  return <span aria-hidden="true" className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-700 text-[9px] font-bold text-slate-100">{base.slice(0, 2)}</span>
}
