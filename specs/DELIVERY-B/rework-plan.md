# Journal UX rework plan — Issue #43

Ngày lập: 06/09/2026, Asia/Ho_Chi_Minh. Đây là tài liệu bàn giao triển khai; chưa thay đổi runtime code.

## 1. Mục tiêu đã chốt

Biến Journal thành workspace thực sự có ba khu vực độc lập `Overview`, `Trades`, `Review`; cho người dùng chọn kỳ `Day / Week / Month`, chuyển kỳ trước/hiện tại/sau, chọn ngày bằng date picker và duyệt danh sách giao dịch bằng phân trang số `1 / 2 / 3 / …`.

Giữ nguyên server-side realized P&L, OPEN/CLOSED, LONG/SHORT, owner scoping, CSRF/Origin, optimistic version, request replay, dirty draft, frozen uncertain retry và AI chỉ đánh giá bản đã lưu.

## 2. Audit hiện trạng và nguyên nhân

1. `JournalWorkspace.tsx` có state `section`, nhưng cả Overview, Trades và Review vẫn render đồng thời. Tab chỉ đổi `aria-selected` và dòng mô tả; đây là lý do màn hình vẫn dài và không hoạt động như tab.
2. Calendar dùng `journal.report.days.map(...)` trực tiếp. Filter dài nhiều tháng sẽ hiển thị hàng chục hoặc hàng trăm ô ngày liên tiếp thay vì calendar theo tháng.
3. Trades dùng cursor và nối item qua nút `More journal entries`; chưa có page number, tổng bản ghi hoặc tổng số trang.
4. Form New/Edit luôn nằm dưới danh sách. Nó cần chuyển vào drawer/dialog và vẫn dùng đúng draft duy nhất từ `JournalProvider`.
5. Ô ngày chưa phải button và chưa có `JournalDayDrawer`; người dùng chưa thể drill down một ngày.
6. Timeframe có các option `1m, 5m, 15m, 30m, 1h, 4h, 1d`, nhưng toàn bộ fieldset bị disable khi `loading`, `busy`, `uncertain` hoặc có confirmation. UI chưa giải thích trạng thái khóa nên dropdown trông như bị hỏng.
7. API cursor hiện tại không trả `totalItems/totalPages` và không hỗ trợ nhảy trực tiếp tới trang số.

## 3. Pattern tham khảo và quyết định sử dụng

- **TradesViz**: calendar tháng là màn hình chính, có weekly P&L, click ngày mở Day Explore và có góc nhìn tháng/tuần. Áp dụng drill-down và weekly summary.
- **TradeZella**: calendar trình bày monthly total, weekly breakdown, daily stats; session recap chọn kỳ theo ngày/tuần/tháng. Áp dụng segmented period selector và header điều hướng kỳ.
- **TraderSync**: report tôn trọng timezone và cơ sở ngày giao dịch. Áp dụng timezone/currency luôn hiện cạnh kỳ đang xem.

Không sao chép mã, CSS, asset hay branding. UI giữ Quant identity: nền `#111214`, surface `#151619/#1c1d20`, border mảnh, Inter 11–16px, green/red nhẹ và mật độ cao.

## 4. Information architecture

```text
Journal   Sep 2026 · Asia/Ho_Chi_Minh · USD        Filters   + New Trade
Overview | Trades | Review
Day | Week | Month        ‹ Previous   Today   Next ›        [date picker]
```

- Tab phải thực sự ẩn panel không được chọn; chỉ panel active tồn tại trong interaction/accessibility tree.
- `Day / Week / Month` dùng chung `anchorDate`.
- Previous/Next dịch đúng một ngày, tuần hoặc tháng. `Today` dùng ngày hiện tại trong timezone báo cáo.
- Date picker chọn anchor; `from/to` derive từ `mode + anchorDate + timezone`.
- Custom range giữ trong Filters nâng cao nhưng không được vẽ thành calendar nhiều tháng trong Overview.

### Overview

