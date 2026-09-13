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
