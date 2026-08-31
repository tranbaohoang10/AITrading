# PB-022 reviewed change scope

31/08/2026. Baseline401f9691a35a536127effd65746ddeeeb608beab, main.

PRE-EXISTING CHANGES: clean at PB022 selection. Protected historical files
`specs/mvp-ui/defects/BUG-001.md` and `specs/mvp-ui/review/review-report.md`
are absent on main and unchanged on feature/mvp-ui. Verified blobs
e03fe3d3fcdc7eef83d83f819ca848c6b8e49b39 and
5fb05f3f5d82640776c77283bacb8e529344c067. Neither staged nor committed.

TASK CHANGES: V12 adds transactional unique terminal notices; three Java classes
provide owner API/read state/retention; nine actual integration cases and migration
version expectation; bounded frontend transport/inbox/eight tests, one workspace
mount. Smoke script verifies real Python/API/PG data through API restart.
README and PB022 CNPM/test/evidence explain contracts, operations and limits.
Backlog/execution plus PB024 tasks/history only record already verified delivery
401f969/CI33393395877/Issue19 completed; no PB024 feature implementation repeated.

No applied V1–V11 migration, engine, dependency/lockfile, CI/security gate, stack,
credit/payment or live-money change. Three screenshots visually reviewed; all
accounts/data synthetic. Text/JSON reviewed; candidate credential/private-key
patterns scan found no matches. Synthetic fixture passwords are test-only. This
scoped scan plus review is not a claim of universal secret detection.

Exact files for this feature commit:

- `README.md`
- `backend/src/main/java/com/aitrading/notification/NotificationController.java`
- `backend/src/main/java/com/aitrading/notification/NotificationRetention.java`
- `backend/src/main/java/com/aitrading/notification/NotificationService.java`
- `backend/src/main/resources/db/migration/V12__backtest_notifications.sql`
- `backend/src/test/java/com/aitrading/AiTradingApplicationTests.java`
- `backend/src/test/java/com/aitrading/NotificationApiTests.java`
- `docs/execution-state.md`
- `docs/product-backlog.md`
- `frontend/src/backtest/BacktestWorkspace.tsx`
- `frontend/src/notification/Notification.test.tsx`
- `frontend/src/notification/NotificationPanel.tsx`
- `frontend/src/notification/api.ts`
- `scripts/smoke_notifications.py`
- `specs/PB-022/design.md`
- `specs/PB-022/revision-history.md`
- `specs/PB-022/spec.md`
- `specs/PB-022/tasks.md`
- `specs/PB-022/test-cases.md`
- `specs/PB-022/test-evidence/b-isolated-after-a-denied.txt`
- `specs/PB-022/test-evidence/change-scope.md`
- `specs/PB-022/test-evidence/deleted-job.txt`
- `specs/PB-022/test-evidence/desktop-after-read.txt`
- `specs/PB-022/test-evidence/desktop-before-read.jpg`
- `specs/PB-022/test-evidence/desktop-before-read.txt`
- `specs/PB-022/test-evidence/mobile.jpg`
- `specs/PB-022/test-evidence/mobile.txt`
- `specs/PB-022/test-evidence/open-owned-job.txt`
- `specs/PB-022/test-evidence/reloaded-a.txt`
- `specs/PB-022/test-evidence/restart-smoke.json`
- `specs/PB-022/test-evidence/results.md`
- `specs/PB-022/test-evidence/stale-a-before.txt`
- `specs/PB-022/test-evidence/stale-a-denied.txt`
- `specs/PB-022/test-evidence/tablet.jpg`
- `specs/PB-022/test-evidence/tablet.txt`
- `specs/PB-022/test-evidence/verification.json`
- `specs/PB-024/revision-history.md`
- `specs/PB-024/tasks.md`
