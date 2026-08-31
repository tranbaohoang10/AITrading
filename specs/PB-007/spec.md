# PB-007 — Issue #10 — 31/08/2026

## Mục tiêu

PB-007: người dùng quản lý strategy riêng tư trong My Script/Strategy DSL workspace, sửa bản nháp, kiểm chứng DSL và lưu các revision bất biến. Không gọi AI, không chạy backtest hoặc giả mạo code export.

## Phạm vi

Owned strategy collection và immutable revisions qua Flyway V5. Create/list/read/edit/save draft/save validated revision/version history/delete có xác nhận và optimistic concurrency. React editor JSON, diagnostics, revision history và chart dataset bên cạnh/khi chuyển panel. Reuse PB-005 validator và PB-006 chart, không thêm dependency. Bản DRAFT có thể lưu JSON chưa hoàn chỉnh; chỉ VALIDATED revision mới chứa canonical DSL/hash/schema/validator/minimumBars. Validated không có nghĩa runtime đã triển khai hay strategy có lợi nhuận.

## Use Case

UC-STR-01 Tạo/chọn strategy riêng; UC-STR-02 Sửa/lưu draft; UC-STR-03 Validate và lưu validated revision; UC-STR-04 Xem revision cũ và copy vào editor thành revision mới; UC-STR-05 Xem chart cùng strategy; UC-STR-06 Xóa strategy của mình có xác nhận.

## Use Case Description

Actor: authenticated researcher. Tạo strategy có title → draft rỗng revision1 → nhập JSON → validate không mutation → lưu draft hoặc yêu cầu lưu validated revision → backend kiểm lại current user/expected revision và DSL → transaction tạo immutable revision tiếp theo → reopen/reload giữ đúng text/status/hash. Revision cũ không bị sửa. Invalid DSL vẫn có thể lưu DRAFT nhưng không được đánh dấu VALIDATED; stale revision409 không overwrite. Retry uncertain save giữ nguyên requestId/payload; other-user/missing uniformly404. Chart dữ liệu do user chọn, hiển thị symbol/timeframe và cảnh báo nếu không khớp validated strategy; không suy ra association hay chạy backtest. Delete chỉ own strategy/revisions, không xóa dataset/conversation.

## Acceptance Criteria

- AC-STR-01: Actual owned persistence, max100 strategies/account và100 revisions/strategy, bounded title1..120 và raw UTF-8 draft<=64KiB; allow empty/incomplete draft, reject invalid Unicode/NUL/control except tab/CR/LF. V5 additive, V1–V4 unchanged. List20/default50max stable created/id keyset; revision metadata paging20/default50max descending with before cursor; exact immutable revision read.
- AC-STR-02: Create requestUUID idempotent per owner and same title; every append has requestUUID, expected current revision, title/rawText/mode. Atomic user→strategy lock, same-key same-intent replay returns same immutable revision even after later revisions; conflicting key or stale expected revision409. Quota concurrency cannot exceed bounds. Delete expectedRevision and confirmation; other owned resources unaffected.
- AC-STR-03: Validate using existing PB-005 trusted strict DSL validator; saving VALIDATED revalidates exact draft server-side and stores canonicalJson/hash/schemaVersion/validatorVersion/minimumBars plus symbol/timeframe derived from canonical data. Invalid/malformed DSL422 with bounded fixed diagnostics, no version insert; DRAFT has no executable metadata. No client-controlled owner/hash/status bypass. No execution/code generation in this feature.
- AC-STR-04: Authenticated Strategy DSL/My Code/Strategies open own editor. Create/select/title/text editor, dirty vs saved status, explicit Save draft/Validate/Save validated revision, diagnostics/history/reload. Unsaved edits retained across tab/responsive navigation; deliberate replace/select/reload asks discard locally, no silent overwrite. Late validation/save/selection cannot mix text/users or mark changed text validated. Uncertain save prevents edits until explicit same-key retry resolves;409 preserves draft and offers explicit reload. Historical revisions read-only until copied into current editor to save a new revision. No secrets/localStorage or eval.
- AC-STR-05: Chart available alongside strategy on wide workspace and explicit toggle on narrow screens; real PB-006 data and provenance remain visible. Validated symbol/timeframe mismatch is explicit; no implied dataset binding or backtest result. Native accessible controls, JSON text wrapping/scrolling, desktop/tablet/mobile no horizontal page overflow; loading/empty/error/session-expired states.
- AC-STR-06: Auth/CSRF/Origin, bounded exact-route body limits512KiB for strategy create/version POST only (raw draft still64KiB), per-user read300/write60 per15min, owner checks on all history/current/delete requests, strict unknown/duplicate/type fields; injection/XSS/traversal/SSRF/code stays inert. Actual two-user HTTP/PG/idempotency/quota/stale/race/rollback tests, frontend async tests, actual browser save/reopen/restart/invalid/conflict/history/isolation/responsive evidence; all relevant regression/build/lint/audits and exact GitHub SHA/CI PASS before completed.

## UI Requirements

Neutral My Script editor in existing shell, explicit DRAFT versus VALIDATED revision badges and current unsaved edits. Toolbar selects strategy/new/delete/refresh, title/text, diagnostics and saved revision history; no code editor dependency needed for bounded JSON. Chart toggle/side pane retains real dataset controls. Clearly label sample DSL as synthetic educational fixture; choosing it only populates editor after discard confirmation, never auto-saves/runs. Copy only text, never execute it. Existing standalone shell mocks/tests preserved outside authenticated provider.

## Data / ERD Impact

V5: strategy owned by app_user with create request/hash/current revision and created/updated timestamps; strategy_revision with (strategy_id,revision) PK, request UUID unique per strategy, payload fingerprint, title/raw draft/status and nullable validated canonical/hash/schema/validator/minimumBars/symbol/timeframe metadata. All revisions immutable; only strategy pointer changes under lock. Owner and strategy delete cascades versions. No dataset FK or mutation; future jobs reference exact validated revision with delete protection in their own migration.

## Security Requirements

Owned backend reads and locked credential-version checked mutations, uniform404, no untrusted execution/remote schema fetch. Raw draft may be malformed but remains bounded inert text. Validation never trusts browser flags or supplied canonical hashes. Permission/schema recheck when future jobs use a revision. Synthetic local tests only; no production data/secret use. Password implementation unchanged.

## Test Requirements

Create/edit/save/reopen/history/delete;0/64KiB/+1 draft bytes/multibyte, Unicode/control/title bounds, malformed/schema/typed-DAG-invalid and valid neutral fixtures; canonical exact hash metadata; same-key replay after later revision, conflicting key, parallel stale writers,100 strategy/revision quotas, concurrent delete/read/save, rollback. UserB allApaths blocked, unknown owner/status/hash fields, CSRF/Origin/throttle/body bounds. Frontend dirty/discard/cancel, delayed responses, edit-after-validation, uncertain retry/duplicate prevention, historical restore, reload conflict, JSONXSS, responsive chart match/mismatch, real browser and API restart persistence.

## Definition of Done

AC-STR-01–06 evidenced, CNPM sequence/class/ERD and separate test Markdown, no unresolved high/critical defect; exact scoped commit Vietnamese+Refs, normal main push, GitHub SHA and actual CI verified; Issue updated/completed. Then next READY backlog feature automatically. No mock/provider/runtime claims substituted for required behavior.

## Dependencies

PB-001/003/005 DONE; PB-006 supplies the chart surface and is finishing publication before PB-007 code. PB-008/009/010/011 and export features remain separate.
