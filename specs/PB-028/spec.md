# PB-028 — Quant frontend trading-terminal redesign

Issue: [#29](https://github.com/tranbaohoang10/AITrading/issues/29)

## Goal and scope

Redesign the existing React frontend as a compact, professional dark trading terminal under the visible brand **Quant**. Preserve every existing API call, authorization boundary, domain rule and user workflow.

In scope: shared UI tokens, navigation shell, chart-first workspace, Assistant, Strategies, Backtesting, Journal, Library (documents/image analysis), Account, compact help/disclosure patterns and responsive behavior at 1440px, 1024px and 390px.

Out of scope: backend/API changes, database/Flyway, Strategy DSL semantics, Python backtest, Pine/MQL5 generation or validation, AI/RAG business logic, broker/live trading and fabricated metrics.

## Use case

### UC-028-01 — Research in a compact multi-tool workspace

- Actor: authenticated Quant user.
- Trigger: user opens the product and selects a research tool.
- Preconditions: the existing authenticated frontend providers are available.
- Happy path: navigate with the sidebar/drawer; select/import market data; inspect the chart; edit/validate a strategy; view generated code; configure/run or inspect a saved backtest; inspect P&L/trades; manage private conversations, journal entries and library items.
- Alternate path: empty workspaces show one short instruction and the existing primary action.
- Error path: existing API/provider/file errors remain visible and actionable; secondary safety/provenance content remains available under Details/Help.
- Postcondition: existing server-backed state changes only through the pre-existing actions and contracts.

## Acceptance criteria

- **AC-01** — Visible product identity is Quant. Dark charcoal surfaces and subtle borders dominate; green is reserved for primary/success/profit and red for error/loss.
- **AC-02** — Desktop keeps a compact sidebar, small toolbar and dominant chart/workspace region. Existing chart, import and backtest actions remain available.
- **AC-03** — Assistant exposes New Chat, history, messages, composer, Ask AI and a compact provider status; provider policy/safety details are disclosed on demand.
- **AC-04** — Strategy shows name, revision and DRAFT/VALIDATED state together with the existing editor/save/validate actions. Pine and MQL5 exports remain separate, readable workspaces.
- **AC-05** — Backtest emphasizes only returned metrics, performance/equity visualization and trades. No unsupported metric is invented.
- **AC-06** — Journal emphasizes P&L and trade records; AI evaluation remains available. Library screens are task-focused and keep technical material in Details/Help.
- **AC-07** — 1440px, 1024px and 390px layouts have no page-level horizontal overflow. Navigation and actions remain keyboard/touch usable.
- **AC-08** — Frontend unit/regression tests, lint and production build pass. Pine/TradingView and MQL5/MetaTrader validation are not rerun.

## Security and privacy

React text rendering remains inert; no raw HTML injection is introduced. Existing authentication, account scoping, request idempotency, upload validation and server-side authorization remain unchanged. Provider/privacy warnings are condensed in the primary view but not removed; their full meaning remains accessible through disclosure content. No secret or external asset is added.

## Data / ERD impact

N/A. This is a presentation-only change with no persistence, API, schema or migration impact.

## Definition of Done

AC-01–AC-08 are evidenced; separate test cases and dated revision history are complete; the full frontend test suite, lint and build pass; responsive real-app inspection passes; the scoped commit is pushed to `origin/main`, verified on GitHub, and Issue #29 is updated and closed.
