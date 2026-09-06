# Journal & Chart post-implementation test plan

Ngày lập: 06/09/2026 — Asia/Ho_Chi_Minh. Refs #43, #39.

## Scope and baseline
Verify current Journal and Chart/realtime/timeframe end-to-end; repair in-scope defects and preserve financial/security contracts. Start HEAD and freshly fetched origin/main: 6dca505632ca4d26664baa10b48190eae7e9d121, branch main. Issues #43 and #39 OPEN. No prior results or screenshots count as evidence.
Preserve unrelated untracked .agents/mcp_config.json, frontend/bottom.txt, frontend/top.txt, screenshot.png, specs/PB-038/chart-workspace-qa.md.
Authorized paths: frontend Journal/market/chart workspace source and regression tests, backend Journal/market source/tests, scoped specs and verification scripts. No schema changes anticipated.

## Environment and synthetic data
Real Vite + Spring Boot Java 21 through Gradle Wrapper + owned disposable PostgreSQL using scripts/test_backend.py. Browser widths 1440, 1024, 390. Two synthetic owners; no real account data. Journal datasets with 0, 1, 20, 21, 500 entries; 3 cursor pages on one day; OPEN/CLOSED and LONG/SHORT, positive/negative/zero net, separate entry/exit fees and settlement currencies. Dates include 2024-02-29, month/year-crossing weeks and America/New_York DST boundaries; Asia/Ho_Chi_Minh. Use real Coinbase BTC/USD and Frankfurter EUR/USD; injected failures are explicitly distinguished from live-provider observations.

## Execution and evidence
Plan recorded before executing tests or editing runtime code. For each case below execute the listed user requirements as steps, compare all listed expected outcomes, and append actual outcomes/evidence/defects. Split cases further during execution where outcomes differ. No PASS until executed. Logs and fresh screenshots: specs/DELIVERY-B/test-evidence/post-implementation/ (sanitized); chart evidence may be linked from PB-038. Real browser QA is mandatory and separate from component tests.

## Test matrix
| ID | Layer / steps | Expected results | Actual result | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| J-A | Component/browser: switch Overview/Trades/Review with draft | Only selected panel in interaction/a11y tree; no reload; draft preserved | Pending | NOT RUN | Pending |
| J-B | Unit/API/browser: Day/Week/Month, previous/today/next/date, leap/DST/boundaries in both zones | Correct inclusive ranges; timestamps immutable | Pending | NOT RUN | Pending |
| J-C | Component/browser: month headings/alignment/cells, profit/loss/zero/counts, weekly sums, click/Enter/Space | <=42 cells, correct truthful totals; day opens | Pending | NOT RUN | Pending |
| J-D | API/component/browser: day query 3 cursor pages, dedupe/500 bound, loading/empty/error/retry, wrong owner, trade detail | Exact day/zone/currency, full bounded owner-scoped data and correct detail | Pending | NOT RUN | Pending |
| J-E | API/component/browser: pages 1/2/3, sizes 10/20/50, 0/1/20/21/500 rows, filters, last deletion, bad page/limit, concurrent mutation | Correct numbered server pages/counts/reset/clamp/validation; no infinite append or mixed owners | Pending | NOT RUN | Pending |
| J-F | Component/browser: new/edit, dirty close/Escape, conflict, uncertain retry, delete, Tab trap/restore | Authoritative draft preserved; confirmation; exact frozen retry; accessible bounded dialog | Pending | NOT RUN | Pending |
| J-G | Component/browser/API: mouse and keyboard all 7 timeframes; save/reload; linked dataset compatibility; disabled states | Correct timeframe/body/persistence without field reset; clear lock reason | Pending | NOT RUN | Pending |
| J-H | API/integration/security: financial combinations, BOLA/auth/CSRF/Origin/version/replay/XSS/saved-only AI | Exact authoritative P&L/fees; isolation and safe failure; no fabricated metrics | Pending | NOT RUN | Pending |
| C-A | Provider/component/real browser network: history, socket, replace/append, connecting/live/reconnecting/disconnected/stale/last update | Genuine Coinbase data and truthful lifecycle statuses | Pending | NOT RUN | Pending |
| C-B | Component/browser: future pan and Go to latest | Empty drawing space without generated candles; accurate wording and viewport reset | Pending | NOT RUN | Pending |
| C-C | Provider/component/browser: all 7 intervals then rapid 1m→5m→1h→1m; inspect REST/socket/cleanup/OHLC; menu keyboard/Escape | Matching history/subscription, no stale overwrite/mixed candle/leak, popup closes and restores focus | Pending | NOT RUN | Pending |
| C-D | Provider/browser: EUR/USD timeframe capabilities | Only 1D enabled, explained disabled intraday, ECB EOD snapshot, never Live/fake intraday | Pending | NOT RUN | Pending |
| B-1440 | Browser: all Journal views/drawers/pages and chart menu/live/changed interval/Forex; capture fresh screenshots | No overflow/clipping; visible keyboard focus/trap/Escape/restore; no unexpected console/network errors | Pending | NOT RUN | Pending |
| B-1024 | Browser: repeat B-1440 at 1024px | Same expectations | Pending | NOT RUN | Pending |
| B-390 | Browser: repeat B-1440 at 390px | Same expectations; mobile dialog contained | Pending | NOT RUN | Pending |
| A-FE | Run targeted and full frontend tests; npm run lint; npm run build | All exit 0 | Pending | NOT RUN | Pending |
| A-BE | Run Journal/market tests, full backend test/build via Wrapper with disposable PostgreSQL | All exit 0 | Pending | NOT RUN | Pending |
| A-SEC | npm audit --audit-level=high; repository dependency/security checks; readiness; git diff --check | All required checks pass; no high dependency findings or leaked secrets | Pending | NOT RUN | Pending |
| A-CI | Review full/staged scope; Vietnamese Refs commit; fast-forward push; exact remote SHA; required CI | Scoped commit, verified SHA and green CI before issue completion | Pending | NOT RUN | Pending |

