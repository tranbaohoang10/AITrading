# Proposed Constitution Amendment 1.1.0

## Reason

The current Constitution strongly covers security, specification-driven development, and deterministic backtesting, but it does not yet make strategy-method neutrality or cross-target DSL consistency constitutional requirements.

## Proposed additions

### Strategy Method Neutrality

- The platform must not default to or privilege ICT, SMC, Wyckoff, Dow Theory, price action, indicator-based, or any other trading school.
- Strategy-family names are metadata and discovery labels.
- Executable behavior must be represented as measurable neutral Strategy DSL components.

### Canonical Strategy DSL and Target Consistency

- An approved Strategy DSL version is the canonical source for Python backtests, Pine Script, and MQL5 generation.
- Direct Pine-to-MQL5 or MQL5-to-Pine translation is forbidden as the canonical workflow.
- Tests must verify event-level consistency across supported targets and document unavoidable platform differences.

### Safe MCP and Broker Boundaries

- MCP research tools may retrieve data, validate strategies, run backtests, read results, and generate code.
- Live-order placement, withdrawal, secret changes, and disabling risk controls must not be exposed as general AI tools.
- Live execution must pass Spring Boot authorization, risk controls, idempotency, and audit requirements.

## Existing wording to generalize

Replace phrases such as `trading, indicator, ICT/SMC` with `trading-method, indicator, strategy, and backtest logic` so that governance remains method-neutral.

## Version impact

Recommended version: `1.0.0 -> 1.1.0` because this adds materially new governance principles without changing agent responsibility boundaries.
