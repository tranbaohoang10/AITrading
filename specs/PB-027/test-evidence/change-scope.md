# PB-027 change scope — Refs #16

## PRE-EXISTING CHANGES

The two protected legacy re-review artifacts are not dirty files on current main.
They remain unchanged on feature/mvp-ui with Git blobs:
- specs/mvp-ui/defects/BUG-001.md: e03fe3d3fcdc7eef83d83f819ca848c6b8e49b39
- specs/mvp-ui/review/review-report.md: 5fb05f3f5d82640776c77283bacb8e529344c067

Neither artifact is edited, stashed, reverted or included in this commit.
The resumed tree contained PB-013 completion notes and PB-027 planning created by
this same autonomous run. PB-013 notes are included only as delivery checkpoint,
with Refs #15; no DONE journal functionality is reimplemented.

## CHANGES CREATED BY THIS TASK

Backend changes only the guard/filter order; test fixtures gain captured expected
identity and a new focused HTTP/PG test class. Frontend API/provider/account changes
bind requests and preserve uncertain retries/lifetimes. Existing tests retain
business expectations while gaining the explicit account argument; new regressions
exercise the security boundary. README documents protocol, smoke script supplies
captured identity, backlog/checkpoint and PB-027 CNPM/test evidence are updated.
No migration, engine calculation, dependency, lockfile, stack, CI, governance or
protection setting is changed. No real secret is introduced. Limited pattern
scan plus manual diff review is not a claim of comprehensive secret detection.

Exact file scope:

- `README.md`
- `backend/src/main/java/com/aitrading/api/SecurityConfig.java`
- `backend/src/main/java/com/aitrading/auth/AuthGuardFilter.java`
- `backend/src/test/java/com/aitrading/AuthenticationTests.java`
- `backend/src/test/java/com/aitrading/ConversationTests.java`
- `backend/src/test/java/com/aitrading/DslApiTests.java`
- `backend/src/test/java/com/aitrading/MarketApiTests.java`
- `backend/src/test/java/com/aitrading/StrategyApiTests.java`
- `backend/src/test/java/com/aitrading/WorkspaceIdentityTests.java`
- `backend/src/test/java/com/aitrading/ai/AiApiTests.java`
- `backend/src/test/java/com/aitrading/backtest/BacktestApiTests.java`
- `docs/execution-state.md`
- `docs/product-backlog.md`
- `frontend/src/auth/AccountView.tsx`
- `frontend/src/auth/Authentication.test.tsx`
- `frontend/src/auth/WorkspaceIdentity.test.ts`
- `frontend/src/auth/api.ts`
- `frontend/src/backtest/Backtest.test.tsx`
- `frontend/src/backtest/BacktestProvider.tsx`
- `frontend/src/backtest/api.test.ts`
- `frontend/src/backtest/api.ts`
- `frontend/src/chat/AiChat.test.tsx`
- `frontend/src/chat/ConversationProvider.tsx`
- `frontend/src/chat/Conversations.test.tsx`
- `frontend/src/chat/aiApi.test.ts`
- `frontend/src/chat/aiApi.ts`
- `frontend/src/chat/api.test.ts`
- `frontend/src/chat/api.ts`
- `frontend/src/journal/Journal.test.tsx`
- `frontend/src/journal/JournalProvider.tsx`
- `frontend/src/journal/api.test.ts`
- `frontend/src/journal/api.ts`
- `frontend/src/market/Market.test.tsx`
- `frontend/src/market/MarketProvider.tsx`
- `frontend/src/market/api.test.ts`
- `frontend/src/market/api.ts`
- `frontend/src/strategy/Strategy.test.tsx`
- `frontend/src/strategy/StrategyProvider.tsx`
- `frontend/src/strategy/api.test.ts`
- `frontend/src/strategy/api.ts`
- `scripts/smoke_backtest.py`
- `specs/PB-013/tasks.md`
- `specs/PB-013/test-cases.md`
- `specs/PB-013/test-evidence/results.md`
- `specs/PB-027/design.md`
- `specs/PB-027/revision-history.md`
- `specs/PB-027/spec.md`
- `specs/PB-027/tasks.md`
- `specs/PB-027/test-cases.md`
- `specs/PB-027/test-evidence/backtest-smoke.json`
- `specs/PB-027/test-evidence/browser-a-saved.md`
- `specs/PB-027/test-evidence/browser-b-empty.md`
- `specs/PB-027/test-evidence/browser-b-session-preserved.jpg`
- `specs/PB-027/test-evidence/browser-b-session-preserved.md`
- `specs/PB-027/test-evidence/browser-stale-logout.md`
- `specs/PB-027/test-evidence/browser-stale-write.jpg`
- `specs/PB-027/test-evidence/browser-stale-write.md`
- `specs/PB-027/test-evidence/change-scope.md`
- `specs/PB-027/test-evidence/results.md`
- `specs/PB-027/test-evidence/verification.json`
