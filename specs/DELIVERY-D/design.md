# Thiết kế Market Intelligence

Provider adapter sẽ được thêm sau khi Product Owner cấp key và retention policy. Hiện tại service là một boundary typed: status không có secret, feed endpoint fail closed, UI chỉ render payload đã validate.

Security: owner/session binding qua `AuthGuardFilter`, GET rate limit theo account, whitelist date/query/timezone, CSP và text rendering. Không có endpoint proxy tự do nhận URL từ người dùng.
