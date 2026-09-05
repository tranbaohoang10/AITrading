# Thiết kế P0 local lifecycle

Issue: #41

Developer -> frontend launcher: npm run dev

frontend launcher -> frontend launcher: kiểm tra state, PID và listener 5173

Nếu AITrading Vite đã chạy, launcher trả URL canonical và PID, không tạo process mới. Nếu cổng tự do, launcher spawn Vite strict port 5173. Nếu tiến trình lạ chiếm cổng, launcher báo PID/command và không dừng nó.

Developer -> browser-test API 8080: scripts/test_backend.py --serve

API script -> API script: kiểm tra 8080/state, tạo PostgreSQL disposable

API script -> API script: start Java child và poll /api/health

API script -> Developer: READY chỉ sau health 2xx

## Ownership boundary

frontend/scripts/dev-server.mjs ghi tmp/dev/frontend.json. scripts/test_backend.py ghi tmp/dev/backend.json. Cả hai xác minh PID sống và command line chứa root repository cùng executable mong đợi trước khi dừng. State stale không được dùng để dừng một PID tái sử dụng.

## Error contract

AuthInputFilter trả ORIGIN_FORBIDDEN trước CSRF khi Origin không nằm trong allowlist. Spring Security trả CSRF_INVALID cho missing/invalid token; các denial khác giữ FORBIDDEN. Frontend đọc code public đã allowlist; mutation chỉ lấy CSRF mới và retry đúng một lần khi server xác nhận request đầu đã bị chặn ở CSRF boundary.

## Data/ERD impact

N/A. Không có migration hay schema thay đổi; mỗi browser-test serve tiếp tục dùng PostgreSQL disposable.