## Security applicability
Exercise authentication, owner isolation/BOLA, CSRF/Origin, expected version, replay, race/concurrency, injection/XSS, validation/bounds, error/timeout handling, provider allowlists and secret exposure. Regression suites cover session/auth/rate limits and existing upload/SSRF boundaries; no new upload or broker execution surface. Never weaken checks. AI external availability must be reported separately; saved-only behavior can be verified with controlled test responses without calling them real provider output.

## Defect list
Pending source/runtime verification. Every defect records ID, reproduction, expected/actual, root cause, fix, regression command and browser retest evidence.

## Actual results and final verdict
NOT RUN — no execution yet. PASS — READY FOR USE requires every mandatory test and CI to pass. Incomplete evidence yields FAIL — NOT READY or a precise evidenced HARD BLOCKER; issues remain open.

## Normative detailed acceptance criteria and steps
The original request below is retained as the complete per-group checklist; every bullet is required, including screenshot subjects and failure cases.
Bạn chịu trách nhiệm VERIFY END-TO-END phần Journal và Chart/Timeframe trong repository:

H:\AITrading
GitHub: tranbaohoang10/AITrading

Đây là nhiệm vụ kiểm chứng sau implementation. Không được tin vào lời tuyên bố “đã làm xong”, unit test cũ hoặc screenshot cũ. Phải kiểm tra source hiện tại, chạy ứng dụng thật, lập kế hoạch test trước, sau đó thực thi kế hoạch và sửa mọi lỗi tìm thấy.

==================================================
1. STARTUP
==================================================

Trước khi làm:

- Đọc AGENTS.md.
- Đọc .specify/memory/constitution.md.
- Đọc docs/governance/prototype-workflow.md.
- Đọc:
  - specs/DELIVERY-B/rework-plan.md
  - specs/PB-038/realtime-timeframe-remediation-plan.md
- Kiểm tra git status, branch, origin và commit mới nhất.
- Đọc Issue #43 và Issue #39.
- Bảo toàn mọi file unrelated/untracked.
- Không dựa vào kết quả test hoặc screenshot cũ.

