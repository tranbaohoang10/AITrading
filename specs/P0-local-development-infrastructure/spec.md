# P0 — Ổn định môi trường local và cổng canonical

Issue: #41
Ngày: 05/09/2026

## Use case

Developer chạy API disposable trong một terminal và frontend Vite trong terminal còn lại, sau đó dùng workspace tại http://127.0.0.1:5173.

## Acceptance criteria

| ID | Yêu cầu |
| --- | --- |
| AC-01 | Vite dùng 127.0.0.1:5173, strictPort: true; không tự chọn 5174 trở lên. |
| AC-02 | Launcher nhận biết frontend AITrading đang chạy và không tạo Vite thứ hai; tiến trình lạ chỉ được báo PID/command. |
| AC-03 | Lệnh stop/restart/status chỉ có thể dừng frontend có ownership đã xác minh. |
| AC-04 | test_backend.py --serve chỉ tạo một API browser-test trên 8080, báo READY sau /api/health, và không đụng service lạ. |
| AC-05 | Ctrl+C dừng Java và PostgreSQL disposable, xóa state/credential, không traceback thông thường. |
| AC-06 | Origin chỉ cho phép 127.0.0.1:5173 và localhost:5173; 5174 vẫn bị từ chối với ORIGIN_FORBIDDEN. |
| AC-07 | SESSION cũ sau database disposable mới trở về trạng thái anonymous an toàn; token CSRF mới có thể phục hồi một lần trước mutation. |
| AC-08 | Proxy /api, dữ liệu market và chart vẫn hoạt động ở origin canonical. |

## Không thuộc phạm vi

Không thay CORS sang wildcard, không dùng Docker/production PostgreSQL, không thay đổi giao thức market hoặc mở browser tự động.

## Security và dữ liệu

State dưới tmp/dev chỉ gồm PID, port, repo root, thời điểm và đường dẫn cluster. Không ghi password/token. Process chỉ bị terminate sau khi PID còn sống và command xác nhận thuộc repository. Database vẫn là cluster riêng trong tmp.

## Definition of done

Các AC trên có evidence trong test-cases.md; frontend build/lint/test, backend targeted test và browser QA PASS; tài liệu local khớp commands; commit/push main và Issue được cập nhật.