- KPI: Net P&L, Gross P&L, Fees, Closed/Open; secondary Wins/Losses/Breakeven.
- **Day**: một summary ngày và danh sách giao dịch của ngày.
- **Week**: đúng 7 ngày, weekly total ở header; mỗi ngày có P&L và closed/open count.
- **Month**: weekday header + 5/6 hàng tuần; tối đa 42 ô, ngày ngoài tháng muted/trống; weekly P&L ở cuối mỗi hàng.
- Profit/loss/zero dùng màu nhẹ và dấu `+/-`, không chỉ dựa vào màu.
- Click/Enter/Space trên ngày mở `JournalDayDrawer`.
- Recent trades chỉ 5–8 bản ghi thật, có `View all trades` sang tab Trades.

### JournalDayDrawer

- Query server với `from = to = selectedDate`, timezone và currency hiện tại.
- Lặp cursor có giới hạn đến hết trang hoặc account bound 500; không lấy dữ liệu từ page Trades đang nhìn.
- Hiển thị daily totals và rows Date/Symbol/Side/State/Net P&L.
- Click row mở Trade Detail mà không mất ngày đã chọn.

### Trades

- Toolbar: period summary, from/to, timezone, currency, page size 10/20/50 và `+ New Trade`.
- Desktop table: Activity Date, Symbol, Side, Timeframe, Entry, Exit, Net P&L, State.
- Mobile dùng compact rows, không ép table tràn ngang toàn trang.
- Footer có Previous, page numbers quanh trang hiện tại, ellipsis, Next và `Showing x–y of z`.
- Đổi filter/page size quay về trang 1. Xóa record ở trang cuối phải clamp trang hợp lệ.
- Không append vô hạn và không render cùng lúc hàng trăm row.

### New/Edit Trade

- `+ New Trade` mở drawer desktop và near-full-screen dialog mobile.
- Sections: Instrument, Entry, State/Exit, Journal, Context.
- Timeframe là control rõ ràng với `1m, 5m, 15m, 30m, 1h, 4h, 1D`; enabled khi draft được phép edit.
- Nếu bị khóa do loading/save/uncertain outcome, hiển thị lý do cạnh control.
- Chọn timeframe cập nhật `draft.timeframe`, lọc lại linked datasets và giữ các field khác.
- Dirty close, conflict, retry và delete dùng guard hiện có.

### Review

- Danh sách trade đã lưu ở trái, review chi tiết ở phải; mobile dùng một cột.
- Chỉ fetch evaluation của trade được chọn; không N+1 toàn bộ danh sách.
- Giữ READY/INSUFFICIENT/PENDING/FAILED/CANCELLED/STALE và rubric thật.

## 5. API và state plan

Giữ endpoint cursor hiện tại cho Day Drawer và consumer cũ. Thêm endpoint owner-scoped:

```http
GET /api/journal/page?from=...&to=...&zone=...&currency=USD&page=1&limit=20
```

Response gồm `filter`, `items`, `page`, `pageSize`, `totalItems`, `totalPages`.

- `page` base 1; giới hạn bởi account maximum 500; `limit` chỉ nhận 10/20/50.
- Count và page query dùng cùng owner/range/currency predicate và sort `COALESCE(exit_time, entry_time) DESC, id DESC`.
- Không nhận owner id từ query/body. Không thay đổi bảng/Flyway.
- Concurrent insert/delete: response mới là authoritative; UI clamp page và reset khi filter đổi.

Frontend bổ sung `activeSection`, `periodMode`, `anchorDate`, `tradePage`, `pageSize`, `selectedDay`, `editorOpen`. `JournalProvider` vẫn sở hữu draft, selected entry, mutation intent và safety guards. Không copy draft sang component khác. Summary và paged trades có request epoch/AbortController riêng để response cũ không ghi đè filter mới.

## 6. Component plan