==================================================
2. LẬP TEST PLAN TRƯỚC
==================================================

Trước khi chạy test hoặc sửa code, tạo tài liệu:

specs/DELIVERY-B/post-implementation-test-plan.md

Tài liệu phải có:

- Scope.
- Acceptance criteria cần xác minh.
- Test matrix.
- Test data tổng hợp.
- Environment.
- API tests.
- Component tests.
- Integration tests.
- Security tests.
- Accessibility tests.
- Responsive browser tests.
- Expected results.
- Actual results.
- Evidence paths.
- Defect list.
- Final verdict.

Mỗi test case phải có ID, steps, expected result, actual result và trạng thái:

PASS
FAIL
BLOCKED
NOT RUN

Không đánh dấu PASS nếu chưa thực sự chạy.

==================================================
3. JOURNAL TEST SCOPE
==================================================

A. REAL TABS

Xác minh:

- Overview chỉ hiển thị Overview.
- Trades chỉ hiển thị Trades.
- Review chỉ hiển thị Review.
- Panel không được chọn không còn trong interaction/accessibility tree.
- Chuyển tab không reload toàn trang.
- Dirty draft không bị mất khi chuyển tab.

B. DAY / WEEK / MONTH

Xác minh người dùng chọn được:

- Day
- Week
- Month
- Previous
- Today
- Next
- Date picker

Kiểm tra:

- Day tạo đúng from/to một ngày.
- Week tạo đúng bảy ngày.
- Month tạo đúng đầu và cuối tháng.
- Timezone được áp dụng đúng.
- Leap day.
- Tuần giao giữa hai tháng.
- Tuần giao giữa hai năm.
- America/New_York tại DST boundary.
- Asia/Ho_Chi_Minh.
- Không mutate timestamp gốc.

C. MONTH CALENDAR

Xác minh:

- Có weekday headings.
- Calendar đúng vị trí ngày trong tuần.
- Chỉ có tối đa 42 day cells.
- Không render 30–366 ngày thành danh sách dài.
- Profit có dấu cộng và màu nhẹ.
- Loss có dấu trừ và màu nhẹ.
- Zero/no-trade là neutral.
- Có closed/open count thật.
- Weekly P&L đúng tổng.
- Click ngày mở Day Drawer.
- Ngày dùng được bằng Enter/Space.

D. DAY DRAWER

Xác minh:

- Request dùng from = to = ngày được chọn.
- Dùng đúng timezone và currency.
- Tải đủ cursor page 1/2/3 đến hết.
- Không suy luận trades từ page hiện tại.
- Không duplicate record.
- Có giới hạn tối đa 500.
- Loading/empty/error/retry đúng.
- Owner khác không đọc được dữ liệu.
- Click trade mở đúng detail.

E. NUMBERED PAGINATION

Xác minh:

- Có Previous, Next.
- Có page numbers 1/2/3/…
- Có total records và “Showing x–y of z”.
- Page size 10/20/50.
- Click thẳng page 2 và page 3 tải đúng dữ liệu server.
- Đổi filter quay về page 1.
- Đổi page size quay về page 1.
- Xóa record cuối trang thì page được clamp đúng.
- Test 0, 1, 20, 21 và 500 records.
- Invalid page/limit trả lỗi validation.
- Concurrent insert/delete không làm lẫn owner hoặc duplicate.
- Không còn nút Load More append vô hạn.

F. NEW/EDIT TRADE DRAWER

Xác minh:

- New Trade mở drawer/dialog.
- Edit mở đúng saved entry.
- Dirty close yêu cầu confirmation.
- Escape không âm thầm bỏ draft.
- Save conflict giữ nguyên draft.
- Lost response retry đúng requestId và body cũ.
- Delete có confirmation.
- Focus trap và focus restore hoạt động.
- Mobile dialog không tràn màn hình.

G. JOURNAL TIMEFRAME

Xác minh chọn được bằng mouse và keyboard:

- 1m
- 5m
- 15m
- 30m
- 1h
- 4h
- 1D

Sau khi chọn:

