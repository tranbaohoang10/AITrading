---
name: "cross-target-consistency"
description: "Verify event-level consistency between Python backtests, Pine Script, and MQL5 generated from one DSL."
compatibility: "AI Trading Platform; Codex and OpenCode agent-skills format"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Cross-Target Consistency

## Goal

Keep Python backtest behavior, Pine Script behavior, and MQL5 behavior aligned with one Strategy DSL version.

## Required comparison dimensions

- Indicator warm-up
- Timezone and session
- Bar-close confirmation
- Signal bar and execution bar
- Price source and rounding
- Long/short conditions
- Entry, exit, SL, TP, trailing, break-even, and pyramiding
- Fees, spread, slippage, and broker constraints

## Verification approach

1. Create a deterministic OHLCV fixture.
2. Define expected signal and execution events by bar index/time.
3. Run the Python adapter.
4. Validate generated Pine and MQL5 logic against the same event trace.
5. Document unavoidable platform differences explicitly.
6. Fail the review when unexplained signal divergence exists.

Do not compare only final net profit; compare event-level behavior.
