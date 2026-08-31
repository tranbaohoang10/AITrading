# PB-006 — Owned market datasets and CSV chart

Issue: https://github.com/tranbaohoang10/AITrading/issues/9

## Mục tiêu

PB-006: người dùng nhập bộ nến OHLCV riêng tư từ CSV, kiểm chứng chất lượng/provenance và xem chart dựa trên dữ liệu đã lưu. Chuẩn bị dataset immutable cho backtest; không giả mạo nguồn dữ liệu hoặc kết quả giao dịch.

## Phạm vi

Parser CSV có giới hạn, immutable owned dataset/candles trên PostgreSQL qua Flyway V4, API import/list/read/page/delete, canonical/raw SHA256 và metadata chất lượng, giao diện import/chọn dataset/chart OHLCV responsive. Hỗ trợ file CSV UTF-8 và paste CSV cùng contract. Sample CSV synthetic được gắn nhãn rõ, chỉ lưu khi người dùng import. Không external market feed, không broker/live order, không backtest engine, không credit/payment. Không thêm dependency nếu JDK/JDBC/React SVG hiện tại đủ.

## Use Case

UC-DATA-01 Import own OHLCV CSV; UC-DATA-02 List/select own dataset; UC-DATA-03 Inspect candles/volume/provenance and navigate date/window; UC-DATA-04 Delete own dataset with confirmation.

## Use Case Description

Actor: authenticated researcher. Precondition: session valid, dataset quota available. User supplies dataset name/symbol/timeframe/source label/kind and CSV → validation before transaction → owner/version lock and request idempotency → atomic dataset/candle persistence → list/select chart → reload/reopen preserves imported content. Alternate/error: invalid CSV or prices/time/order rejected without partial rows, missing intervals recorded explicitly and never filled, uncertain import retried with same request ID without duplicate, wrong owner/missing ID uniformly404, delete cancellation no mutation, confirmed delete only own dataset. No URL/schema/code execution from file contents.

## Acceptance Criteria

- AC-DATA-01: Strict bounded UTF-8 CSV `timestamp,open,high,low,close,volume`, optional initial BOM/CRLF and quoted individual numeric/time cells.1..5000 rows, CSV<=1MiB and import JSON<=2MiB; no multipart/archive/path fetch, no formulas/scripts. Numeric exact decimal<=8places, price>0<=1e12, volume0..1e12, low<=open/close<=high; no coercion/nonfinite/exponent ambiguity. UTC timestamps at timeframe boundaries, only closed historical candles, strict ascending/no duplicates. Reject incorrect header/columns/quotes/control characters. Record gap count; never synthesize missing candles silently.
- AC-DATA-02: Owner-only immutable datasets/candles, actual PostgreSQL/Flyway additive migration,1..50 datasets/account; metadata includes name/symbol/timeframe/UTC/source kind and label/raw file hash/canonical data hash/count/first-last timestamps/created time/gaps. User-uploaded source is unverified; synthetic is labelled. Hash/version identity preserved after reload/restart. No caller-controlled owner/role/path.
- AC-DATA-03: Import has explicit request UUID; replay identical input returns same dataset, changed input same key409. Transaction and quota atomic under concurrent requests; failure leaves no partial rows. List and immutable candle paging bounded/stable; no cross-user read/import/delete/data leak, current credential version enforced on mutations. Confirmed deletion cascades only owned candles; no external/user service data loss.
- AC-DATA-04: Authenticated chart uses real persisted OHLCV, no sample price/EMA/RSI/entry/SL overlays presented as computed. Import/file/paste/sample choice, loading/empty/error/retry states; dataset select and provenance/gap warning; real candle time/OHLC/volume inspect, pan/paging and50/100/200bar window. Keyboard and desktop/tablet/mobile usable without horizontal-page overflow. Retain standalone demo provenance/tests outside authenticated flow; changing user or async selection cannot mix datasets.
- AC-DATA-05: Session/CSRF/Origin validation, per-user rate limits and upload/body/row/time/numeric bounds, safe JSON rendering/SQL placeholders, no arbitrary filename/URL/file writes. Test IDOR/BOLA, duplicate/unknown field, injection/XSS/SSRF/traversal/formula, oversized/chunked and replay/races. No private data/credentials in errors/logs. Shared auth/DSL/chat regressions retained; modern password hashing unchanged.
- AC-DATA-06: CNPM sequence/class/ERD and separate test Markdown; parser golden positive/negative/boundary/gap/precision tests, actual two-user HTTP/DB/persistence/concurrency tests, frontend contract/state tests and real browser responsive import/select/reopen/inspect/delete/isolation checks. Lint/types/build/dependency checks PASS, exact GitHub SHA and actual CI verified before completed.

## UI Requirements

Keep professional neutral trading shell and real data at center. Native SVG candlesticks with price/time context and volume details, toolbar dataset selection/window controls, compact provenance panel/import form. Plain text rendering and accessible labels; no misleading fake indicators. No automatic remote data request. Use existing responsive shell and Modal; no new design system/chart dependency needed for bounded prototype series.

## Data / ERD Impact

V4 adds `market_dataset` owned by app_user and `market_candle` keyed dataset+ordinal/time. Dataset immutable; candles numeric exact. Owner+request UUID unique, query indexes and constraints, deletion cascade. Applied V1–V3 unchanged. Future strategy/job foreign keys must protect referenced snapshots; PB-006 does not fabricate these tables.

## Security Requirements

Synthetic authorized local tests only. Body limit2MiB only exact import route; other route limits unchanged. Validate UTF-8/text/CSV structure and resource budgets before any DB write; no archives or general spreadsheet evaluator. Filename is client display only, never storage path. Uploaded source provenance is user-declared, not market-feed authenticity. Owned reads and locked current-user writes, safe failure/retry and bounded rendering. Raw and normalized hashes identify content, not trust/authorization.

## Test Requirements

Valid simple/quoted/CRLF/BOM CSV;0/1/5000/5001rows,1MiB/2MiB boundaries; empty/null/columns/duplicates/out-of-order/gaps/future/open candle/UTC alignment/leap-day/date bounds; price/volume relationships/precision/exponent/nonfinite/formula; unknown owner/version and hostile strings. Same-key replay vs conflict, parallel quota/import/delete/read, rollback/integrity, two users and restart; chart correct candle scaling/time/window/keyboard, empty/loading/error/out-of-order response and uncertain import retry. No mocks as evidence of persisted backend or real browser layout.

## Definition of Done

AC-DATA-01–06 satisfied with implemented docs/source and actual evidence; no unresolved high/critical defect; fixed stack and old work preserved. All relevant tests/build/lint/audits pass; scoped commit with Vietnamese subject and Refs, normal push main, exact GitHub SHA and required CI success; Issue updated/closed completed. Then continue next READY backlog item without approval pause.

## Dependencies

PB-001/002/003 DONE (shell/API/auth); PB-005 DONE for shared market timeframe/precision expectations. Current next READY P0 item. PB-007 strategies, PB-010 engine and PB-011 jobs remain separate future work.
