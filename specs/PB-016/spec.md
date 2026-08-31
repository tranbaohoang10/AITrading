# PB-016 — MQL5 research export

Issue: [#18](https://github.com/tranbaohoang10/AITrading/issues/18). Created31/08/2026 before code.

## Mục tiêu
PB-016: xuất MQL5 nghiên cứu từ Strategy DSL VALIDATED đã lưu, cùng ngữ nghĩa tham chiếu Python. PB-007/PB-010 đã DONE. PB-015 đã publish checkpoint nhưng còn BLOCKED ở TradingView; PB-016 độc lập.

## Phạm vi
Generator có version, artifact riêng tư bất biến, API và tab MQL5 thật. Xuất script nghiên cứu chạy một lần trên CSV OHLCV trong file sandbox MetaTrader, không EA đặt lệnh, không broker integration. CSV thay vì feed broker giúp giữ chính xác timestamp/data dùng cho so sánh; không tự suy đoán múi giờ hoặc tick-volume thành volume thật. Custom simulator giữ chính sách DSL; không gọi OrderSend/CTrade, DLL, WebRequest hay lệnh hệ thống. Compiler MetaEditor chính thức có sẵn tại local. Kiểm thử target thực tế phải được ghi đúng mức bằng chứng.

## Use Case
UC-PB016: owner xuất revision đã lưu, tải mã MQL5, compile và chạy nghiên cứu trên dữ liệu test/CSV được chọn rõ ràng.

## Use Case Description
Đăng nhập, chọn revision VALIDATED, mở MQL5, generate/reload artifact, xem provenance/limits, copy/download. Server xác thực expected account/CSRF/owner, revalidate canonical DSL và target limits; retry trả cùng artifact. Mã không chứa label không tin cậy dưới dạng syntax. Người dùng đặt CSV đúng format trong sandbox và chạy script, nhận trace/accounting hoặc lỗi rõ; không gửi order. Draft chưa lưu được giữ nguyên và không âm thầm xuất.

## Acceptance Criteria
- AC-01: API GET/POST owner/session/expected-account; CSRF cho POST; foreign/missing404; stale/revoked401; bounded input/rate/quota, error không echo dữ liệu riêng tư.
- AC-02: saved VALIDATED canonical DSL được revalidate; immutable artifact strategy/revision/schema/validator/generator/source SHA256/code SHA256; replay/concurrency không duplicate, cascade khi xóa strategy.
- AC-03: MQL5 generator method-neutral, trusted template, target bounds và unsupported rejection; không executable user strings, network/DLL/shell/order calls. Không native broker fill equivalence claim.
- AC-04: causal indicators/rules, nullable/warm-up/pivot confirmation, next-open sizing/fees/exits, stop-first/gap/target-cap, long/short, end-window semantics giữ công thức Python. CSV UTC/contiguous/finite/OHLC/row/resource validation; binary-double limitations explicit.
- AC-05: tab desktop/mobile thật với source/provenance/warning/loading/empty/error/retry/copy/download; account/revision switches không lộ stale artifact; draft không bị sửa.
- AC-06: official MetaEditor compile trên generated synthetic fixtures; actual MQL runtime event/accounting comparison khi local runtime vận hành được. Không dùng source snapshots hoặc C++ substitute để tuyên bố MQL runtime PASS. Mọi target gap phải BLOCKED/unverified, không đóng Issue nếu DoD thiếu.
- AC-07: CNPM/test Markdown, meaningful local/API/DB/browser/restart/security/regression tests; diff review, Vietnamese Refs commit/push main, exact GitHub SHA/CI verified.

## UI Requirements
Giữ layout hiện có, accessible responsive controls, selected saved revision/hash rõ. Research CSV script không phải live EA/native Strategy Tester. Code inert text, ASCII download filename, explicit precision/runtime constraints.

## Data / ERD Impact
Migration mới cho artifact MQL5 FK revision, owner qua strategy. Không sửa migration cũ hay Pine artifact. Immutable current-generator artifact, storage quota owner, exact provenance/hash. Không lưu broker/account secrets.

## Security Requirements
BOLA/IDOR, session/CSRF/account binding, injection/XSS, limits/rate/concurrency/rollback, safe file-sandbox CSV parsing/path rejection, no overwrite arbitrary files, no third-party attacks. Synthetic target data only. Không chạm profile/tài khoản MetaTrader của owner; dùng workspace portable instance riêng nếu cần. Không bật trading, không login broker, không thay machine protections.

## Test Requirements
Generated source/metadata/limits/malicious labels; shared synthetic hand-calculated and Python event fixtures; official compiler diagnostics and target traces; bad CSV/time/format/limits; API owner/retry/quota/race/failure; UI stale response/clipboard/download; actual browser/restart; full regression/lint/build/dependency audit. Record failure→fix→rerun honestly.

## Definition of Done
All AC proven, no unresolved high/critical issue, target compilation and execution evidence sufficient for supported scope, docs/test MD current, normal push and exact GitHub SHA/CI verified, then explicit completed closure. If target runtime has a genuine external blocker, publish safe experimental checkpoint, keep Issue OPEN/BLOCKED and continue independent READY backlog work.

## Dependencies
PB-005 DSL, PB-007 saved revisions, PB-010 Python semantics, PB-027 account binding. No AI key or Pine runtime prerequisite; PB-017 owns later integrated three-target consistency.
