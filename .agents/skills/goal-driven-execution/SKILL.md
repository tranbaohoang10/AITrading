---
name: "goal-driven-execution"
description: "Map autonomous tasks to acceptance criteria and prove completion with executable evidence."
compatibility: "AI Trading Platform"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Goal-Driven Execution — Autonomous Prototype

1. Create or identify the feature's real GitHub Issue before code.
2. Map Task IDs to observable Acceptance Criteria and define expected evidence.
3. Maintain the separate feature test Markdown and meaningful test coverage.
4. Run required functional/integration/regression/security tests and affected
   build/lint/type-check; record commands, exit codes and actual results.
5. On failure diagnose, repair and rerun until PASS or a genuine HARD BLOCKER.
   Missing local setup or routine documents are work to complete autonomously.
6. Never label skipped/unavailable/failing required checks PASS or DONE.
   Justify N/A checks for genuinely irrelevant surfaces.
7. Verify scope and secrets, commit on main with Refs, push origin/main without
   force, verify the exact SHA remotely, then update/close the Issue after DoD.
8. Continue backlog only within the current request; obey explicit task stop.
9. Preserve historical evidence; Codex verification is not independent/owner approval.

For trading, include deterministic fixtures, expected signal bars, execution
prices/costs and look-ahead checks. Report hard blockers with reproducible evidence,
not a retired handoff or approval-status token.
