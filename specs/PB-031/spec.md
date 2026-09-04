# PB-031 — Interactive Quant chart terminal controls

Issue: #32

## Scope

Refine the existing React frontend into an original, compact Quant trading terminal. Preserve every backend contract and all business/security semantics. This change is frontend-only and does not alter stored market data, backtest inputs, Strategy DSL, Pine, MQL5, RAG, journal, authentication, database, or Flyway behavior.

## Acceptance criteria

- **AC-01 — Expandable navigation:** the neutral Q-only rail opens a closeable navigation panel with Trading, Assistant, Research, Chats, and an account area backed by existing features. Destinations already available in the drawer are not duplicated as permanent rail icons. It contains no credits, pricing, subscription, or installation UI.
- **AC-02 — Icon workspace navigation:** desktop DSL, Pine, MQL5, Backtest, and Trades navigation uses compact icon controls with accessible names and tooltips instead of a permanent large text tab row.
- **AC-03 — Dataset toolbar:** the real dataset chart exposes compact dataset/symbol, timeframe, chart type, layout, indicators, refresh, camera/export, and workspace controls.
- **AC-04 — Timeframes:** native timeframe remains authoritative. Compatible higher timeframes (1m, 5m, 15m, 30m, 1h, 4h, 1D) are aggregated for display only using deterministic UTC buckets. Lower or incompatible intervals are disabled with an explanation. No candles are fabricated.
- **AC-05 — Chart types and indicators:** candles, bars, line, and area use real OHLCV values. SMA, EMA, and RSI are deterministic client-side visual indicators. Active indicators appear as a vertical in-chart legend with short parameters, hide/show, and remove controls. Unsupported footprint/TPO choices are visibly disabled and explained.
- **AC-06 — Drawing tools:** cursor/select, trend line, ray, horizontal line, vertical line, rectangle zone, arrow, brush, text note, and ruler work on the SVG chart, with selection, deletion, clear, undo, and redo. Drawings are local session UI state only. More complex channel tools are visibly disabled until a complete interaction model exists.
- **AC-07 — Chart settings:** a compact settings modal changes only effective display properties, including type, status values, price line/grid, candle appearance, colors, spacing, background, grid, and UTC display.
- **AC-08 — Layout and export:** layout menu identifies the active single-chart layout and honestly marks future multi-chart layouts unavailable. Camera menu retains working PNG download/copy and keeps unsupported send-to-chat disabled.
- **AC-09 — Shell polish:** chat history typography, profile initials, spacing, borders, hierarchy, and muted near-black palette form one coherent Quant terminal without copying LuxAlgo branding or assets.
- **AC-10 — Verification:** frontend tests, lint, and production build pass; the real app is inspected at 1920, 1440, 1024, and 390 widths, with key interactions exercised in-browser.
- **AC-11 — Chart navigation:** wheel zoom, pointer-drag pan, keyboard zoom/pan/reset, and a responsive crosshair operate on the loaded deterministic candle window without requesting, fabricating, or persisting market data.

## Security and non-functional requirements

- Preserve CSRF, authentication, ownership, expected-account binding, request IDs, idempotency, retries, uncertain outcomes, and cancellation behavior.
- Do not introduce remote execution, enriched-data claims, live trading, or persistence claims.
- Avoid horizontal viewport overflow and retain keyboard/focus accessibility.
- Do not rerun TradingView Pine or MetaTrader MQL5 external validation.

## Definition of Done

All acceptance criteria are implemented and verified; frontend tests, lint, build, diff checks, responsive browser review, commit, push, and CI evidence are recorded. Any unrelated or pre-existing failure is reported without weakening tests.

## Phase A/B chart foundation and grouped research tools — 03/09/2026

- **AC-12 — Semantic anchors:** session-local drawings store time/bar identity plus price and are projected into the current viewport at render time.
- **AC-13 — Smooth navigation:** normalized requestAnimationFrame-batched wheel input zooms around the cursor while preserving the latest region when following it; pointer capture pans the main chart horizontally only, price-axis dragging is separate manual scaling, and reset restores time and auto-fit price.
- **AC-14 — Price viewport:** visible candles auto-fit by default; manual vertical pan uses a display-only price range and never mutates OHLCV.
- **AC-15 — Compact inspection:** the permanent previous/slider/next inspector and large OHLC block are removed; crosshair and a compact status line provide OHLCV inspection.
- **AC-16 — Grouped toolbox:** the rail exposes compact Lines, Fibonacci, Measure/Position, Shapes, Text, and Utilities flyouts. Unsupported advanced pattern, harmonic, Elliott, Gann, and pitchfork tools remain honestly disabled.
- **AC-17 — Common tools:** trend/ray/extended/horizontal/horizontal-ray/vertical/cross/parallel-channel, Fib retracement/extension, rectangle/ellipse/arrow/brush/polyline, text/note/callout, ruler/ranges, and long/short research positions render from semantic anchors.
- **AC-18 — Editing/history:** selection handles support anchor edits; Delete/Backspace, Escape, Ctrl+Z, Ctrl+Y/Ctrl+Shift+Z, and 0 work only when chart focus is safe; create/delete/edit participate in bounded local history.
- **AC-19 — Chart organization:** a lightweight object tree selects, hides, and deletes drawings and lists indicators; the compact vertical indicator legend remains available.
- **AC-20 — RSI and time:** RSI has a bounded draggable splitter; a live bottom-right clock opens the synchronized display-timezone menu.
- **AC-21 — Density:** desktop assistant defaults near 304px with a subtle resizer; the composer auto-grows from one line to five without an empty-state scrollbar; charcoal layers replace near-absolute black while green/red remain semantic.
- **AC-22 — Verification:** slow/fast zoom, 2D pan, reset, semantic drawings, keyboard actions, RSI resize, timezone, responsive widths, frontend tests, lint, build, and diff checks are evidenced before commit/push.
