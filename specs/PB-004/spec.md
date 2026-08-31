# PB-004 — Persistent conversations

Issue: https://github.com/tranbaohoang10/AITrading/issues/7

## Mục tiêu

PB-004: thay chat mẫu trong phiên đăng nhập thật bằng danh sách hội thoại và tin nhắn bền vững, riêng tư. Mở lại đúng hội thoại, không trộn context/user. Đây là nền tảng cho provider PB-008; chưa tạo câu trả lời AI hoặc Strategy DSL giả.

## Phạm vi

Flyway V3 additive, API conversation/message, React chat/list và state chia sẻ giữa desktop/tablet/mobile, CNPM/test/evidence. Dùng Spring/JDBC/React hiện có, không dependency mới. Không sửa V1/V2, không chạm hai re-review mvp-ui; shell/demo strategy/backtest còn lại giữ nhãn demo. Không AI provider, upload, search, sharing, payment hoặc broker trong feature này.

## Use Case

UC-CHAT-01 Tạo hội thoại; UC-CHAT-02 Liệt kê/mở lại lịch sử; UC-CHAT-03 Lưu tin nhắn và tiếp tục đúng context; UC-CHAT-04 Đổi tên; UC-CHAT-05 Xóa hội thoại có xác nhận UI.

## Use Case Description

- Actor: research user đã đăng nhập. Precondition: phiên/CSRF hợp lệ, API/DB sẵn sàng. Owner luôn lấy từ server principal.
- New Chat: client tạo UUID requestId ổn định cho retry → backend kiểm tra quota/ownership → tạo title mặc định New conversation, timestamps UTC; trùng requestId trả lại resource đã có, không thêm row.
- List/open: list của chính user, newest-created trước với cursor keyset (createdAt,id), 20 mặc định/50 tối đa; title, created/updated timestamps và lastMessage preview. Mở một item lấy metadata và trang 50 tin mới nhất, hiển thị thứ tự sequence tăng; Load earlier truy xuất trang trước. Không ghép trang từ conversation khác.
- Send: input text 1–4000 ký tự sau trim, giữ newline/tab, cấm NUL/control khác. UUID requestId do client giữ khi lỗi mạng → transaction kiểm tra owner và phiên hiện hành, khóa hội thoại → append sequence, role=user do server quyết định → update preview/version/timestamp. Retry cùng key/content trả cùng message; cùng key khác content trả409. Không tạo assistant response giả. UI phân biệt saved/pending/error/uncertain và không tự replay thao tác unsafe.
- Rename: title 1–120 ký tự sau trim, không control; gửi expectedVersion. Stale version trả409; không ghi đè âm thầm. Rename giữ vị trí phân trang theo createdAt.
- Delete: UI xác nhận tên hội thoại, gửi expectedVersion; server kiểm tra owner/version rồi cascade messages trong transaction. Retry resource đã không còn →404. Không xóa dữ liệu khác hoặc Git history.
- Alternative/error: malformed/null/unknown fields400; anonymous/stale session401; CSRF403; absent/wrong owner404 giống nhau; conflict/quota409; body quá lớn413; throttle429; DB503 an toàn. UI giữ draft/context khi lỗi, response cũ đến muộn không ghi vào hội thoại đang mở khác. Logout/user switch xóa state private trong bộ nhớ.

## Acceptance Criteria

