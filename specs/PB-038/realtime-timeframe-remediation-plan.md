# Chart realtime/timeframe remediation plan — Issue #39

Ngày lập: 06/09/2026, Asia/Ho_Chi_Minh. Đây là tài liệu bàn giao fix; chưa thay đổi runtime code.

## Audit facts

- BTC/USD dùng Coinbase public REST để tải history và WebSocket để merge candle realtime. Chấm xanh trong ảnh là state `LIVE`.
- `Future · no data` trong `CandleChart.tsx` là vùng trống sau candle mới nhất để pan/draw về tương lai. Nó không có nghĩa chart mất dữ liệu, nhưng wording gây hiểu nhầm.
- Nút `Realtime` góc dưới chỉ đưa viewport về candle mới nhất; nó không bật/tắt WebSocket.
- Menu timeframe là absolute child của toolbar `overflow-x-auto`. Popup có thể bị overflow container cắt, khiến bấm thấy như không chọn được; tăng `z-index` không xử lý được clipping.
- Coinbase hỗ trợ các timeframe cấu hình của app. Forex Frankfurter là EOD reference và chỉ có `1D`; trạng thái này phải giải thích rõ.

## Required UX

1. Đổi nhãn vùng phải thành `Future` hoặc chỉ giữ separator; data status đặt ở toolbar.
2. Hiển thị text cạnh dot: `Live`, `Connecting`, `Reconnecting`, `Delayed`, `Disconnected`; có `Last update HH:mm:ss` và stale threshold theo timeframe.
3. Đổi `Realtime` thành `Go to latest` để diễn đạt đúng chức năng viewport.
4. Timeframe picker dùng anchored popover/portal hoặc overlay ngoài horizontal scroll container.
5. Chọn timeframe phải đóng menu, cập nhật active cell, hủy request/subscription cũ, tải history interval mới và subscribe interval mới.
6. Switch nhanh phải bỏ response cũ qua run key/AbortController, không lẫn candle giữa intervals.
7. Frankfurter chỉ enable `1D`, gắn nhãn `ECB EOD · snapshot`, không hiển thị green live badge.
8. Kiểm tra persistence timeframe theo từng chart cell/reload trong phạm vi Issue #39.

## Acceptance tests

- Browser BTC/USD: mở picker và chọn 1m → 5m → 1h → 1D; header và provider request nhận đúng interval.
- Popup không bị cắt ở 1440/1024/390; dùng được bằng keyboard, Escape và focus return.
- WebSocket candle mới replace/append đúng; last-update đổi; stale/disconnect/reconnect hiển thị đúng.
- Switch nhanh không lẫn interval và không leak subscription.
- `Go to latest` chỉ reset viewport; pan sang phải không tạo candle giả.
- Forex chỉ 1D và có lý do disabled.
- Giá OHLC không đổi vì UI status/timeframe fix.

## Task order

1. **C-R1:** thêm failing browser/component test tái hiện clipped timeframe menu.
2. **C-R2:** tách `TimeframePopover` dùng portal/anchored fixed positioning và outside-click/Escape.
3. **C-R3:** thêm `MarketFeedStatus` với last update/stale semantics; đổi wording Future/Go to latest.
4. **C-R4:** test cancellation, cleanup, rapid switching và provider capability states.
5. **C-R5:** real-browser QA 1440/1024/390, full frontend regression, commit/push/CI trong Issue #39.

Không thay feed, không thêm candle giả và không gọi Forex EOD là realtime.
