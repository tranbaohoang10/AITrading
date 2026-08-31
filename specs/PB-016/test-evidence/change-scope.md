# PB-016 scoped checkpoint —31/08/2026

Refs #18; PB-015 publication checkpoint Refs #17.

## PRE-EXISTING CHANGES

No unrelated working-tree changes at PB016 start after60964d5. Protected mvp-ui
re-review files are absent from main, preserved on feature/mvp-ui and excluded:

- `specs/mvp-ui/defects/BUG-001.md`: `e03fe3d3fcdc7eef83d83f819ca848c6b8e49b39`
- `specs/mvp-ui/review/review-report.md`: `5fb05f3f5d82640776c77283bacb8e529344c067`

## PB-016 CHANGES CREATED BY THIS TASK

MQL5 generator/runtime, immutable owned API/V10, real UI and tests; official
compiler evidence, prepared synthetic CSV/source and trace verifier; README and
backlog/state; PB015 publication checkpoint. Runtime remains unverified.
No governance, dependencies/lockfiles, CI, applied migration, Python engine, Pine
implementation or protected review change. No executable binary committed.
UTF-8/JSON/Markdown fence/local-link and narrow private-key/provider-token patterns
checked. This is not an exhaustive secret scan.

Exact scoped files (69):

- `README.md`
- `backend/src/main/java/com/aitrading/dsl/DslValidator.java`
- `backend/src/main/java/com/aitrading/mql5/Mql5ExportController.java`
- `backend/src/main/java/com/aitrading/mql5/Mql5ExportService.java`
- `backend/src/main/java/com/aitrading/mql5/Mql5Failure.java`
- `backend/src/main/java/com/aitrading/mql5/Mql5Generator.java`
- `backend/src/main/resources/db/migration/V10__mql5_exports.sql`
- `backend/src/main/resources/mql5/research-v1.mq5`
- `backend/src/test/java/com/aitrading/AiTradingApplicationTests.java`
- `backend/src/test/java/com/aitrading/DslValidatorTests.java`
- `backend/src/test/java/com/aitrading/Mql5ExportApiTests.java`
- `backend/src/test/java/com/aitrading/Mql5GeneratorTests.java`
- `docs/execution-state.md`
- `docs/product-backlog.md`
- `frontend/src/components/AppShell.tsx`
- `frontend/src/components/TradingWorkspace.tsx`
- `frontend/src/mql5/Mql5.test.tsx`
- `frontend/src/mql5/Mql5Workspace.tsx`
- `frontend/src/mql5/api.test.ts`
- `frontend/src/mql5/api.ts`
- `frontend/src/mql5/fixtures.ts`
- `frontend/src/strategy/StrategyEditor.tsx`
- `python/tests/test_mql5_trace_verifier.py`
- `scripts/compile_mql5_fixtures.py`
- `scripts/smoke_mql5.py`
- `scripts/verify_mql5_trace.py`
- `specs/PB-015/revision-history.md`
- `specs/PB-015/tasks.md`
- `specs/PB-016/design.md`
- `specs/PB-016/revision-history.md`
- `specs/PB-016/spec.md`
- `specs/PB-016/tasks.md`
- `specs/PB-016/test-cases.md`
- `specs/PB-016/test-evidence/browser-b-empty.md`
- `specs/PB-016/test-evidence/browser-b-session-preserved.md`
- `specs/PB-016/test-evidence/browser-desktop.jpg`
- `specs/PB-016/test-evidence/browser-draft-preserved.md`
- `specs/PB-016/test-evidence/browser-draft.md`
- `specs/PB-016/test-evidence/browser-generated.md`
- `specs/PB-016/test-evidence/browser-mobile.jpg`
- `specs/PB-016/test-evidence/browser-mobile.md`
- `specs/PB-016/test-evidence/browser-stale-account.md`
- `specs/PB-016/test-evidence/browser-tablet.jpg`
- `specs/PB-016/test-evidence/browser-tablet.md`
- `specs/PB-016/test-evidence/change-scope.md`
- `specs/PB-016/test-evidence/compiler.json`
- `specs/PB-016/test-evidence/restart-smoke-final.json`
- `specs/PB-016/test-evidence/restart-smoke.json`
- `specs/PB-016/test-evidence/results.md`
- `specs/PB-016/test-evidence/target-fixtures/causal-all-indicators.csv`
- `specs/PB-016/test-evidence/target-fixtures/causal-all-indicators.mq5`
- `specs/PB-016/test-evidence/target-fixtures/costs-both-hit-gap.csv`
- `specs/PB-016/test-evidence/target-fixtures/costs-both-hit-gap.mq5`
- `specs/PB-016/test-evidence/target-fixtures/hand-next-open.csv`
- `specs/PB-016/test-evidence/target-fixtures/hand-next-open.mq5`
- `specs/PB-016/test-evidence/target-fixtures/long-target-cap.csv`
- `specs/PB-016/test-evidence/target-fixtures/long-target-cap.mq5`
- `specs/PB-016/test-evidence/target-fixtures/manifest.json`
- `specs/PB-016/test-evidence/target-fixtures/nonpositive-equity.csv`
- `specs/PB-016/test-evidence/target-fixtures/nonpositive-equity.mq5`
- `specs/PB-016/test-evidence/target-fixtures/overflow-repeated-target.csv`
- `specs/PB-016/test-evidence/target-fixtures/rule-exit-before-barriers.csv`
- `specs/PB-016/test-evidence/target-fixtures/rule-exit-before-barriers.mq5`
- `specs/PB-016/test-evidence/target-fixtures/short-target-cap.csv`
- `specs/PB-016/test-evidence/target-fixtures/short-target-cap.mq5`
- `specs/PB-016/test-evidence/target-fixtures/simultaneous-entries.csv`
- `specs/PB-016/test-evidence/target-fixtures/simultaneous-entries.mq5`
- `specs/PB-016/test-evidence/target-validation.md`
- `specs/PB-016/test-evidence/verification.json`
