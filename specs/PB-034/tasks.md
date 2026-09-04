# PB-034 — Tasks and acceptance mapping

| ID | Work | Paths | AC |
| --- | --- | --- | --- |
| T1 | Replace production market provider with Coinbase neutral contract and tests | `frontend/src/market/liveMarket.ts`, `CoinbaseMarketDataProvider.ts`, tests | AC-01–04 |
| T2 | Integrate live selection, status and header source | `LiveChart.tsx`, `CandleChart.tsx`, `AssetIcon.tsx` | AC-01, AC-04–05, AC-07 |
| T3 | Preserve realtime viewport and implement price-axis drag/reset | `CandleChart.tsx` | AC-05–06 |
| T4 | Consolidate drawing rail with destructive confirmation | `ChartControls.tsx` | AC-07 |
| T5 | Run and record automated/public/browser evidence | `test-cases.md`, `revision-history.md`, `test-evidence/` | All |