- AC-CHAT-01: Tạo/list/get/rename/delete bền vững bằng PostgreSQL; title/timestamps/preview/version thật; session/API restart và reload giữ dữ liệu. Không hard-code hội thoại thật từ mock.
- AC-CHAT-02: Owner predicate cho mọi list/get/write/delete/messages, 404 uniform cho resource thiếu/khác owner; user A không đọc/sửa/xóa B qua ID/body. Unknown owner/user/role fields bị từ chối, backend không tin client role.
- AC-CHAT-03: Tin nhắn lưu với sequence xác định và unique requestId mỗi conversation; retry đúng content không trùng, conflict content409; concurrent writes không mất hoặc trộn message/context. Client chỉ tạo role user; provider PB-008 sau này chịu trách nhiệm assistant.
- AC-CHAT-04: Cursor pagination có bounds và validation; list ổn định dưới rename/send; message page không lặp/mất khi append, response theo thứ tự sequence. 100 hội thoại/user và 2000 message/conversation là quota prototype công bố; concurrency không vượt quota. Mutation throttle120/user/15 phút, no bypass X-Forwarded-For.
- AC-CHAT-05: Chat UI có New Chat/list/open/title/preview/timestamps/rename/delete/load-more/load-earlier, text composer; loading/empty/error/retry và delete confirmation. Desktop/tablet/mobile giữ đúng selection; không hiện dữ liệu conversation cũ trong lúc tải cái mới; không mất draft do request lỗi. Không gọi saved text là AI response.
- AC-CHAT-06: CSRF/session, strict bounded JSON, parameterized SQL, XSS rendering-as-text, requestId content-conflict, version conflict và DB outage đều được test. Không log prompt hoặc secret; no HTML/eval/URL fetch; không dependency mới.
- AC-CHAT-07: CNPM/test Markdown riêng, real HTTP/PostgreSQL + frontend contract + browser two-user/restart/responsive, regression/audit/build/lint, exact SHA và CI verified trước đóng Issue.

## UI Requirements

Tái sử dụng chat column/drawer hiện có. Header Quant / Research conversations, New Chat; danh sách gọn và scroll được, selected state rõ, preview text escaped. Timeline message có timestamp, Save message (không Generate Strategy), thông báo AI replies sẽ được nối ở feature provider. Rename dùng form, Delete dùng Modal sẵn có với focus/keyboard. Palette neutral; tránh AI gradients/neon/sparkles. Loading không hiển thị context cũ. State private không ở localStorage, Auth root unmount/reset theo user.

## Data / ERD Impact

V3 mới: trading.conversation (id UUID, owner_id FK app_user, request_id, title, version, created_at, updated_at, last_sequence); trading.conversation_message (conversation_id FK cascade, sequence, request_id, role check, content, created_at). Unique(owner_id,request_id) cho create; primary(conversation_id,sequence) và unique(conversation_id,request_id) cho append. Index(owner_id,created_at,id). Retain V1/V2 checksums. Không chạy migration vào DB/service người dùng hiện có.

## Security Requirements

Authenticated backend routing, CSRF cho mọi mutation. Validate ID/cursor/title/content/version/requestId; no ownership from body. User row + conversation lock trong transaction cho quota/version/session consistency; read owner predicates. Default deny routes khác giữ nguyên. Không trả owner email/hash/secret, không dùng private content trong exception. Đánh giá BOLA/mass assignment/SQLi/XSS/CSRF/replay/session/races/DoS; SSRF/uploads/LLM execution N/A vì không có surface trong feature này. Keyset cursor là navigation data không phải permission token; luôn enforce owner ở query.

## Test Requirements

JUnit real API/DB: CRUD/timestamps/restart, hai user cho tất cả endpoint, null/min/max/control/malformed UUID/cursor/unknown fields, page boundaries and concurrency, idempotent create/send and changed-content replay, stale rename/delete, quotas/throttle under race, forged/stale session/CSRF, injection rendering/data intact, database outage/recovery. Vitest: empty/loading/error, list/context race, mutations/uncertain retry, logout state, paging/confirmation/escaping. Browser: A creates two conversations/messages/reopens/renames/deletes, B sees none, API restart and responsive context preserved. Full existing regression/audit/CI.

## Definition of Done

AC-CHAT-01–07 verified with actual evidence, documented limits, no high/critical unresolved defect; CNPM/test MD complete; build/tests/lint/audit PASS; scoped diff and no secret; Vietnamese commit + Refs; normal push main and exact GitHub SHA/CI success; explicit completed Issue. No mock/provider claim substituted for persistence.

## Dependencies

PB-003 / Issue #6 CLOSED/completed, main099d6a5, CI33349231331 success. Tái sử dụng PB-001 shell và PB-002 foundation. Thiết kế nháp được chuẩn bị trong lúc chờ CI; chưa viết code PB-004 trước khi tạo Issue này.
