# PB-024 change scope

31/08/2026. Issue #19; preceding PB-016 publication checkpoint Refs #18.

## PRE-EXISTING CHANGES

Working tree clean at baseline239c1bc. The two historic mvp-ui re-review documents
are absent on current main and remain unchanged on feature/mvp-ui. Not edited,
reverted, stashed or included in this commit. Protected blob IDs:
- BUG-001.md: e03fe3d3fcdc7eef83d83f819ca848c6b8e49b39
- review-report.md: 5fb05f3f5d82640776c77283bacb8e529344c067

## CHANGES CREATED BY THIS TASK

Audit metadata persistence/V11 triggers/retention; authenticated owner API and
Account activity panel; request/auth/job correlation and safe numeric query/health
errors.11new actual HTTP/PG tests and6frontend tests; restart helper and CNPM,
runbook, actual evidence. Existing source changes only connect those boundaries.
README/backlog/execution state and PB016 publication history are traceability.
No stack/dependency/lockfile/CI/governance, applied V1-V10, backtest algorithm,
Pine/MQL target implementation, credit/payment or live-trading change.

Exact file list (42 files, including this manifest):

- `README.md`
- `backend/src/main/java/com/aitrading/api/ApiExceptionHandler.java`
- `backend/src/main/java/com/aitrading/api/HealthController.java`
- `backend/src/main/java/com/aitrading/api/RequestIdFilter.java`
- `backend/src/main/java/com/aitrading/api/SecurityConfig.java`
- `backend/src/main/java/com/aitrading/audit/AuditController.java`
- `backend/src/main/java/com/aitrading/audit/AuditRetention.java`
- `backend/src/main/java/com/aitrading/audit/AuditService.java`
- `backend/src/main/java/com/aitrading/auth/AuthGuardFilter.java`
- `backend/src/main/java/com/aitrading/backtest/BacktestStore.java`
- `backend/src/main/resources/db/migration/V11__audit_events.sql`
- `backend/src/test/java/com/aitrading/AiTradingApplicationTests.java`
- `backend/src/test/java/com/aitrading/AuditApiTests.java`
- `docs/execution-state.md`
- `docs/operations-audit.md`
- `docs/product-backlog.md`
- `frontend/src/audit/Audit.test.tsx`
- `frontend/src/audit/AuditPanel.tsx`
- `frontend/src/audit/api.ts`
- `frontend/src/auth/AccountView.tsx`
- `scripts/smoke_audit.py`
- `specs/PB-016/revision-history.md`
- `specs/PB-016/tasks.md`
- `specs/PB-024/design.md`
- `specs/PB-024/revision-history.md`
- `specs/PB-024/spec.md`
- `specs/PB-024/tasks.md`
- `specs/PB-024/test-cases.md`
- `specs/PB-024/test-evidence/browser-b-isolation.txt`
- `specs/PB-024/test-evidence/browser-desktop-dom.txt`
- `specs/PB-024/test-evidence/browser-desktop.jpg`
- `specs/PB-024/test-evidence/browser-mobile-dom.txt`
- `specs/PB-024/test-evidence/browser-mobile.jpg`
- `specs/PB-024/test-evidence/browser-stale-a-before.txt`
- `specs/PB-024/test-evidence/browser-stale-a-denied.txt`
- `specs/PB-024/test-evidence/browser-tablet-dom.txt`
- `specs/PB-024/test-evidence/browser-tablet.jpg`
- `specs/PB-024/test-evidence/change-scope.md`
- `specs/PB-024/test-evidence/restart-smoke-final.json`
- `specs/PB-024/test-evidence/restart-smoke.json`
- `specs/PB-024/test-evidence/results.md`
- `specs/PB-024/test-evidence/verification.json`

Review: complete source/test/document changes and screenshots inspected, narrow
credential-pattern scan found no key/private-key tokens. Synthetic passwords in
test fixtures are deliberate non-production data. No .env or secret file included.
UTF-8, JSON, Markdown fences/local links and git diff --check passed. This is a
focused review, not an exhaustive secret scanner or independent security audit.
Staged diff must match this exact list before commit; local DoD174/192/44 PASS,
actual restart/browser verified. Exact remote SHA/CI checked after normal push.

## Corrective checkpoint after first CI

First commit remains d622f2d, no history rewrite. Corrective diff8existing files,
no new paths; cumulative PB024 scope remains42 unique files. Foundation test
now checks bounded15s recovery, audit UI hides native malformed-JSON snippets,
new redaction test and evidence updated. Local174backend/193frontend PASS.

- `backend/src/test/java/com/aitrading/AiTradingApplicationTests.java`
- `docs/execution-state.md`
- `frontend/src/audit/Audit.test.tsx`
- `frontend/src/audit/api.ts`
- `specs/PB-024/revision-history.md`
- `specs/PB-024/test-evidence/results.md`
- `specs/PB-024/test-evidence/verification.json`
- `specs/PB-024/test-evidence/change-scope.md`
