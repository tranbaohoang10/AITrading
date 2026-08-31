# PB-015 scoped checkpoint — 31/08/2026

Refs #17; PB-027 completion checkpoint Refs #16.

## PRE-EXISTING CHANGES

No unrelated working-tree modifications were present at PB-015 start. The two
protected mvp-ui re-review documents are absent from current main and remain
unchanged on feature/mvp-ui; neither is staged or included. Historic blob IDs:

- `specs/mvp-ui/defects/BUG-001.md`: `e03fe3d3fcdc7eef83d83f819ca848c6b8e49b39`
- `specs/mvp-ui/review/review-report.md`: `5fb05f3f5d82640776c77283bacb8e529344c067`

## PB-015 CHANGES CREATED BY THIS TASK

Generator/runtime, owned immutable export API/V9, real Pine view, regression/security
tests and synthetic reference/target preparation; README/backlog/state and PB-027
publication checkpoint. Official Pine execution remains BLOCKED, not certified.

No governance, dependency/lockfile, CI, applied migration, Python engine or
protected review-file change. UTF-8/JSON/Markdown fence/local-link checks and narrow
private-key/provider-token patterns passed. This is not an exhaustive secret scan.

Exact scoped files (79):

- `README.md`
- `backend/src/main/java/com/aitrading/dsl/DslValidator.java`
- `backend/src/main/java/com/aitrading/pine/PineExportController.java`
- `backend/src/main/java/com/aitrading/pine/PineExportService.java`
- `backend/src/main/java/com/aitrading/pine/PineFailure.java`
- `backend/src/main/java/com/aitrading/pine/PineGenerator.java`
- `backend/src/main/resources/db/migration/V9__pine_exports.sql`
- `backend/src/main/resources/pine/research-v1.pine`
- `backend/src/test/java/com/aitrading/AiTradingApplicationTests.java`
- `backend/src/test/java/com/aitrading/DslValidatorTests.java`
- `backend/src/test/java/com/aitrading/PineExportApiTests.java`
- `backend/src/test/java/com/aitrading/PineGeneratorTests.java`
- `backend/src/test/resources/pine/causal-all-indicators.json`
- `backend/src/test/resources/pine/costs-both-hit-gap.json`
- `backend/src/test/resources/pine/hand-next-open.json`
- `backend/src/test/resources/pine/long-target-cap.json`
- `backend/src/test/resources/pine/nonpositive-equity.json`
- `backend/src/test/resources/pine/rule-exit-before-barriers.json`
- `backend/src/test/resources/pine/short-target-cap.json`
- `backend/src/test/resources/pine/simultaneous-entries.json`
- `docs/execution-state.md`
- `docs/product-backlog.md`
- `frontend/src/components/AppShell.tsx`
- `frontend/src/components/TradingWorkspace.tsx`
- `frontend/src/pine/Pine.test.tsx`
- `frontend/src/pine/PineWorkspace.tsx`
- `frontend/src/pine/api.test.ts`
- `frontend/src/pine/api.ts`
- `frontend/src/pine/fixtures.ts`
- `frontend/src/strategy/StrategyEditor.tsx`
- `python/tests/test_pine_reference.py`
- `scripts/build_pine_target_fixtures.py`
- `scripts/prepare_pine_fixtures.py`
- `scripts/smoke_pine.py`
- `specs/PB-015/design.md`
- `specs/PB-015/revision-history.md`
- `specs/PB-015/spec.md`
- `specs/PB-015/tasks.md`
- `specs/PB-015/test-cases.md`
- `specs/PB-015/test-evidence/browser-b-session-preserved.md`
- `specs/PB-015/test-evidence/browser-copy-provenance.md`
- `specs/PB-015/test-evidence/browser-desktop.jpg`
- `specs/PB-015/test-evidence/browser-download.md`
- `specs/PB-015/test-evidence/browser-draft-preserved.md`
- `specs/PB-015/test-evidence/browser-draft.md`
- `specs/PB-015/test-evidence/browser-generated.md`
- `specs/PB-015/test-evidence/browser-mobile.jpg`
- `specs/PB-015/test-evidence/browser-mobile.md`
- `specs/PB-015/test-evidence/browser-other-account.md`
- `specs/PB-015/test-evidence/browser-restart.md`
- `specs/PB-015/test-evidence/browser-stale-account.md`
- `specs/PB-015/test-evidence/browser-tablet.jpg`
- `specs/PB-015/test-evidence/browser-tablet.md`
- `specs/PB-015/test-evidence/change-scope.md`
- `specs/PB-015/test-evidence/restart-smoke.json`
- `specs/PB-015/test-evidence/results.md`
- `specs/PB-015/test-evidence/target-access.md`
- `specs/PB-015/test-evidence/target-fixtures/causal-all-indicators-export.pine`
- `specs/PB-015/test-evidence/target-fixtures/causal-all-indicators.pine`
- `specs/PB-015/test-evidence/target-fixtures/costs-both-hit-gap-export.pine`
- `specs/PB-015/test-evidence/target-fixtures/costs-both-hit-gap.pine`
- `specs/PB-015/test-evidence/target-fixtures/hand-next-open-export.pine`
- `specs/PB-015/test-evidence/target-fixtures/hand-next-open.pine`
- `specs/PB-015/test-evidence/target-fixtures/long-target-cap-export.pine`
- `specs/PB-015/test-evidence/target-fixtures/long-target-cap.pine`
- `specs/PB-015/test-evidence/target-fixtures/manifest.json`
- `specs/PB-015/test-evidence/target-fixtures/nonpositive-equity-export.pine`
- `specs/PB-015/test-evidence/target-fixtures/nonpositive-equity.pine`
- `specs/PB-015/test-evidence/target-fixtures/rule-exit-before-barriers-export.pine`
- `specs/PB-015/test-evidence/target-fixtures/rule-exit-before-barriers.pine`
- `specs/PB-015/test-evidence/target-fixtures/short-target-cap-export.pine`
- `specs/PB-015/test-evidence/target-fixtures/short-target-cap.pine`
- `specs/PB-015/test-evidence/target-fixtures/simultaneous-entries-export.pine`
- `specs/PB-015/test-evidence/target-fixtures/simultaneous-entries.pine`
- `specs/PB-015/test-evidence/target-validation.md`
- `specs/PB-015/test-evidence/verification.json`
- `specs/PB-027/revision-history.md`
- `specs/PB-027/tasks.md`
- `specs/PB-027/test-evidence/results.md`
