import { SymbolIcon } from '../components/SymbolIcon'
export function AssetIcon({ symbol }: { symbol: string }) {
  const base = symbol.split(' · ').at(-1)!.split(/[-/]/)[0]
  return <SymbolIcon instrument={{ symbol, base, name: base, assetClass: symbol.includes('/') || symbol.includes('-') ? 'CRYPTO' : 'STOCK' }} />
}
