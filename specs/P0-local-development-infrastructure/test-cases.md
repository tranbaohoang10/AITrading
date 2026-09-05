# Test cases — P0 local lifecycle

Issue: #41
Synthetic data only. Actual evidence is appended after execution.

| ID | AC | Loại | Kịch bản / expected | Actual |
| --- | --- | --- | --- | --- |
| T01 | AC-01 | Regression | Tái hiện Vite cũ: cổng bận làm Vite fallback. Sau sửa, config có strictPort và launcher chỉ dùng 5173. | PASS — trước sửa Vite báo 5173/5174 bận rồi chọn 5175; sau sửa launcher chỉ báo 5173/PID. |
| T02 | AC-02 | Integration | Chạy npm run dev hai lần; lần hai báo PID canonical, không listener 5174. | PASS — instance thứ hai báo PID 29276 và URL 5173, không khởi tạo Vite khác. |
| T03 | AC-03 | Security | State/PID lạ không bị dev:stop terminate; status báo ownership. | PASS — dev:stop dừng đúng Vite ownership xác minh; fixture Python lạ PID 25244 chỉ bị báo, không bị dừng. |
| T04 | AC-04 | Integration | Chạy --serve hai lần; lần hai reuse/report, không tạo DB/API thứ hai; READY sau health. | PASS — API PID 10612 chỉ báo READY sau health; lần hai reuse/report, không tạo cluster mới. |
| T05 | AC-05 | Lifecycle | Ctrl+C một lần dừng child Java/PG, 8080 rảnh, state/credential bị xóa, không traceback. | PASS — Ctrl+C in Stopping API, Stopping owned PostgreSQL, Cleanup complete; status STOPPED và backend.json absent. |
| T06 | AC-06 | Security | POST Origin 5174 trả 403 ORIGIN_FORBIDDEN; canonical 5173 register/login thành công. | PASS — curl synthetic nhận 403 ORIGIN_FORBIDDEN; browser đăng ký/đăng nhập trên 5173 thành công. |
| T07 | AC-07 | Browser | Giữ SESSION từ serve A, restart serve B, reload 5173 rồi đăng ký/đăng nhập không xóa cookie. | PASS — SESSION A dẫn tới Sign in an toàn ở B, rồi tạo và đăng nhập account synthetic mới không xóa cookie. |
| T08 | AC-08 | Browser regression | Chart tải nến và symbol/market proxy qua /api ở canonical URL. | PASS — chart workspace hiện sau login/reload và không có console error; vẫn hoạt động sau dev:restart 5173. |
| T09 | AC-01..08 | Automated | npm test, npm run lint, npm run build; targeted Gradle authentication test. | PARTIAL — lint/build và AuthenticationTests/AiTradingApplicationTests PASS. Full frontend has pre-existing market test flake; full backend has 74 pre-existing AI fixture failures. |
