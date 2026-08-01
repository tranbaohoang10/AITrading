---
name: "live-trading-safety"
description: "Protect broker integrations with testnet/paper defaults, risk limits, secret isolation, and audit controls."
compatibility: "AI Trading Platform; Codex and OpenCode agent-skills format"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Live Trading Safety

## Default state

Research, backtest, export, demo, testnet, and paper trading are allowed before live trading. Live trading is disabled by default.

## Mandatory controls

- Secrets remain server-side and encrypted.
- Withdrawal permission is forbidden.
- Separate read-only, testnet/demo, paper, and live modes.
- Symbol allowlist, order-size cap, exposure cap, daily-trade cap, and kill switch.
- Idempotency and duplicate-order prevention.
- Broker preflight checks for balance, margin, spread, stop levels, and market state.
- Human confirmation when required by the approved spec.
- Complete audit trail for decisions, signals, requests, broker responses, and errors.

## MCP restriction

Do not expose live-order placement, withdrawal, secret changes, or risk-limit disabling as general AI tools.
