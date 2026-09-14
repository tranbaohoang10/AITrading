# Issue #49 update — 13/09/2026

GitHub comment submission was attempted but rejected with API 403
(Resource not accessible by integration). This file is the sanitized comment
body for manual posting; no credential value is included.

## Cập nhật xác minh PB-049

- Routing hiện tại giữ nguyên: STOCK/ETF → Alpaca; CRYPTO → Binance; FOREX → cTrader primary khi account catalog hỗ trợ, sau đó Capital rồi Dukascopy; COMMODITY/METAL → Capital primary, cTrader chỉ fallback khi catalog thật hỗ trợ.
- cTrader TCP/TLS tới demo.ctraderapi.com:5035 PASS.
- Production protobuf client nhận được ProtoOAErrorRes hợp lệ, nhưng application auth FAIL với CH_CLIENT_AUTH_FAILURE.
- Cross-check bounded bằng Spotware ctrader-open-api 0.9.2, cùng demo endpoint và chỉ application-auth request, cũng FAIL cùng CH_CLIENT_AUTH_FAILURE. Vì vậy không còn bằng chứng cho CODE_PROTOCOL_BUG, framing bug hoặc endpoint mismatch; blocker được phân loại CREDENTIAL_REJECTED tại application-auth boundary. Portal-side reason cụ thể không được trả về.
- Account auth, account catalog, historical M1 và real realtime cTrader: NOT VERIFIED vì application auth là prerequisite. Không claim fake PASS; không refresh/rotate token để chữa application-auth failure.
- Token lifecycle local đã có refresh trước hạn/auth-expired, validate cả access/refresh token và atomic rotation; refreshed credentials không được log/commit. Persistent secure storage chưa implement, nên refresh tự động qua application restart chưa được claim.
- Local backend/frontend/Python/security/regression evidence trước đó vẫn giữ nguyên; Issue tiếp tục OPEN với IMPLEMENTATION_COMPLETE_INTEGRATION_PARTIAL.

Chi tiết đã append vào specs/PB-049/evidence.md và
docs/market-data/provider-routing.md. Next external action: verify/regenerate
demo application credentials and confirm Open API app entitlement in cTrader
portal, then rerun app/account/catalog/history/realtime matrix.

## Kết quả rerun ngày 13/09/2026 (Chủ nhật)

- Credentials mới đã được đọc trực tiếp từ Windows User Environment trong cùng invocation; chỉ masked lengths được in.
- Application Auth: PASS. Account Auth: PASS.
- Catalog thật: EURUSD `1`, GBPUSD `2`, USDJPY `4`, AUDUSD `5`, USDCAD `8`, USDCHF `6`, NZDUSD `12`; XAUUSD `41`, XAGUSD `42`, XPDUSD `22346` enabled; XPTUSD `22348` present nhưng `ENABLED=FALSE` nên không available trong production catalog.
- Historical M1 thật: PASS cho các cửa sổ verified năm 2020/2022/2024/2025 và thứ Sáu 11/09/2026; XPDUSD năm 2020 ghi `NOT_AVAILABLE_WINDOW`, không fake candle.
- Realtime thật: `CONNECTED` + `SUBSCRIBED`; không có tick mới trong 35 giây Chủ nhật nên `NOT_VERIFIED_MARKET_CLOSED`, không phải FAIL.
- Aggregator 7 timeframe, Redis, SSE, PostgreSQL và regression tests PASS ở các contract/integration path đã chạy; cTrader quote-driven Redis/SSE/finalized-M1 path không claim PASS vì market đóng.
- Parser fix: lọc các trendbar provider trả ngoài cửa sổ `[from,to)` khi response `count=1000` chứa thêm bar cũ; thêm regression test.
- Final status: `IMPLEMENTATION_COMPLETE_INTEGRATION_PARTIAL`; Issue remains OPEN.

## Kết quả rerun ngày 14/09/2026 (thứ Hai)

- Full real cTrader integration `2/2 PASS`: Application/Account Auth, catalog, historical M1 và stream EURUSD đều PASS; stream nhận 43 quote events thật trong 35 giây.
- Rerun đầu tiên phát hiện spot event thật có `bid`/`ask` partial và timestamp lệch tương lai; đã sửa decoder stateful giữ cặp bid/ask cuối, dùng receive-time khi timestamp vượt clock cục bộ, không làm chết stream.
- Unit codec/token/router/aggregator/stream tests và PostgreSQL persistence integration PASS.
- Redis-backed cTrader → Redis/SSE chưa chạy vì Redis disposable/Docker không khả dụng trong môi trường; không dùng quote giả để claim PASS.
- Final status: `IMPLEMENTATION_COMPLETE_INTEGRATION_PARTIAL`; Issue remains OPEN.

## Kết quả xác minh bổ sung ngày 14/09/2026

- Redis QA trên `127.0.0.1:6387` đã hoạt động; các test hit/miss, TTL, lease,
  degradation và live-state đều PASS.
- Root cause của `live-state=400` là cTrader provider ID một chữ số như `1` bị
  validator Redis key từ chối. Đã sửa validator và thêm regression; không còn
  bỏ qua live-state khi cTrader stream dùng ID này.
- Real Binance realtime Redis/SSE/finalized-M1 test PASS.
- Real cTrader capability `2/2 PASS`; disposable authenticated API nhận candle
  cTrader qua SSE và live-state trả `200`, `LIVE`, Redis `HEALTHY`.
- Real provider matrix `2/2 PASS`, đủ 19 symbol yêu cầu: Forex cTrader, metals
  Capital.com, crypto Binance và stocks/ETF Alpaca. XPTUSD không enabled trong
  cTrader catalog nhưng route Capital.com vẫn `READY`.
- Final status tiếp tục `IMPLEMENTATION_COMPLETE_INTEGRATION_PARTIAL`; Issue
  remains OPEN. Refreshed credentials vẫn chỉ sống trong process và chưa claim
  automatic refresh survives restart vì secure persistence chưa implement.
