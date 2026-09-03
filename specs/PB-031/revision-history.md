# PB-031 — Revision history

All timestamps use Asia/Ho_Chi_Minh.

## 03/09/2026

- Created the frontend-only specification, design notes, tasks, and test plan for Issue #32.
- Scope explicitly excludes backend, database, Flyway, authentication semantics, DSL/backtest/Pine/MQL5/cross-target/RAG/journal business logic.
- Implemented expandable Quant navigation, icon workspace navigation, real chart toolbar controls, UTC display aggregation, four honest OHLCV chart types, SMA/EMA/RSI, local drawing history, effective chart settings, layout disclosure, and camera/export UX.
- Browser-verified the running app against the current public LuxAlgo Quant reference using a synthetic local account and dataset.
- Responsive evidence: 1920×1080 (`scrollWidth=clientWidth=1920`), 1440×900 (`1440`), 1024×768 (`1024`, tablet), and 390×844 (`390`, mobile). The mobile toolbar wraps to 76.8px while the document remains overflow-free.
- Runtime interaction evidence: 100 native 1h candles aggregate to 25 visible 4h candles; line/area/bars/candles render; indicator, drawing/undo/delete, settings, layout, and export availability states were exercised.
- Quality evidence: `npm test -- --run --reporter=dot --no-file-parallelism` → 31 files / 225 tests PASS; `npm run lint` PASS; `npm run build` PASS; `git diff --check` PASS.
