# PB-025 — System integration and failure recovery

Issue: [#27](https://github.com/tranbaohoang10/AITrading/issues/27). Created
02/09/2026 before implementation. All declared dependencies are DONE.

## Use Case

UC-PB025 proves one synthetic researcher can traverse the actual account, chat,
validated neutral DSL, market dataset, Python backtest, journal, export,
notification, document and audit boundaries without identity/provenance loss.
After an owned API restart, the same session and snapshots remain consistent;
another user cannot read or mutate any of them.

## Acceptance Criteria

- AC-01 actual loopback HTTP + PostgreSQL + Python journey, never mock results.
- AC-02 persisted session/resources/idempotency survive one observed API down/up.
- AC-03 AI-disabled and dependency failure paths are redacted and never fake data.
- AC-04 two-user, wrong binding, CSRF and resource-ID isolation fail closed.
- AC-05 replay/concurrency keeps one accepted side effect and terminal state.
- AC-06 clean Flyway install/restart and owned harness cleanup are verified.
- AC-07 actual desktop/mobile UI uses the real API and exposes recovery safely.
- AC-08 CNPM, tests, regression/security, exact GitHub SHA and CI PASS before close.

## Security and constraints

Synthetic data only. Provider keys are stripped from the test child environment
and never read or reported. No Pine/MQL target execution, broker/account login,
orders, live trading, DLL or WebRequest. Inputs and reports stay bounded inside
the repository; HTTP failures suppress response bodies. No migration, dependency
or fixed-stack change is planned.

## Definition of Done

All AC pass with executable evidence and no unexplained integration gap or
high/critical finding. Owned API/PostgreSQL are stopped and credential file is
removed. Commit/push main normally with `Refs #27`; local, origin and GitHub SHA
must match and required CI must succeed before Issue completion.
