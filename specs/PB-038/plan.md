# Implementation Plan: Chart toolbar, position setup, symbol catalog and time UX

**Branch**: `main` (Spec-kit logical feature `PB-038`) | **Date**: 07/09/2026 | **Spec**: [spec.md](spec.md)

**Input**: Product Owner refinement dated 07/09/2026 and six supplied screenshots.
This is a planning artifact only; this pass does not implement runtime code.

## Summary

Use the existing neutral Instrument/Candle and durable Replay services. Rework
only Chart Workspace entry points: top-toolbar Replay launcher, left-rail Position
Setup panel, provider-backed paginated Symbol Search and symbol icons, timeframe
trigger, simultaneous crosshair labels, and working timezone popover. TradingView
and LuxAlgo are interaction references; their code, icons and proprietary assets
are not copied.

## Technical Context

**Language/Version**: React + TypeScript + Vite; Spring Boot Java 21 where catalog/icon normalization needs backend work.

**Primary Dependencies**: Existing React/SVG renderer, Java HttpClient, Redis market cache and PostgreSQL Replay. Candidate static icon packs are accepted only after pinned-version license review; no chart library replacement.

**Storage**: Existing PostgreSQL Replay state. Chart display preference remains per chart cell unless existing preference persistence is reused. No migration is planned.

**Testing**: Vitest/Testing Library, Gradle Wrapper/JUnit, provider contract tests, Playwright real browser at 1440/1024/390.

**Target Platform**: Authenticated desktop-first web chart with tablet/mobile responsive behavior.

**Project Type**: React frontend plus Spring Boot provider API.

**Performance Goals**: Symbol search is debounced, cancellable and paginated; no full provider catalog in one DOM list; crosshair updates do not rerender the workspace; existing 20,000-candle bound remains.

**Constraints**: No TradingView/LuxAlgo asset scraping, no fake symbols/logos/lot semantics, no broker order, no Journal changes, no silent provider stitching, no frontend provider secret.

**Scale/Scope**: Seven requested Chart UX changes and accepted-provider catalog expansion only.

## Constitution Check

### Pre-research gate

- PASS — fixed React/TypeScript/Vite and Spring Boot/Java 21 stack retained.
- PASS — work is traced to open Issue #39; direct `main` workflow is authorized.
- PASS — provider data and images remain untrusted input behind validation,
  fixed-host allowlists, size/type bounds and truthful entitlement states.
- PASS — Replay remains historical simulation with no future candles or broker order.
- PASS — applied migrations and Journal semantics are untouched.

### Post-design gate

- PASS — plan extends current components and domain contracts rather than adding
  a second chart/replay engine.
- PASS — lot controls are conditional on verified instrument metadata; unsupported
  categories stay unavailable with an exact reason.
- PASS — all menus have keyboard, dismissal, focus-return and viewport-clamping contracts.
- PASS — browser/provider claims require actual responses; unavailable external
  entitlement is BLOCKED_EXTERNAL, never PASS.

## Current-state findings from screenshots and source

| Requested area | Current fact | Planned correction |
| --- | --- | --- |
| Replay | Detached text button at chart bottom-right opens a full-screen form | Top-toolbar Replay icon opens compact Day/Month launcher; existing workspace handles simulation after selection |
| Position setup | Long/Short drawing tools exist, but their properties are not exposed as one discoverable setup panel | New rail entry below `…`, one panel bound to the selected position drawing and Replay preview |
| Symbols/icons | Dynamic Coinbase/Alpaca calls exist, but UI starts with a small hardcoded list; only common crypto logos are handwritten | Provider catalog/search becomes authoritative; safe icon resolver and deterministic fallback |
| Timeframe | Portal prevents clipping, but trigger has no caret or hover background matching Symbol | Reuse top-toolbar trigger styling and chevron; rotate/announce open state |
| Crosshair | SVG already draws price and time labels | Prove actual visibility and repair edge clipping/z-order/pointer behavior; preserve simultaneous labels |
| Clock/timezone | Selector exists, but top-toolbar popup is positioned above its trigger with `bottom-9` | Shared fixed/portal popover positioned below trigger and clamped to viewport |

## Implementation phases

### P1 — Interaction contracts and failing tests

Add component/browser tests for toolbar placement, Day/Month mapping, rail panel,
timeframe hover/caret, clock click/select/focus return, and simultaneous crosshair
labels. Record current failures before changing runtime.

### P2 — Top-toolbar Replay launcher

Add an original backtest/replay SVG icon to the top toolbar near market controls.
The launcher offers exactly two start-range modes:

- **Day**: select one calendar day; map to UTC day start/end and provider coverage.
- **Month**: select one calendar month; map to its UTC month bounds and provider coverage.

