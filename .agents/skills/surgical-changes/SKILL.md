---
name: "surgical-changes"
description: "Keep autonomous project changes within the current Issue and preserve unrelated work."
compatibility: "AI Trading Platform"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Surgical Changes — Autonomous Prototype

Work directly on main under the current Constitution. No assigned-agent handoff
or manual path approval is required. Derive necessary paths from the Issue and
ACs; record them before editing and keep the change small.

- Preserve unrelated pre-existing changes, old documents and revision history.
- Maintain accepted product behavior/contracts unless current requirements change
  them; document justified changes and regression impact.
- Never rewrite applied migrations or weaken tests to hide failures.
- Do not add unrelated cleanup, speculative features or stack changes.
- If another file is necessary for the same task, inspect it, document the reason
  and proceed within scope; do not create a routine SCOPE_CHANGE_REQUEST gate.
- Resolve safe assumptions yourself; report only genuine hard blockers.
- Inspect git status, full/staged diff and diff --check before commit.
- Correct only your own accidental edits; never discard someone else's work.
- Report exact changed paths, Issue number, ACs, checks and limitations.

Prior Agent 3 test ownership restrictions are legacy. Codex may maintain tests
and design end-to-end, but cannot alter expected results to conceal defects.
