---
name: "surgical-changes"
description: "Modify only approved paths and avoid unrelated refactors, cleanup, or scope expansion."
compatibility: "AI Trading Platform; Codex and OpenCode agent-skills format"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Surgical Changes

## Goal

Make the minimum safe change inside the approved task boundary.

## Rules

- Modify only files inside `allowed_paths`.
- Treat `forbidden_paths`, approved contracts, specifications, migrations, and Agent 3 acceptance tests as immutable.
- Do not perform unrelated cleanup, renaming, formatting, dependency upgrades, or refactoring.
- Preserve existing style and public behavior unless the specification explicitly changes them.
- If an additional file is genuinely required, stop and return `SCOPE_CHANGE_REQUEST` with the path, reason, impact, and proposed tests.
- Review `git diff --name-only` and `git diff` before completion.
- Revert accidental out-of-scope edits rather than justifying them afterward.

## Evidence

Report changed files, why each was changed, and the approved Task ID that authorized it.
