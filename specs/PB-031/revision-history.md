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
- Published implementation commit `10e2e58f35077fa295eb2972c478ebf1b11f19af` directly to `origin/main` and verified the remote SHA.
- GitHub Actions run `33720875077`: frontend job PASS (lint, build, tests, and dependency audit). The overall workflow remains blocked by the pre-existing backend dependency audit for `org.apache.tomcat.embed:tomcat-embed-core:11.0.24` (`GHSA-9xv2-5v5q-p794`, `GHSA-gcx9-497g-6cp6`, `GHSA-h3x4-894j-xpx5`); backend source and dependencies were outside PB-031 and were not changed.
- Refined the terminal workspace with a Q-only permanent rail, vertical active-indicator controls, expanded real drawing tools, chart viewport zoom/pan/reset, compact chart/chat typography, real timezone rendering, and responsive overflow corrections.
- Follow-up runtime evidence covers desktop 1920×1080 and 1440×900, tablet 1024×768, and mobile 390×844. All reviewed document widths matched their viewport widths.
- Follow-up quality evidence: `npm test -- --run --reporter=dot --no-file-parallelism` → 31 files / 227 tests PASS; `npm run lint` PASS; `npm run build` PASS.
