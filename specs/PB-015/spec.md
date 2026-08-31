# PB-015 — Pine research export

Issue: [#17](https://github.com/tranbaohoang10/AITrading/issues/17). Created 31/08/2026 before code.

## Mục tiêu
PB-015: xuất Pine Script v6 từ revision Strategy DSL VALIDATED riêng tư đã lưu, có provenance và giới hạn thực thi rõ ràng. Dependencies PB-007/PB-010 đã DONE; tiếp tục sau PB-027/#16.

## Phạm vi
Generator có version cố định, artifact bất biến lưu PostgreSQL, API owner-scoped và tab Pine thật trong workspace. Bản prototype xuất **research indicator với closed-bar simulator riêng**, không phải native Strategy Tester, broker order hoặc alert. Lý do: native emulator không bảo đảm stop-first khi SL/TP cùng chạm, sizing next-open và chi phí phần trăm của DSL. Không âm thầm thay đổi DSL để vừa runtime.
Hỗ trợ các toán tử DSL trong giới hạn được công bố; từ chối revision DRAFT, metadata hỏng và thành phần vượt khả năng. Không AI provider, MQL5, payment hay live-money.

## Use Case
UC-PB015: người dùng xuất và sao chép Pine từ một revision VALIDATED thuộc tài khoản mình.

## Use Case Description
Precondition: đăng nhập và chọn revision đã lưu. Người dùng mở Pine, xem revision/hash và giới hạn, tạo artifact, xem/copy/download mã. Server kiểm tra tài khoản, ownership, revision và canonical DSL, tạo một artifact cho revision/generator; retry trả cùng artifact. Unsaved draft không được xuất như thể đã lưu. DRAFT/unsupported/rate/network/session errors hiện rõ, không dùng mã demo làm fallback.

## Acceptance Criteria
- AC-01: chỉ owner với expected-account header và CSRF hợp lệ tạo được export; GET cũng owner-bound; foreign/missing cùng 404; revoked/stale session không lộ mã.
- AC-02: input duy nhất là saved validated canonical DSL; generator kiểm tra schema/hash/semantics. Immutable artifact gồm strategy/revision, DSL hash, schema/validator/generator version, code SHA256 và code; retry/concurrency không duplicate. Giới hạn storage/output rõ.
- AC-03: code Pine v6 từ template tin cậy, identifier nội bộ; labels/name không trở thành executable source. Không eval, script input, arbitrary URL, broker/order/alert hay request.security.
- AC-04: closed-bar research simulator giữ causal warm-up, nullable rules, next-open entries/rule exits, stop-first SL/TP, gap rules, long/short, fees/spread/slippage/sizing và end-of-window policy. Chart phải standard/symbol mapping/timeframe/UTC window/contiguous bars phù hợp; vượt giới hạn hoặc dữ liệu thiếu bị từ chối. Numeric float limitations được ghi rõ, không tuyên bố Decimal/target parity chưa kiểm chứng.
- AC-05: authenticated desktop/mobile Pine tab hiển thị artifact thật, provenance, loading/empty/error/retry; copy/download inert text; changing account/revision không hiển thị stale code; unsaved edits không bị mất.
- AC-06: deterministic fixtures/golden output và event-level expectations đối chiếu Python, boundary/security/ownership/race/regression tests PASS; official Pine compiler/runtime validation được ghi riêng và không giả lập là PASS.
- AC-07: normal commit/push main, exact GitHub SHA và CI verified; chỉ đóng completed khi toàn bộ DoD, kể cả target validation, đạt.

## UI Requirements
Giữ layout fintech hiện có. Source revision/hash rõ; phân biệt research simulator với Strategy Tester/live execution; unsupported/dirty states cụ thể; accessible controls, keyboard, responsive; không placeholder masquerading as real output.

## Data / ERD Impact
Migration mới cho immutable export artifact FK đến strategy revision; owner thông qua strategy. Không thay migration đã áp dụng. Xóa strategy xóa export liên quan; artifact không giữ secrets/account credentials. Code/schema/generator/source hash được lưu để reproducibility.

## Security Requirements
Assess BOLA/IDOR, CSRF/session/revocation, injection/XSS, resource limits, concurrency and sensitive-data/log exposure. Không submit private strategy tới TradingView; target tests chỉ synthetic fixture. Không bypass TradingView login hoặc dùng credentials Codex.

## Test Requirements
CNPM + separate detailed test Markdown; generator semantics/negative fixtures; real HTTP/PostgreSQL ownership/CSRF/immutability/concurrency/quota; frontend/error/late responses; actual browser; full applicable regression/build/lint/audits; official target evidence. Current observed external dependency: anonymous Pine Editor Add to chart opens Sign in; no compiler/runtime result yet.

## Definition of Done
All AC pass with explicit evidence and no unresolved high/critical finding; docs/test MD current; exact scope reviewed; normal main push/exact SHA/CI verified. If official target access stays unavailable, publish safe local work/checkpoint if justified but keep Issue OPEN/BLOCKED, do not certify Pine runtime or stop other independent backlog items.

## Dependencies
PB-005 canonical DSL; PB-007 saved revisions; PB-010 reference execution semantics; PB-027 private workspace binding. No AI credential dependency.
