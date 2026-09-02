# PB-028 — Test evidence

Date: 02/09/2026 (Asia/Ho_Chi_Minh)

## Automated checks

- `npm test -- --reporter=dot` — PASS: 30 files, 226 tests.
- `npm run lint` — PASS: exit 0.
- `npm run build` — PASS: TypeScript check and Vite production build, exit 0.
- `npm audit --audit-level=high` — PASS: 0 vulnerabilities.

## Real-app visual verification

The Vite frontend was exercised against the real local Spring Boot API and a disposable PostgreSQL test cluster with synthetic data.

- Desktop 1440×900 — PASS; viewport and document widths both 1440 px.
- Tablet 1024×768 — PASS; viewport and document widths both 1024 px.
- Mobile 390×844 — PASS; viewport and document widths both 390 px.
- Assistant, strategy, chart, backtest and responsive navigation states were inspected.

The disposable API and database processes were stopped after inspection. TradingView Pine and MetaTrader MQL5 validators were intentionally not run, as required by the frontend-only scope.
