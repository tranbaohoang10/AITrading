# AI Trading Platform — Agent Skill Matrix

These project skills extend Spec Kit. They do not replace the Constitution, approved ADRs, specifications, contracts, task lists, or agent role files.

## Mandatory usage

| Agent | Always load before relevant work | Conditional skills |
|---|---|---|
| Agent 1 — Analyst/Architect | `think-before-coding`, `simplicity-first`, `strategy-neutrality`, `stack-and-scope-lock` | `strategy-dsl-governance`, `backtest-safety`, `multimodal-rag-safety`, `live-trading-safety` |
| Agent 2 — Developer | `surgical-changes`, `goal-driven-execution`, `stack-and-scope-lock` | `strategy-dsl-governance`, `backtest-safety`, `cross-target-consistency`, `multimodal-rag-safety`, `live-trading-safety` |
| Agent 3 — Tester | `goal-driven-execution` | `backtest-safety`, `cross-target-consistency`, `strategy-neutrality`, `multimodal-rag-safety`, `live-trading-safety` |

## Precedence

1. Constitution
2. Accepted ADR
3. Approved specification and contracts
4. Approved task list
5. AGENTS.md and role instructions
6. Project skill instructions

If a skill conflicts with a higher source, stop and report the conflict.

## Installation

Copy each folder under `.agents/skills/` into the same path in the repository. The folder name must match the `name` field in `SKILL.md`.

## OpenCode note

OpenCode Agent 3 currently denies the `skill` tool. Change its frontmatter permission from scalar `skill: deny` to a permission map that allows only the review skills required for Agent 3.
