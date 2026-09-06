# Delivery B — Journal workspace

## Mục tiêu

Tổ chức lại nhật ký giao dịch riêng tư thành ba khu vực có tên rõ ràng: Overview, Trades và AI Review. Dữ liệu được lấy từ JournalProvider hiện có; không tạo lệnh broker và không gửi bản nháp chưa lưu tới AI.

## Use case

**UC-B1 — Theo dõi và đánh giá một giao dịch đã lưu.** Người dùng mở Journal, chọn khoảng ngày/múi giờ/đơn vị thanh toán, xem tổng P&L thực nhận, chọn một giao dịch, chỉnh sửa bản nháp và chỉ sau khi lưu mới yêu cầu AI Review.

## Acceptance criteria

- Overview hiển thị bộ lọc báo cáo, tổng realized P&L, phí, wins/losses và lịch P&L theo ngày.
- Trades hiển thị danh sách có phân trang, form nhập/sửa, chart context và các trạng thái OPEN/CLOSED rõ ràng.
- AI Review hiển thị điểm/rubric của bản ghi đã lưu; bản nháp bẩn bị khóa nút review và nêu rõ lý do.
- Múi giờ báo cáo là IANA/UTC, ngày bao hàm và giới hạn 366 ngày; không tự ý chuyển đổi giá.
- Luồng save/delete giữ request idempotency, optimistic version và retry cùng intent khi kết quả không chắc chắn.
- XSS được hiển thị như text, owner scoping/CSRF/Origin và lỗi provider được bảo toàn.

## Out of scope

Không thêm broker order, unrealized P&L, FX conversion hay chấm điểm chất lượng bản nháp chưa lưu.

## Definition of Done

UI, test component, tài liệu CNPM và regression checks đều có bằng chứng. AI provider vẫn có thể ở trạng thái unavailable nếu chưa cấu hình credential; UI phải nói thật trạng thái đó.
