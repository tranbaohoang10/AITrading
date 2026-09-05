# PB-038 — Hoàn thiện Chart Workspace và tích hợp nguồn dữ liệu thị trường miễn phí

Issue: [#39](https://github.com/tranbaohoang10/AITrading/issues/39)
Date: 04/09/2026 (Asia/Ho_Chi_Minh)

## Goal and scope

Đưa Chart Workspace tiến gần trải nghiệm professional trading platform bằng
implementation React/TypeScript/SVG và Spring Boot riêng của AITrading. Coinbase
Exchange vẫn là nguồn crypto hiện có. Stocks/ETFs chỉ hiện khi Alpaca Basic được
cấu hình ở backend và vẫn phải gắn nhãn `ALPACA · IEX`. Forex/Futures không được
hiện nếu audit chính thức không chứng minh free tier và quyền display phù hợp.

Phạm vi gồm chart navigation/layout, drawing undo/redo, indicators picker,
symbol search, clock/timezone/settings/context menu, unified provider contracts,
provider audit, Alpaca adapter/backend, bounded cache/limiter/subscription sharing
và test/evidence. Không gồm live-money order, payment, provider scraping,
TradingView scripts/assets, hoặc thay đổi Strategy DSL/backtest/journal semantics.

## Use case

### UC-038-01 — Inspect a verified market in Chart Workspace

- Actor: authenticated research user.
- Trigger: mở Chart Workspace hoặc chọn symbol/layout/timeframe.
- Preconditions: Coinbase public feed hoạt động; Alpaca là tùy chọn và chỉ hoạt
  động khi hai environment secret tồn tại ở server.
- Happy path: mở Symbol Search, chọn instrument; xem OHLCV history và status
  truthful; đổi layout; zoom/pan kể cả future blank space; thêm indicator/drawing;
  undo/redo; mở settings/context menu; đổi timezone mà timestamps nội bộ vẫn UTC.
- Alternate path: category không có provider hợp lệ bị ẩn; thiếu Alpaca config
  giữ crypto hoạt động và hiện trạng thái chưa cấu hình, không có fake result.
- Error path: provider timeout/429/malformed response hiển thị lỗi bounded và
  không làm mất history đã xác minh; subscription cũ bị đóng khi đổi selection.
- Postconditions: chart chỉ render dữ liệu đã validate; không có credential trong
  frontend bundle, response, log hoặc repository.

## Acceptance criteria

### Market-data integrity

- AC-01: `docs/market-data/free-provider-audit.md` ghi rõ discovery source và
  entitlement evidence chính thức cho từng candidate; status là ACCEPTED,
  REJECTED hoặc RESEARCH_ONLY.
- AC-02: Coinbase REST/WebSocket tiếp tục hoạt động với Candle/Instrument trung
  lập; không gọi public-apis/finance-apis/runtime scraping để lấy OHLCV. Khi
  trình duyệt không truy cập được host WebSocket/REST công khai, chart dùng API
  cùng origin đã xác thực để proxy dữ liệu và chuyển sang `DELAYED` polling có
  giới hạn, không treo ở trạng thái loading vô hạn.
- AC-03: Alpaca Basic nếu configured dùng Stocks/ETFs history/search và IEX
  realtime đúng endpoint/channels chính thức; UI phân biệt listing exchange với
  `ALPACA · IEX`; thiếu key/secret fail closed.
- AC-04: Forex/Futures chỉ được enable sau audit PASS cho display; nếu không,
  tabs/result bị ẩn và không tạo dữ liệu giả. Alpha Vantage, Finnhub và Twelve
  Data được ghi nhận theo giới hạn/quyền hiện tại.
- AC-05: provider-specific parsing/mapping nằm ở provider layer; Chart không
  chứa raw Coinbase/Alpaca JSON. Request cache/dedupe/429 backoff/abort và
  subscription ref-count có giới hạn rõ ràng.

### Chart workspace

- AC-06: layouts 1, 2H, 2V, 4, 8 lấp đầy 100% workspace; cell có `min-width: 0`,
  `min-height: 0`, active cell rõ ràng, splitter đúng hướng và double-click reset.
- AC-07: initial viewport tính theo chart width, mục tiêu 7–10px/bar và khoảng
  100–180 bars desktop; 20,000 bars là cache availability, không phải visible
  default. Candle body 55–75% slot, minimum 1px.
- AC-08: wheel zoom theo pointer, pan có right offset/future blank space bounded,
  không tạo future candle; realtime không reset manual viewport/scale; drawing
  lưu semantic `{time, price}` và hỗ trợ time tương lai; có Go to realtime.
- AC-09: toolbar có hierarchy/dividers; Chart Type/Layout/Indicators gần market
  controls, utility ở phải; không có enabled dead button. Nhãn Indicators nằm
  ngang cùng icon và caret `^` cho biết có thể mở thư viện chọn nhiều chỉ báo.
- AC-10: Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z và nút Undo/Redo hoạt động cho create,
  delete, move, anchor edit, clear drawings; bỏ qua text fields/editors.

### Indicators, symbol search and time/settings

- AC-11: Indicator Picker là modal library có search/category, Favorites, My
  Indicators, built-ins, AI/Quant và Community. Community rỗng hiển thị
  đúng trạng thái chưa publish; không copy TradingView community. Người dùng
  có thể thêm nhiều built-in indicators và các indicator đã thêm cùng xuất hiện
  trong active legend/pane.
- AC-12: built-ins hiện có SMA/EMA/BB/VWAP/RSI/MACD/ATR giữ nguyên; indicator mới
  chỉ thêm cùng formula tests và pane placement đúng.
- AC-13: Symbol Search là modal debounce bounded, tìm theo ticker/name/base/quote/
  exchange, hiển thị icon/symbol/name/listing exchange/provider-feed và chỉ có
  category thực sự configured.
- AC-14: format price dùng `priceIncrement`/`pricePrecision` thống nhất ở header,
  OHLC, axis, crosshair, label drawing và position; không hard-code 2 decimals.
- AC-15: clock cập nhật mỗi giây độc lập chart; timezone picker gồm UTC/Exchange/
  Local/America/New_York/Europe/London/Asia/Tokyo/Asia/Ho_Chi_Minh; UTC là storage.
  Gear mở Settings với các tab Symbol, Scales & Lines, Canvas chỉ cho setting đã
  implement; body/price-axis/time-axis context menus có item hoạt động thật.

### Compatibility, security and performance

- AC-16: Drawing, AI Capture, Assistant/chat persistence, Strategy DSL, backtest,
  journal và Coinbase regression vẫn pass; không thêm migration nếu không cần.
- AC-17: secrets `ALPACA_API_KEY_ID`/`ALPACA_API_SECRET_KEY` chỉ server-side;
  fixed provider allowlist, validation/bounds, redacted errors/logs, no SSRF,
  XSS/injection, mass assignment or unauthorized private market-data access.
  Coinbase proxy cũng yêu cầu authenticated workspace header, chỉ cho symbol/USD
  và granularity/range đã giới hạn, đồng thời không chuyển tiếp URL tùy ý.
- AC-18: giữ `MAX_CACHED_BARS = 20_000`, render visible window + overscan, lazy-load
  multi-chart, shared cache/streams, cleanup on cell removal và không spam provider.

## Test and evidence requirements

Tests phải bao phủ mapping raw→neutral, precision/mode, provider selection,
missing auth, cache/dedupe/429/abort/subscription cleanup, hidden categories,
search aliases, every layout/splitter, visible density/future offset/zoom,
drawing history/future anchors, indicator formulas/panes, time/settings/context
menus, secret non-exposure và existing feature regression. Real provider claims
require official docs + real request + mapping test + browser evidence. Missing
credentials or inaccessible provider is recorded as BLOCKED, never PASS.

## Definition of done

CNPM artifacts, audit and separate test Markdown are complete; all applicable
automated frontend/backend/security/build checks pass; browser QA covers desktop,
tablet and mobile chart flows; exact pushed SHA is verified; Issue #39 is updated
and closed only when no required criterion remains unverified.
