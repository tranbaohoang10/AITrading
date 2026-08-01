---
name: "goal-driven-execution"
description: "Map tasks to acceptance criteria and prove completion with executable evidence."
compatibility: "AI Trading Platform; Codex and OpenCode agent-skills format"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Goal-Driven Execution

## Goal

Convert every task into observable evidence instead of a narrative claim.

## Required behavior

1. Map each Task ID to one or more Acceptance Criteria IDs.
2. Define the expected observable result before implementation.
3. Run the approved test, lint, type-check, build, and contract commands.
4. Record commands, exit status, and relevant output.
5. Do not claim completion when a required command was skipped, unavailable, or failing.
6. Distinguish implementation success from verification success.
7. Use the project-defined completion or blocked status exactly.

## Trading evidence

When relevant, include deterministic fixtures, expected signal bars, entry/exit prices, fees, spread, slippage, and look-ahead checks.
