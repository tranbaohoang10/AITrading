# PB-005 — Versioned neutral Strategy DSL

Issue: https://github.com/tranbaohoang10/AITrading/issues/8

## Mục tiêu

PB-005: định nghĩa và kiểm chứng Strategy DSL versioned, method-neutral làm nguồn canonical cho Python backtest, Pine Script và MQL5. Thay vì chuỗi signal tự do của demo, dùng AST dữ liệu có schema/semantic validation, fingerprint deterministic và lỗi có đường dẫn rõ ràng.

## Phạm vi

Schema JSON version1.0.0 bất biến sau phát hành, registry primitive typed, Java validator/canonical serializer/hash và API authenticated validate/schema/capabilities; fixtures hợp lệ/không hợp lệ và CNPM/tests. Không chạy strategy/backtest, không sinh Pine/MQL5, không nối AI. Persisted owned strategy/version editor là PB-007; feature này tạo validated immutable document identity để PB-007 lưu. Không thêm dependency nếu Jackson/JDK hiện có đủ.

## Use Case

UC-DSL-01 Xem schema/capabilities; UC-DSL-02 Validate strategy draft; UC-DSL-03 Nhận canonical document/hash/required warm-up và compatibility diagnostics cho phiên bản DSL.

## Use Case Description

- Actor: research user đã đăng nhập hoặc module ứng dụng gọi validator cùng implementation. Input luôn là dữ liệu không tin cậy.
- User gửi JSON DSL → kiểm tra session/CSRF/bounds → schema/types/unknown fields/registry → semantic dependencies/limits/risk/timing → canonical representation SHA256 nếu hợp lệ. Không lưu draft hoặc gọi provider/engine trong bước này.
- JSON malformed400; cấu trúc/semantics không hợp lệ422 với danh sách lỗi giới hạn, path/code/message cố định không echo payload. Hợp lệ200 với canonicalJSON/hash/schemaVersion/validatorVersion và capability status.
- Cùng DSL khác whitespace/key order/biểu diễn số tương đương có cùng canonical hash; thay đổi behavior/name/metadata phải thay hash theo contract rõ ràng. Mọi phép đo dùng các bar đã đóng, lag không âm, không future reference.
- Family label Dow/Wyckoff/trendline/price action/ICT/SMC/indicator/custom/hybrid không tự thêm hành vi hoặc đổi mặc định. Thuật ngữ chủ quan chưa lượng hóa không được coi là executable component. DSL bị reject thay vì âm thầm dịch sang strategy khác.

## Acceptance Criteria

- AC-DSL-01: Có schema version1.0.0, primitive registry và typed operand/condition/risk/execution contract; additionalProperties false và bound rõ. Mock strategy-dsl.mock.v1 không được validator chấp nhận như executable DSL.
- AC-DSL-02: Supports composable all/any/not/comparison/crossing conditions; OHLCV/constants/lag and registered indicators; confirmed-pivot and measurable structure components support neutral pattern composition. Validate units/types/ranges, unique indicator IDs/reference DAG/warm-up, depth/node/size bounds, positive prices/risk, long/short configurations and explicit exits. Unknown/future/repainting/opaque-script components fail with precise codes.
- AC-DSL-03: Market symbol/timeframe/timezone closed-bar contract; explicit signal/confirmation at bar close and next-bar execution; position size/leverage/costs/SL/TP/same-candle ambiguity/missing-candle policy defined. No default look-ahead or unlimited leverage/pyramiding. Multi-symbol/timeframe execution not implemented here; incompatible capability requests fail explicitly, not silently ignored.
- AC-DSL-04: Deterministic canonical UTF-8 JSON and SHA256, stable numeric normalization/ordering, immutable result object, schema/validator version included. Canonicalization contract is documented (do not claim RFC compliance without proof); reusable cross-language fixtures for PB-010/015/016. Published schema history preserved; persistent strategy versions follow PB-007.
- AC-DSL-05: At least fixtures spanning trend/EMA/SMA/RSI, price action, confirmed pivots/trendline structure, volume/Wyckoff-like, ICT/SMC-like measurable price rules and custom/hybrid use same neutral grammar. Label changes alone cannot inject hidden executable behavior. Unsupported named concepts return diagnostics, never canned success.
- AC-DSL-06: Authenticated API with CSRF, bounded body/tree/lists/numbers/error count and per-user rate limit; unknown fields/script/SQL/URL/polymorphic type payloads cannot execute anything, no remote schema resolution/SSRF; errors never disclose secrets/source/input. No schema-declared permission grants.
- AC-DSL-07: Separate CNPM/test MD, positive/negative/boundary/cycle/reference/resource/race/security fixtures, canonical-hash golden tests, actual HTTP auth/validation and regression/build/audit; GitHub exactSHA/CI pass before Issue completed.

## UI Requirements

No new UI in PB-005; schema/validation endpoints provide the contract for owned strategy editor PB-007. Existing mock panels retain labels and must not be reclassified as validated/executable. No business UI diagram invented for an API/schema-only feature.

## Data / ERD Impact

No migration or database schema change. Schema version and canonical hash identify immutable validated documents; owned strategy/version tables are PB-007. Existing V1/V2/V3 untouched. Validation does not write arbitrary user JSON into a session, log or executable file.

## Security Requirements

Method-neutral allowlisted typed data; no eval/reflection/codegen execution, remote URLs or external schema refs. Jackson strict parser plus explicit structural/semantic validator; cap complexity/numeric magnitudes/strings/errors. Backend authenticates and rate-limits actual principal. SQL/HTML/script-looking metadata is either bounded inert text or invalid by field contract; never execute it. Password/token/session protections from PB-003 retained. Reject unknown schema versions and unsupported execution targets honestly.

## Test Requirements

Golden valid DSL fixtures with deterministic canonical hashes and equivalent key order/number forms. Reject null/empty/malformed/duplicate fields/unknown versions/type coercion/nonfinite or extreme numbers/deep or wide trees/reference cycles/missing refs/invalid risk/lag/future bars/unsupported capabilities/SSRF refs/injection. Test required warm-up, confirmed pivot right-bar delay, no label-based special case, immutable outputs and parallel validation consistency. Actual API401/403/422/413/429/safe errors and current regressions. Generators/runtime trading correctness belong to later features, not fake PASS here.

## Definition of Done

AC-DSL-01–07 met with schema/design/test fixtures/evidence; no unverified executable capability claim, no high/critical unresolved issue; build/tests/lint/audit pass; scoped diff/secrets/history checks; Vietnamese commit + Refs and fast-forward push main, exact GitHub SHA/CI verified; Issue closed completed; continue next READY backlog item.

## Dependencies

PB-002 foundation DONE; PB-003 auth DONE. Highest-priority next item after PB-004 delivery. Reuse existing stack and DSL neutrality constraints; no external credential required for validator.
