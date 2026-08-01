---
name: "strategy-dsl-governance"
description: "Use validated neutral Strategy DSL as the canonical source for Python, Pine Script, and MQL5."
compatibility: "AI Trading Platform; Codex and OpenCode agent-skills format"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Strategy DSL Governance

## Principle

Validated neutral Strategy DSL is the canonical source of executable strategy behavior.

## Canonical flow

```text
Prompt / Image / Document
  -> Strategy DSL Draft
  -> Schema and semantic validation
  -> Approved Strategy DSL Version
  -> Python Backtest Adapter
  -> Pine Script Generator
  -> MQL5 Generator
```

## Rules

- Do not execute unrestricted LLM-generated code.
- Do not use Pine Script as the source for MQL5 generation or MQL5 as the source for Pine generation.
- Python, Pine Script, and MQL5 must derive from the same approved DSL version.
- Method labels are metadata; entry, exit, filter, risk, position-management, and execution rules contain behavior.
- Every component must be registered, schema-valid, range-valid, and platform-compatible.
- Unsupported or ambiguous components must fail explicitly, not degrade silently.
- Persist DSL version, schema version, generator version, and code hash for reproducibility.
