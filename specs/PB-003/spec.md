## Mục tiêu

PB-003: tài khoản người dùng thật và ranh giới xác thực server-side cho research workspace. Đăng ký, đăng nhập/đăng xuất, xem/cập nhật tài khoản và đổi mật khẩu; không còn coi frontend ẩn nút là authorization.

## Phạm vi

Backend auth/security, migration mới cho user/session/rate limit, React authentication entrypoint và Account UI, API client/proxy local, tests/CNPM/evidence; không thực hiện chat/strategy/backtest ở Issue này. Giữ nguyên 10 test mvp-ui gốc và hai tài liệu re-review; cập nhật test shell mới khi Account hết là placeholder với lý do requirement rõ ràng. Không có admin tự cấp, email verification/reset qua dịch vụ ngoài, OAuth, payment hoặc live trading. Email là định danh đăng nhập local prototype, chưa xác minh quyền sở hữu hộp thư; nêu giới hạn rõ trên UI/docs.

## Use Case

UC-AUTH-01 Đăng ký; UC-AUTH-02 Đăng nhập/tiếp tục phiên; UC-AUTH-03 Xem và cập nhật tên hiển thị của chính mình; UC-AUTH-04 Đổi mật khẩu; UC-AUTH-05 Đăng xuất.

## Use Case Description

- Actor: khách chưa đăng nhập hoặc research user. Precondition: API/DB sẵn sàng, request cùng origin qua local proxy, CSRF token hợp lệ cho thao tác thay đổi.
- Đăng ký: email chuẩn hóa chữ thường, tên hiển thị 1–80 ký tự, mật khẩu 12–128 ký tự (không trim/truncate mật khẩu) → validate → Argon2id → insert user duy nhất. Trả cùng acknowledgement 202 cho email mới/trùng, không tự đăng nhập để giảm enumeration. Sau đó user đăng nhập.
- Đăng nhập: email/password qua POST body, CSRF + throttling → Spring Security xác minh → đổi session ID, bỏ token CSRF cũ → client lấy token mới và /me. Sai email/password cùng lỗi generic, không có tài khoản mặc định.
- Mở lại: cookie session HttpOnly → backend đọc session và user hiện hành → /me chỉ trả profile không hash. Chưa/không còn phiên → form đăng nhập; API lỗi → hiển thị lỗi/retry, không tự giả lập thành công.
- Sửa tên: user hiện hành → kiểm tra dữ liệu → cập nhật đúng user từ principal, không nhận owner/role/id từ client.
- Đổi mật khẩu: yêu cầu mật khẩu hiện tại + mật khẩu mới hợp lệ → tăng credential version trong transaction → thu hồi các phiên; yêu cầu đăng nhập lại. Phiên cũ/race đăng nhập dùng version cũ không được tiếp tục.
- Đăng xuất: POST có CSRF → invalidation server-side/cookie expiry → form đăng nhập. Postcondition: request tiếp theo dùng cookie cũ bị từ chối.
- Alternative/error: trùng email đồng thời vẫn một row; sai input 400, chưa xác thực 401, CSRF/forbidden origin 403, bị giới hạn 429, DB unavailable 503 an toàn. Không echo token/password/SQL trong response/log.

## Acceptance Criteria

- AC-AUTH-01: Đăng ký bền vững, email chuẩn hóa/unique cả concurrent case; validation null/empty/min/max/format; Argon2id với salt riêng, ít nhất 19 MiB, 2 iterations, parallelism 1; không plaintext/reversible/plain SHA.
- AC-AUTH-02: Login/logout/current user thật bằng Spring Security và session server-side PostgreSQL; HttpOnly, SameSite=Lax, cookie host-only, Secure cho HTTPS; local HTTP chỉ loopback. Session ID và CSRF đổi sau login; idle expiry 30 phút; credentials không ở URL/localStorage.
- AC-AUTH-03: /me, profile update và password change luôn lấy user từ principal; không user-list/get-by-id công khai, không role/owner mass assignment. User A không đọc/sửa User B bằng path/body/cookie giả.
- AC-AUTH-04: Đổi mật khẩu kiểm tra mật khẩu hiện tại, hash mới và tăng credential version; các phiên cũ bị thu hồi kể cả race; đăng xuất/expiry/forged cookie/token bị từ chối, không fallback vào mock.
- AC-AUTH-05: CSRF tất cả unsafe request kể cả login/register/logout; kiểm tra Origin khi có; giới hạn request body; rate limit đăng ký/login/password theo IP thật và account, atomic trên PostgreSQL để không bị bypass qua concurrency; không tin X-Forwarded-For tùy tiện. Generic auth/duplicate acknowledgement và không leak secret.
- AC-AUTH-06: React form/register/login/session restore/account/name/password/logout có loading/error/empty/retry, chống duplicate submit, keyboard/accessibility/mobile, giữ trading shell/brand; frontend lấy dữ liệu thật, không hard-code user. Account error không mất form ngoài ý muốn.
- AC-AUTH-07: Tài liệu Use Case/sequence/class/ERD/security/test MD riêng; real HTTP+PostgreSQL và browser journeys ít nhất hai user, auth/CSRF/permission/validation/concurrency/regression; dependency lock/license/advisory checks, CI và remote SHA PASS trước đóng Issue.

