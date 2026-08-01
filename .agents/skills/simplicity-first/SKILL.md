---
name: "simplicity-first"
description: "Choose the smallest approved design and reject speculative complexity or feature expansion."
compatibility: "AI Trading Platform; Codex and OpenCode agent-skills format"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Simplicity First

## Goal

Implement the smallest design that satisfies the approved acceptance criteria without creating speculative architecture.

## Rules

- Do not add features that are not in the approved scope.
- Do not introduce a framework, service, queue, abstraction, or dependency for hypothetical future use.
- Prefer an existing project pattern over a new pattern.
- Prefer one clear implementation over configurable complexity unless configurability is required.
- Do not add live trading when the task concerns research, backtesting, export, demo, or paper trading.
- Do not add a broker, notification channel, indicator family, or model provider unless the task requires it.
- Keep MVP and expansion work explicitly separated.

## Before finishing

Explain why each new file, dependency, abstraction, and configuration item is necessary for the current acceptance criteria.