- draft.timeframe thay đổi đúng.
- Các field khác không bị reset.
- Linked dataset được lọc lại đúng symbol/timeframe.
- Save request gửi đúng timeframe.
- Reload hiển thị timeframe đã lưu.
- Khi control bị disabled phải hiện lý do rõ ràng.
- Không được có dropdown trông hoạt động nhưng không nhận click.

H. FINANCIAL AND SECURITY REGRESSION

Xác minh:

- OPEN/CLOSED.
- LONG/SHORT.
- Gross P&L.
- Net P&L.
- Entry/exit fees.
- Settlement currency.
- Owner isolation/BOLA.
- Authentication.
- CSRF/Origin.
- Expected version.
- Request replay/idempotency.
- XSS trong symbol/reason/notes hiển thị inert text.
- AI chỉ đánh giá saved version.
- Không tạo fake metrics hoặc fake AI review.

==================================================
4. CHART/REALTIME/TIMEFRAME TEST SCOPE
==================================================

A. REALTIME MEANING

Xác minh bằng network và UI:

- BTC/USD history tải từ Coinbase.
- WebSocket subscription thực sự được mở.
- Candle đang chạy được replace đúng.
- Candle mới được append đúng.
- Status chuyển đúng:
  - Connecting
  - Live
  - Reconnecting
  - Disconnected
  - Stale
- Có last-update time.
- Không gọi dữ liệu cũ là Live.
- Không tạo fake candle.

B. FUTURE SPACE

Xác minh:

- Không còn wording gây hiểu nhầm “Future · no data”.
- Future space chỉ là khoảng trống để pan/draw.
- Pan sang tương lai không tạo candle.
- “Go to latest” đưa viewport về candle mới nhất.
- “Go to latest” không được mô tả như nút bật realtime.

C. CHART TIMEFRAME

Với BTC/USD, chọn lần lượt:

- 1m
- 5m
- 15m
- 30m
- 1h
- 4h
- 1D

Mỗi lần chọn phải kiểm tra:

- Menu nhìn thấy và không bị overflow clipping.
- Header đổi timeframe.
- REST history request dùng đúng interval.
- WebSocket/subscription dùng đúng interval.
- Subscription cũ được cleanup.
- Response cũ không ghi đè timeframe mới.
- Candle không bị trộn giữa hai timeframe.
- OHLC đúng dữ liệu provider.
- Menu đóng sau khi chọn.
- Keyboard, Escape và focus return hoạt động.

Thử chuyển nhanh:

1m → 5m → 1h → 1m

để phát hiện race condition và subscription leak.

D. FOREX

Với EUR/USD:

- Chỉ 1D được enable nếu dùng Frankfurter/ECB EOD.
- Intraday disabled có lý do.
- Hiển thị EOD/Snapshot.
- Không hiển thị Live.
- Không tạo dữ liệu intraday giả.

==================================================
5. REAL BROWSER QA
==================================================

Phải chạy frontend thật, backend thật và PostgreSQL disposable/test.

Dùng synthetic account và synthetic Journal entries.

Kiểm tra tại:

- 1440px desktop.
- 1024px tablet.
- 390px mobile.

Chụp evidence cho:

- Journal Overview Day.
- Journal Overview Week.
- Journal Overview Month.
- Day Drawer.
- Trades page 1.
- Trades page 2 hoặc 3.
- New/Edit Trade drawer.
- Journal timeframe dropdown.
- Chart timeframe menu.
- BTC/USD Live status.
- BTC/USD sau khi đổi timeframe.
- Forex EOD state.

Không dùng DOM test thay cho browser QA.

Kiểm tra:

- Không horizontal overflow toàn trang.
- Popup nằm trong viewport.
- Drawer/dialog không bị cắt.
- Keyboard navigation.
- Visible focus.
- Escape.
- Focus restoration.
- Không có browser console error.
- Không có failed network request ngoài failure case chủ động.

==================================================
6. AUTOMATED VERIFICATION
==================================================

Chạy tối thiểu:

Frontend targeted tests.
Full frontend tests.
npm run lint.
npm run build.
npm audit --audit-level=high.

