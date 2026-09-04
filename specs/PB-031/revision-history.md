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
- Published follow-up implementation commit `374736c` directly to `origin/main`; final workflow status is recorded in Issue #32.
- Rebuilt drawing state around semantic candle-time and price anchors; added cursor-centered rAF wheel zoom, horizontal/vertical/diagonal pan, manual price viewport reset, compact OHLCV crosshair, click-click and drag drawing, editable handles, safe keyboard actions, and bounded undo/redo.
- Added grouped line/Fibonacci/measurement-position/shape/text flyouts with working common tools, explicit deferred advanced tools, magnet and persistent-draw modes, plus a rename/lock/hide/delete object tree.
- Added a vertically resizable RSI pane, live timezone clock, transient status toast, compact charcoal workspace strip, a 304px desktop assistant, and an auto-growing composer without an empty scrollbar.
- Direct browser comparison used the current LuxAlgo tab only as hierarchy/density reference. Actual Quant interaction confirmed 100→84-bar wheel zoom, RSI 92→100 keyboard resize, tool flyouts, object tree, timezone, settings, and deterministic synthetic data behavior.
- Fresh responsive captures at 1920×1080, 1440×900, 1024×768, and 390×844 all reported viewport-width equality and no document-level horizontal overflow.
- Final local quality evidence before publication: 31 files / 227 tests PASS with `npx vitest run --maxWorkers=1`; chart regression 16/16 PASS; lint, build, and diff check PASS. The default parallel suite exposed only resource-contention timeouts; the same files and full serial suite passed without weakening tests.

## 04/09/2026

- Re-ran direct LuxAlgo reference inspection and local synthetic-data browser QA at 1536×730; verified chart navigation, grouped flyouts, exclusive menus, common drawings, semantic anchors, Long/Short draft safety, RSI resizing, timezone, settings, object-tree deletion, undo/redo, status-line layout, and dark theme.
- Repaired incomplete Long/Short draft rendering so an in-progress three-anchor tool cannot dereference missing price points or blank the React workspace.
- Quality evidence: focused regression 7 files / 69 tests PASS; full frontend suite 31 files / 227 tests PASS; lint, production build, and diff check PASS.

## 04/09/2026 — Critical visual/chart correction pass

- Reworked the Quant chart viewport layout so time and price remain separate: horizontal time movement re-enters automatic visible-high/low fitting, while vertical/diagonal movement is the explicit manual price viewport and reset clears it.
- Moved status/OHLC/change/volume into the SVG canvas with a computed safe top inset; removed the permanent visible synthetic-sample row and retained provenance, window navigation, and deletion in compact toolbar popovers.
- Added a responsive single status renderer, in-canvas active-indicator legend with hover/focus controls, adaptive bottom time axis spacing, full-height chart flex sizing, and a warm neutral charcoal palette.
- Browser evidence: current open LuxAlgo Quant reference inspected directly; local `DEMO_USD` at 1536×730 verified with RSI, horizontal pan (no manual price state), vertical pan (manual price state), reset, status/legend geometry, no visible synthetic metadata row, and full canvas height. Existing PB-031 wheel evidence covers slow/fast zoom continuity and cursor anchoring (100 → 84 bars).
- Final quality evidence: full frontend suite 31 files / 227 tests PASS; focused market regression 16/16 PASS; `npm run lint` PASS; `npm run build` PASS; `git diff --check` PASS. Fresh viewport resizing was unavailable in the active browser-control surface; existing responsive captures remain the applicable evidence.
