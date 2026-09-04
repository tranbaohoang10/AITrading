# PB-038 — Tasks and acceptance mapping

| ID | Work | Paths | AC |
| --- | --- | --- | --- |
| T1 | Complete official provider discovery/audit and policy | `docs/market-data/free-provider-audit.md` | 01, 04 |
| T2 | Define neutral Instrument/Candle/provider contracts and precision/category policy | `frontend/src/market`, `backend/src/main/java/com/aitrading/market` | 02–05, 14 |
| T3 | Add bounded request cache/limiter/subscription sharing and Alpaca server adapter; fail closed without credentials | `backend/src/main/java/com/aitrading/market` | 03, 05, 17, 18 |
| T4 | Refactor live chart state/history and provider-dependent symbol search | `frontend/src/market/LiveChart.tsx`, `liveMarket.ts`, new search components | 02–05, 13, 18 |
| T5 | Fix full-height layouts, splitters, active-cell state and lazy multi-chart rendering | `frontend/src/market/LiveChart.tsx`, `frontend/src/styles.css` | 06, 18 |
| T6 | Implement density, candle sizing, right offset, future anchors, pointer zoom and realtime viewport preservation | `frontend/src/market/CandleChart.tsx`, `chartMath.ts` | 07, 08 |
| T7 | Complete drawing history keyboard/buttons and semantic future-coordinate rendering | `LiveChart.tsx`, `DatasetChart.tsx`, `CandleChart.tsx` | 08, 10, 16 |
| T8 | Replace indicator popup with library picker, favorites, aliases, categories and tested built-ins | `LiveChart.tsx`, `chartTypes.ts`, `chartMath.ts` | 11, 12, 16 |
| T9 | Add clock/timezone/settings/context-menu surfaces and working toolbar hierarchy | chart components, `styles.css` | 09, 15 |
| T10 | Add focused unit/component/security/regression tests and evidence | `frontend/src/market/*.test.*`, backend tests, this directory | all |
| T11 | Run lint/type-check/build/frontend/backend/security/browser QA; repair failures; update Issue/backlog/history | docs, evidence, `docs/product-backlog.md` | DoD |
