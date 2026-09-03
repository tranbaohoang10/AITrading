# PB-031 — Interactive Quant chart terminal controls

Issue: #32

## Scope

Refine the existing React frontend into an original, compact Quant trading terminal. Preserve every backend contract and all business/security semantics. This change is frontend-only and does not alter stored market data, backtest inputs, Strategy DSL, Pine, MQL5, RAG, journal, authentication, database, or Flyway behavior.

## Acceptance criteria

- **AC-01 — Expandable navigation:** the neutral Q rail opens a closeable navigation panel with Trading, Assistant, Research, Chats, and account destinations backed by existing features. It contains no credits, pricing, subscription, or installation UI.
- **AC-02 — Icon workspace navigation:** desktop DSL, Pine, MQL5, Backtest, and Trades navigation uses compact icon controls with accessible names and tooltips instead of a permanent large text tab row.
- **AC-03 — Dataset toolbar:** the real dataset chart exposes compact dataset/symbol, timeframe, chart type, layout, indicators, refresh, camera/export, and workspace controls.
- **AC-04 — Timeframes:** native timeframe remains authoritative. Compatible higher timeframes (1m, 5m, 15m, 30m, 1h, 4h, 1D) are aggregated for display only using deterministic UTC buckets. Lower or incompatible intervals are disabled with an explanation. No candles are fabricated.
- **AC-05 — Chart types and indicators:** candles, bars, line, and area use real OHLCV values. SMA, EMA, and RSI are deterministic client-side visual indicators that can be configured and removed. Unsupported footprint/TPO choices are visibly disabled and explained.
- **AC-06 — Drawing tools:** cursor/select, trend line, horizontal line, brush, text note, and ruler work on the SVG chart, with selection, deletion, clear, undo, and redo. Drawings are local session UI state only.
- **AC-07 — Chart settings:** a compact settings modal changes only effective display properties, including type, status values, price line/grid, candle appearance, colors, spacing, background, grid, and UTC display.
- **AC-08 — Layout and export:** layout menu identifies the active single-chart layout and honestly marks future multi-chart layouts unavailable. Camera menu retains working PNG download/copy and keeps unsupported send-to-chat disabled.
- **AC-09 — Shell polish:** chat history typography, profile initials, spacing, borders, hierarchy, and muted near-black palette form one coherent Quant terminal without copying LuxAlgo branding or assets.
- **AC-10 — Verification:** frontend tests, lint, and production build pass; the real app is inspected at 1920, 1440, 1024, and 390 widths, with key interactions exercised in-browser.

## Security and non-functional requirements

- Preserve CSRF, authentication, ownership, expected-account binding, request IDs, idempotency, retries, uncertain outcomes, and cancellation behavior.
- Do not introduce remote execution, enriched-data claims, live trading, or persistence claims.
- Avoid horizontal viewport overflow and retain keyboard/focus accessibility.
- Do not rerun TradingView Pine or MetaTrader MQL5 external validation.

## Definition of Done

All acceptance criteria are implemented and verified; frontend tests, lint, build, diff checks, responsive browser review, commit, push, and CI evidence are recorded. Any unrelated or pre-existing failure is reported without weakening tests.
