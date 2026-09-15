import { approvedCryptoIconBases, SymbolIcon } from '../components/SymbolIcon'

const forexBases = new Set(['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'JPY', 'NZD', 'USD'])
const commodityBases = new Set(['GOLD', 'SILVER', 'PLATINUM', 'PALLADIUM', 'XAU', 'XAG', 'XPT', 'XPD', 'USOIL'])
const cryptoBases = new Set<string>(approvedCryptoIconBases)

export function AssetIcon({ symbol }: { symbol: string }) {
  const value = (symbol.split(' · ').at(-1) ?? symbol).replace(/^[A-Z]+:/i, '').trim()
  const pair = value.replace(/[-/\s]/g, '').toUpperCase()
  const [baseValue = '', quoteValue = ''] = value.includes('/') || value.includes('-') ? value.split(/[-/]/) : pair.length === 6 ? [pair.slice(0, 3), pair.slice(3)] : [pair]
  const base = baseValue.toUpperCase()
  const quote = quoteValue.toUpperCase()
  const assetClass = forexBases.has(base) && forexBases.has(quote) ? 'FOREX' : commodityBases.has(base) ? 'COMMODITY' : cryptoBases.has(base) ? 'CRYPTO' : 'STOCK'
  return <SymbolIcon instrument={{ symbol, base, quote, name: base, assetClass }} />
}
