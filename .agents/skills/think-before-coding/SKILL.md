---
name: "think-before-coding"
description: "Analyze ambiguity, assumptions, conflicts, and missing decisions before implementation."
compatibility: "AI Trading Platform; Codex and OpenCode agent-skills format"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Think Before Coding

## Use this skill when

- A requirement is ambiguous, incomplete, contradictory, or domain-sensitive.
- A trading rule uses subjective wording.
- A change affects contracts, persistence, security, execution timing, or external integrations.

## Required behavior

1. Restate the requested outcome in one or two sentences.
2. List assumptions that materially affect implementation.
3. Identify missing decisions and conflicts with approved artifacts.
4. Distinguish facts from inferences.
5. For trading rules, require measurable definitions for signal, confirmation, execution, exit, risk, timeframe, timezone, and bar-close behavior.
6. Stop with the project-defined BLOCKED status when required information is missing.
7. Do not code merely to demonstrate progress.

## Output checklist

- Goal
- Assumptions
- Ambiguities
- Relevant constraints
- Proposed smallest next step
- Blocking questions or valid completion status