Show source, symbol, timeframe and coverage status in the popover. Start uses the
existing `/api/replay` path and then opens the existing Replay workspace. Coverage
unknown/unavailable disables Start with a reason. Remove the detached button only
after equivalent resume/error behavior is covered.

### P3 — Left-rail Position Setup

Place a Position Setup icon below More on desktop; keep it reachable in the
horizontal mobile rail. Clicking it opens a viewport-clamped side panel containing:

- Long / Short segmented choice.
- Current available Replay balance and settlement currency.
- Entry: current revealed price or manual price.
- Size: Risk %; Lot only when `lotSize/pointValue/contractSize` are verified.
  Otherwise show Quantity and a visible `lot metadata unavailable` explanation.
- Stop Loss % and Take Profit % relative to entry, with computed prices.
- Read-only quantity, risk amount, reward amount and R:R preview.
- Confirm simulation through the existing idempotent Replay command.

The panel and chart drawing share one draft object. Dragging Entry/SL/TP updates
the panel; editing percentages updates the same drawing. A draft performs no API
write. An active position commits SL/TP once on pointer-up. No leverage is added
in this scope because it was not requested and the current engine disallows it.

### P4 — Symbol catalog and icon pipeline

Replace eager hardcoded-only display with bounded provider search pages. “All”
means every symbol exposed by an accepted/configured provider, not every financial
instrument worldwide. Keep provider instrument identity as the row key.

Initial provider routing target:

| Class | Source in plan | State |
| --- | --- | --- |
| Crypto | Coinbase public products; Binance public Spot catalog/history | ACCEPTED |
| Forex | Frankfurter ECB daily reference pairs | ACCEPTED EOD only |
| Stocks/ETFs | Alpaca IEX/raw when credentials and display entitlement pass | BLOCKED_EXTERNAL until configured |
| Futures | Binance USD-M/COIN-M public historical candidates after contract metadata and terms tests | RESEARCH gate; no enablement from documentation alone |
| CFD | No current accepted free display-entitled source | Hidden/BLOCKED_EXTERNAL |

Icon resolution order:

1. Pinned local CC0 crypto icon by normalized base asset.
2. Provider-supplied image only when its terms permit display and URL matches a
   fixed HTTPS host allowlist; proxy/cache with MIME, byte and dimension bounds.
3. Local currency-flag composition for Forex.
4. Deterministic ticker initials plus asset-class glyph for missing equity,
   futures and CFD art.

Never copy images from TradingView or LuxAlgo. A missing logo never hides a valid
instrument and never triggers an arbitrary remote URL fetch.

### P5 — Timeframe, crosshair and timezone UX

- Timeframe uses the same translucent hover and focus treatment as Symbol, with
  a downward caret and `aria-expanded`; caret rotates while open.
- Crosshair always renders a right-axis price badge and bottom-axis time badge
  together while inside the plot. Clamp label rectangles at chart edges and use
  the selected chart timezone for time while prices use instrument precision.
- Replace Clock `<details>` positioning with the same anchored portal primitive
  used by timeframe. Click opens below the top toolbar, Escape/outside click closes,
  selection returns focus and updates active-cell axis/crosshair labels immediately.
- UTC remains canonical storage; timezone changes presentation only.

### P6 — Verification and delivery

Run targeted tests, full frontend test/lint/build, backend/provider/security suites,
dependency/license checks and real browser scenarios at 1440/1024/390. Verify
Coinbase actual catalog/history/realtime; clearly mark credentials/entitlement
checks as BLOCKED_EXTERNAL. Review scoped diff, commit with `Refs #39`, push normal
fast-forward, verify exact SHA and CI. Keep #39 open if any required external live
provider criterion remains blocked.

## Project Structure

```text
specs/PB-038/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/chart-interaction-contract.md
└── quickstart.md

frontend/src/
├── components/ChartControls.tsx
├── components/ChartWorkspacePanels.tsx
├── components/Icon.tsx
├── market/LiveChart.tsx
├── market/CandleChart.tsx
├── market/TimeframePopover.tsx
├── market/MarketDataProviders.ts
└── replay/ReplayWorkspace.tsx

backend/src/main/java/com/aitrading/
├── market/
└── replay/
```

**Structure Decision**: Extend the current Chart/Replay/provider modules. Add small
focused components for ReplayLauncher, PositionSetupPanel, SymbolIcon and a shared
anchored popover; do not create another workspace or data layer.

## Complexity Tracking

No Constitution violation or stack expansion is planned. Any external icon/provider
dependency that does not pass license, entitlement and security review is rejected
before implementation.
