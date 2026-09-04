# PB-038 — Revision history

Append-only, Asia/Ho_Chi_Minh.

| Date | Revision | Author | Facts/change | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| 04/09/2026 | 1 | Codex | Created Issue #39 and CNPM/test contract for Chart Workspace/provider phase; preserved existing untracked files and PB-034/PB-035/PB-037 history. | Repository/origin inspection; official provider/UX research recorded for implementation audit. | IN_PROGRESS |
| 04/09/2026 | 2 | Codex | Implemented neutral market-data contracts, Coinbase-preserving Chart Workspace updates, guarded Alpaca server adapter, provider audit, Symbol Search, indicators, layouts, settings, dynamic precision, future viewport and drawing history. Added bounded cache/dedupe and mapper/security tests. | Frontend 34 files/247 tests PASS; Vite build PASS with bundle warning; Alpaca mapper test PASS; Chrome desktop flow PASS. Full backend harness, real Alpaca credentials/request, and tablet/mobile CUA viewport remain BLOCKED/partial; Issue #39 stays open. | PARTIAL |
| 05/09/2026 | 3 | Codex | Tiếp tục xác minh sau phiên bị ngắt; ẩn category Symbol Search không có instrument/provider được cấu hình và giữ nguyên các file untracked ngoài phạm vi. | Targeted frontend flow 2 files/18 tests PASS; build cuối đang chạy sau revision này. | IN_PROGRESS |
| 05/09/2026 | 4 | Codex | Hoàn tất build và staged-scope review cho PB-038. | `npm run build` exit 0; `git diff --cached --check` exit 0; chỉ 25 file thuộc feature được stage, file untracked ngoài phạm vi vẫn giữ nguyên. | PARTIAL |
| 05/09/2026 | 5 | Codex | Chẩn đoán CI sau push: loại bỏ import TypeScript không dùng trong provider composite; xác nhận backend CI fail ở readiness ledger V1–V18 đã tồn tại trước PB-038 và không thay đổi migration/test để che lỗi. | `npm run lint` exit 0 sau sửa; workflow 33927865370 ghi nhận lỗi frontend trước sửa và backend baseline failure riêng. | IN_PROGRESS |
| 05/09/2026 | 6 | Codex | Cập nhật bằng chứng sau hotfix lint và workflow mới. | Workflow `33928030727`: frontend PASS; backend fail cùng `migration ledger must bind V1–V18` với baseline `33883471637`; commit `c8ba5d1` đã push trên main. | PARTIAL |
