---
name: "strategy-neutrality"
description: "Keep the platform method-agnostic across Dow, Wyckoff, price action, indicators, ICT/SMC, and custom strategies."
compatibility: "AI Trading Platform; Codex and OpenCode agent-skills format"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Strategy Neutrality

## Principle

The platform is method-agnostic. ICT and SMC are optional strategy families, not the default architecture.

## Supported examples

- Dow Theory
- Wyckoff
- Trendline, channel, support and resistance
- Price action and candle patterns
- ICT and SMC
- RSI, EMA, SMA, MACD, ATR, Bollinger Bands
- Volume and VWAP
- Breakout, momentum, trend-following, mean-reversion
- User-defined and hybrid strategies

## Rules

- Do not assume a preferred trading school.
- Do not rename neutral concepts to ICT/SMC terminology unless the user or approved spec requires it.
- Treat method names as metadata and discovery labels.
- Represent executable behavior through measurable conditions.
- Convert subjective terms into explicit parameters or request clarification.
- Ensure UI, APIs, schemas, tests, and documentation remain extensible to multiple strategy families.
