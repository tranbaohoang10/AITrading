import type { Instrument } from './liveMarket'

export type CanonicalInstrument = { canonicalId: string; displaySymbol: string; name: string; assetClass: Instrument['assetClass']; routes: Instrument[] }
export function canonicalCatalog(instruments: Instrument[]): CanonicalInstrument[] {
  const catalog = new Map<string, CanonicalInstrument>()
  for (const instrument of instruments) {
    const displaySymbol = instrument.displaySymbol ?? instrument.symbol
    const canonicalId = `${instrument.assetClass}:${displaySymbol.replace(/[^A-Z0-9]/gi, '').toUpperCase()}`
    const current = catalog.get(canonicalId) ?? { canonicalId, displaySymbol, name: instrument.name, assetClass: instrument.assetClass, routes: [] }
    if (!current.routes.some(route => route.provider === instrument.provider && (route.providerSymbol ?? route.symbol) === (instrument.providerSymbol ?? instrument.symbol))) current.routes.push(instrument)
    catalog.set(canonicalId, current)
  }
  return [...catalog.values()]
}
