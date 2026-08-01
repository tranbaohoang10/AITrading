---
name: "backtest-safety"
description: "Prevent look-ahead, repainting, nondeterminism, and unrealistic execution assumptions in backtests."
compatibility: "AI Trading Platform; Codex and OpenCode agent-skills format"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Backtest Safety

## Required definitions

- OHLCV source, symbol, timeframe, timezone, candle boundary
- Warm-up period
- Signal time, confirmation time, execution time
- Close-versus-wick behavior
- Pivot confirmation and multi-timeframe synchronization
- Initial capital, sizing, leverage, commission, spread, slippage
- Stop loss, take profit, pyramiding, same-candle SL/TP policy
- Missing, duplicate, and gap-candle handling

## Prohibited behavior

- Future data or look-ahead
- Unapproved repainting
- Removing losing trades to improve metrics
- Re-optimizing on test data without disclosure
- Presenting historical results as guaranteed future profit

## Verification

- Use small fixtures with hand-calculable expected trades.
- Verify deterministic output for identical data and config.
- Separate in-sample, validation, and out-of-sample data when required.
- Record data hash, configuration, engine version, and run card.
