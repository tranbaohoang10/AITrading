---
name: "think-before-coding"
description: "Resolve safe assumptions autonomously and surface only genuine requirement blockers."
compatibility: "AI Trading Platform"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Think Before Coding — Autonomous Prototype

1. State the requested outcome and inspect relevant source, tests and documents.
2. Separate known facts from inferences; record material assumptions.
3. Resolve ordinary missing details with the simplest safe interpretation and
   continue without a manual approval gate.
4. Identify genuine contradictory business requirements that cannot be inferred
   safely, external credential/service gaps and data-loss risks outside the repo.
   Exhaust safe local remedies, then report the precise HARD BLOCKER.
5. For trading rules, require measurable signal, confirmation, execution, exit,
   risk, timeframe, timezone and candle-boundary definitions.
6. Keep the current Issue scope, fixed stack and security constraints.
7. Do not code merely to appear busy; plan concrete verifiable outcomes.

Output: goal, facts/assumptions, constraints, smallest justified design, test
evidence plan and any genuine blocker. Do not require Agent 1/3 or owner sign-off
for routine prototype analysis/design/implementation.