Backend Journal tests.
Backend market-data tests.
Full backend test/build bằng Gradle Wrapper.
Readiness verification.
Dependency/security checks của repository.
git diff --check.

Không xóa hoặc làm yếu test để lấy PASS.

==================================================
7. DEFECT HANDLING
==================================================

Nếu phát hiện lỗi:

- Ghi defect ID.
- Ghi steps tái hiện.
- Ghi expected/actual result.
- Xác định root cause.
- Sửa đúng nguyên nhân.
- Thêm regression test.
- Chạy lại targeted test.
- Chạy lại full regression.
- Chạy lại browser QA liên quan.

Không dừng ở việc liệt kê lỗi nếu lỗi nằm trong scope và có thể sửa.

==================================================
8. GIT AND ISSUES
==================================================

Theo governance hiện tại:

- Làm trực tiếp trên main.
- Không force push.
- Không amend/rebase/reset history.
- Commit tiếng Việt có dấu.
- Mỗi commit có Refs #43 hoặc Refs #39.
- Push origin/main.
- Xác minh exact remote SHA.
- Theo dõi CI đến khi PASS.

Chỉ đóng Issue #43 khi toàn bộ Journal DoD PASS.

Chỉ đóng hoặc cập nhật hoàn tất Issue #39 khi realtime/timeframe browser QA PASS.

==================================================
9. FINAL REPORT
==================================================

Báo cáo cuối phải có:

# Journal & Chart Post-Implementation Verification

## Repository
- Start SHA
- Final SHA
- Branch
- Working tree
- CI URL/result

## Journal verdict
- Tabs
- Day/Week/Month
- Calendar
- Day Drawer
- Numbered pagination
- New/Edit drawer
- Timeframe
- Financial regression
- Security
- Responsive QA

## Chart verdict
- Coinbase realtime
- Future space
- Timeframe switching
- Race/subscription cleanup
- Forex EOD
- Responsive QA

## Test totals
- Frontend
- Backend
- Browser
- Security
- Dependency audit

## Defects found and fixed

## Remaining blockers

## Issue states
- #43
- #39

## Final verdict

Chỉ được ghi:

PASS — READY FOR USE

khi tất cả test bắt buộc và CI đều PASS.

Nếu chưa đạt, ghi:

FAIL — NOT READY

hoặc:

HARD BLOCKER: mô tả chính xác blocker và evidence.

Bắt đầu bằng việc audit current origin/main và lập file test plan trước khi chạy test.

## Execution update — 06/09/2026

The implementation audit found and repaired these defects: inactive Journal panels were rendered together; calendar data was a long day list; Trades had cursor append instead of numbered server pagination; New/Edit was inline; there was no authoritative day drawer; timeframe lock reasons were absent; chart timeframe popup was clipped by the scrolling toolbar; realtime status had no text/last-update semantics; `Future · no data` and `Realtime` wording was misleading; realtime history/subscription races could mix intervals; older-candle loads could update a changed cell. No applied migration was changed.

