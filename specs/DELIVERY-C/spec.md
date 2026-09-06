# Delivery C — Forex identity and chart timezone

## Mục tiêu

Giúp cặp Forex dễ nhận biết bằng cờ tiền tệ/vector icon và làm nhất quán timezone trên clock, time axis và crosshair. Dữ liệu nguồn vẫn là UTC; timezone chỉ là lớp hiển thị.

## Use case / acceptance criteria

**UC-C1 — Đọc một biểu đồ Forex.** Người dùng mở Symbol Search, lọc Forex, thấy cờ base/quote, chọn cặp và thấy feed ECB EOD cùng timeframe 1D. Người dùng chọn IANA hoặc fixed UTC offset; clock, trục thời gian và crosshair dùng cùng lựa chọn.

- Không dùng emoji làm fallback duy nhất cho crypto; Forex có cờ base/quote và nhãn accessible.
- Timezone options có Exchange/Local/UTC, IANA phổ biến và UTC−05:00, UTC+07:00, UTC+09:00 fixed.
- DST chỉ áp dụng cho IANA zone; fixed offset không thay đổi theo mùa.
- Không đổi timestamp lưu trữ hay dữ liệu nến.

## Data/ERD and security

Không đổi schema. `ChartSettings.timezone` là state hiển thị giới hạn trong whitelist; không nhận code/HTML từ người dùng.

## Definition of Done

Unit tests cho fixed offset/IANA, existing Forex picker tests, lint/build và tài liệu bằng chứng.