## UI Requirements

Trang vào tối giản, neutral trading/fintech, brand dễ thay, form có label và autocomplete phù hợp, lỗi generic dễ hiểu. Không sparkle/gradient AI/neon. Giữ workspace component độc lập để bảo toàn regression; entrypoint thực luôn đi qua auth boundary. Account trong sidebar/mobile hiển thị profile thật và các form tên/mật khẩu/đăng xuất. Không lưu credential/token vào localStorage; password fields xóa sau thành công/đăng xuất.

## Data / ERD Impact

Flyway V2 additive: trading.app_user (UUID, normalized email unique, display name, password_hash, credential_version, timestamps), Spring Session JDBC tables/indexes, rate-limit buckets. Không sửa V1. Session và user bền vững sau restart; version kiểm tra server-side để chặn phiên bị thu hồi. Tất cả tests dùng DB riêng; không thay user service/database hiện có.

## Security Requirements

Spring Security Argon2id thư viện maintained; Bouncy Castle nếu implementation yêu cầu. JDBC parameterized, allowlist DTO fields, no role escalation, CSRF và same-origin proxy; default-deny route chưa triển khai. Giới hạn body/length và hash work để hạn chế DoS; throttling cố định cửa sổ có retry-after và cleanup. HTTP loopback dùng cho dev, deployment ngoài máy bắt buộc TLS/Secure cookie. Không đọc/commit secrets. Session chỉ chứa principal đã xóa credentials và server-generated attributes; không deserialize nội dung tùy ý từ browser. Phân tích session serialization/trust boundary. Không tuyên bố email được xác minh hoặc production-ready.

## Test Requirements

JUnit HTTP+PostgreSQL: registration boundary/duplicates/concurrent uniqueness; hash salt/work factor/no disclosure; login good/bad/unknown; CSRF missing/invalid/cross-session/rotation; fixation/forged/stale/expired session; password change wrong/current/revocation/race; two-user ownership/mass assignment; origin spoofing; body oversized/malformed; throttling concurrent/expiry and DB unavailable; migration repeat/restart. Vitest và browser desktop/mobile: login/register/error/retry/account/password/logout/session restore, không lưu password. Giữ frontend/backend regressions và chạy CI/audit.

## Definition of Done

AC-AUTH-01–07 có bằng chứng thực; CNPM/test/security hoàn chỉnh; không unresolved high/critical; tests/build/lint/audit PASS; git diff/scope/secret check PASS; commit tiếng Việt + Refs, push main không force, GitHub SHA/CI xác minh; Issue đóng completed. Không gọi phần chưa chạy hoặc mock là PASS.

## Dependencies

PB-001 (#4) và PB-002 (#5) đã completed. Stack giữ nguyên; thêm Spring Session JDBC theo Boot BOM và Argon2 implementation dependency cần thiết sau kiểm tra license/version/advisory. Chưa cần email/AI/broker credential để hoàn thành feature này.

Issue: https://github.com/tranbaohoang10/AITrading/issues/6

Implementation clarification: CSRF endpoint is also limited to120 requests/IP per
15-minute window to bound anonymous session creation; register10/IP, login30/IP and
10/account, password-change10/user. ASCII email dot-atom local part up to64 and
domain labels up to63, full length254; no mailbox verification claim. JSON rejects
unknown/duplicate fields, trailing documents, scalar-to-text coercion and excessive
nesting. Counters are atomic and forwarding headers do not select the caller IP.