```text
JournalWorkspace
├─ JournalHeader
├─ JournalPeriodToolbar
├─ JournalOverview
│  ├─ JournalMetricStrip
│  ├─ JournalDayView / JournalWeekView / JournalMonthCalendar
│  └─ JournalDayDrawer
├─ JournalTrades
│  ├─ JournalTradeTable
│  └─ JournalPagination
├─ JournalReview
└─ JournalTradeDrawer
   └─ authoritative JournalProvider draft
```

Không thêm global state library hoặc design-system dependency.

## 7. Acceptance criteria

1. Chuyển tab chỉ hiển thị panel tương ứng; không còn một trang chứa cả calendar, list, form và review.
2. Chọn được Day/Week/Month; Previous/Today/Next/date picker tạo đúng inclusive range theo timezone.
3. Month chỉ render calendar tối đa 42 day cells và weekly summaries.
4. Các mode dùng totals thật từ server, không tạo analytics giả.
5. Click ngày tải đầy đủ dữ liệu ngày bằng API, không suy luận từ page Trades.
6. Trades có pagination số, total count, page size và direct page navigation; bỏ `Load more` append.
7. New/Edit nằm trong drawer/dialog; dirty draft và uncertain retry giữ nguyên.
8. Timeframe chọn được bằng mouse/keyboard khi editable; đổi option cập nhật draft và dataset compatibility.
9. Disabled timeframe luôn có lý do nhìn thấy được.
10. P&L, owner isolation, CSRF/Origin, version conflict và AI saved-only không đổi.
11. Responsive QA PASS ở 1440/1024/390, không page-level horizontal overflow.
12. Keyboard focus, Escape/dirty guard và focus restore PASS.

## 8. Implementation tasks cho AI tiếp theo

1. **J-R1:** thêm failing contract tests cho real tabs, period modes, month grid, day drawer, numbered pagination và timeframe edit.
2. **J-R2:** thêm backend numbered-page API + total count; giữ cursor API.
3. **J-R3:** tạo pure timezone-aware day/week/month range helpers; test leap day, DST và boundary.
4. **J-R4:** real tabs, compact header, period toolbar và filter summary.
5. **J-R5:** month/week/day views, weekly total và authoritative day drawer.
6. **J-R6:** Trades table/card, numbered pagination, page size và states.
7. **J-R7:** chuyển form vào drawer; sửa timeframe interaction và lock reason.
8. **J-R8:** Review master-detail, giữ evaluation contract.
9. **J-R9:** responsive/a11y/browser QA 1440/1024/390.
10. **J-R10:** targeted/full frontend, backend Journal/security suite, lint/build/audit, disposable PostgreSQL browser QA, diff review, commit/push/CI rồi mới đóng #43.

## 9. Required tests

- Tabs: inactive panel absent/hidden; no full-page reload.
- Period: day/week/month, previous/next/today, date picker, leap day, DST, week/month/year boundary.
- Calendar: weekday alignment, leading/trailing cells, max 42, profit/loss/zero/no-trade, weekly totals.
- Day Drawer: cursor 1/2/3, dedupe, full bound, server error, stale response, owner isolation.
- Pagination: 0/1/20/21/500 records, direct page 1/2/3, last-page delete, filter reset, invalid page/limit.
- Timeframe: all options mouse/keyboard, draft update, dataset compatibility, locked reason, retry state.
- CRUD/security: exact gross/net/fees, conflict, replay, CSRF, BOLA, XSS inert text.
- Browser: real create/edit/delete, period/page switching và responsive screenshots.

## 10. Exclusions và handoff

Không thêm Sharpe, expectancy, drawdown, average R, broker sync hoặc aggregate AI analytics khi backend chưa có dữ liệu thật.

AI triển khai bắt đầu từ current `origin/main`, đọc AGENTS/Constitution, dùng Issue #43, bảo toàn file unrelated, làm J-R1 → J-R10 và không đánh dấu DONE chỉ vì tab click được. DoD yêu cầu UI thực tế, API phân trang số, browser QA và CI PASS.
