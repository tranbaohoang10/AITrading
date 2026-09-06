# Tasks

- [x] B-T1 Chốt spec, use case, acceptance criteria, sequence/class/ERD và security notes.
- [x] B-T2 Thêm tabs Overview / Trades / AI Review nhưng giữ authoritative JournalProvider.
- [x] B-T3 Giữ optimistic version, retry idempotent, dirty draft guard và saved-only evaluation.
- [x] B-T4 Bổ sung component test cho navigation và chạy regression suite.
- [x] B-T5 Commit/push/Issue close sau khi hoàn tất toàn bộ delivery run. Shared regression and CI run 34025148491 passed at final SHA `c1ddac30081c4ed0661383e21bc8cc452b25e2e9`.

## Rework requested 06/09/2026

- [ ] J-R1 Contract tests cho real tabs, period modes, month grid, day drawer, numbered pagination và timeframe.
- [ ] J-R2 Backend numbered-page API + total count, giữ cursor API tương thích.
- [ ] J-R3 Timezone-aware Day/Week/Month range helpers.
- [ ] J-R4–J-R8 Journal header, Overview, Trades, drawer và Review theo `rework-plan.md`.
- [ ] J-R9 Responsive/accessibility browser QA 1440/1024/390.
- [ ] J-R10 Full verification, commit/push/CI; chỉ đóng lại Issue #43 khi toàn bộ DoD PASS.