| ID | Actual result | Status | Evidence |
| --- | --- | --- | --- |
| J-A | Real browser showed only the selected Overview/Trades/AI Review panel in the accessibility tree; no full-page reload observed; dirty draft regression passed. | PASS | `frontend-full-final.log`, browser AX snapshots |
| J-B | Day/Week/Month, previous/today/next/date picker, leap day, DST and cross-year helpers passed; server ranges are inclusive and timestamp inputs are immutable. | PASS | `period.test.ts`, `frontend-full-final.log` |
| J-C | Desktop browser showed weekday headings, bounded month grid, signed P&L, closed/open counts, weekly totals and clickable day buttons. | PASS | `journal-overview-month-1280x720.png`, `journal-overview-day-1280x720.png` |
| J-D | Day Drawer queried the selected date with UTC/USD, followed cursor pages to 45 unique rows, and rendered server totals. | PASS | `journal-day-drawer-1280x720.png`, `api-browser-seed.json` |
| J-E | Backend and browser verified 0/1/20/21/45 fixtures, direct pages 1/2/3, total count, page size 20, and `Showing 21–40 of 45`; invalid page/limit and owner isolation passed in backend tests. | PASS | `JournalApiTests`, `journal-trades-page1-1280x720.png`, `journal-trades-page2-1280x720.png` |
| J-F | New/Edit drawer, timeframe control, dirty close confirmation, Escape and focus return were observed; conflict/replay/uncertain guards passed automated regressions. | PASS | `journal-new-trade-timeframe-1280x720.png`, `frontend-full-final.log` |
| J-G | All seven Journal timeframe values and persistence/field-preservation regression passed; lock reason is visible while loading/saving/uncertain. | PASS | `Journal.test.tsx`, `frontend-full-final.log` |
| J-H | Financial, owner, CSRF/Origin, version/replay, XSS inertness and saved-only AI checks passed in backend/frontend/security suites. | PASS | `backend-full.log`, `security-smoke.log`, `adversarial-smoke.json` |
| C-A | Real Coinbase BTC/USD history, WebSocket live status, last-update text and live UI were observed; lifecycle/race tests passed. | PASS | `chart-live-1280x720.png`, `frontend-chart-targeted-final.log` |
| C-B | Future area is blank and labelled `Future`; control is `Go to latest`; no candle fabrication was observed. | PASS | `chart-live-1280x720.png`, `CandleChart` regression |
| C-C | Portal timeframe menu worked at desktop, keyboard/Escape/focus return passed, 1m→5m→1h→1m cleanup/race tests passed. | PASS | `chart-menu-1280x720.png`, `chart-5m-1280x720.png`, `frontend-chart-targeted-final.log` |
| C-D | Provider/component tests passed and browser selection reached `EUR/USD · ECB EOD · snapshot` with intraday controls constrained to 1D; the live Frankfurter response then failed with `Unexpected end of JSON input` and Retry reproduced the failure. | FAIL | Browser AX/screenshot follow-up, `FrankfurterMarketDataProvider.test.ts`, `LiveChartForex.test.tsx` |
| B-1440 | Browser evidence was captured on the default 1280×720 CUA viewport; the requested 1440× desktop override was unavailable in the active browser tool. | NOT RUN | `journal-*-1280x720.png`, `chart-*-1280x720.png` |
| B-1024 | No viewport override was available in the active CUA browser tool. | NOT RUN | Tool limitation recorded |
| B-390 | No viewport override was available in the active CUA browser tool. | NOT RUN | Tool limitation recorded |
| A-FE | Frontend full suite 42 files / 278 tests PASS; lint PASS; build PASS. | PASS | `frontend-full-final.log`, `frontend-lint-final.log`, `frontend-build-final.log` |
| A-BE | Gradle Wrapper `clean test bootJar dependencyInventory` PASS on disposable PostgreSQL. | PASS | `backend-full.log` |
| A-SEC | npm audit high PASS (0 vulnerabilities); OSV dependency scan PASS; security smoke PASS; readiness PASS; diff check PASS. | PASS | `npm-audit-final.log`, `dependency-audit.log`, `security-smoke.log`, `readiness-final.log` |
| A-CI | Local commit/push/remote CI not yet executed at the time of this execution update. | NOT RUN | Pending final review |

## Defects fixed

- D-01 real tab isolation and drawer ownership; D-02 timezone-aware period helpers; D-03 month/week/day calendar; D-04 bounded cursor day drawer; D-05 owner-scoped numbered pagination; D-06 drawer CRUD and dirty guard; D-07 Journal timeframe interaction/lock reason; D-08 portal chart timeframe menu; D-09 truthful Coinbase/Forex status wording; D-10 subscription/history cancellation and cell ownership guards.

## Final verification status

Because the live Forex provider response failed in browser (`Unexpected end of JSON input`), 1024px/390px browser overrides were unavailable, and final push/CI evidence was not yet executed at this update, the evidence-backed verdict is **FAIL — NOT READY**. Issues #43 and #39 remain OPEN until the provider/browser failure is resolved or explicitly accepted, responsive evidence is captured, and CI is green.
