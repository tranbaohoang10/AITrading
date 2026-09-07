# Research — Chart toolbar and market discovery refinement

Date: 07/09/2026, Asia/Ho_Chi_Minh. This is design research, not permission to
copy third-party UI code, icons or market data.

## Replay entry

**Decision**: Put an original Replay icon on the top toolbar and open a compact
Day/Month range selector before the existing simulation workspace.

**Rationale**: TradingView documents Bar Replay as a top-panel action and supports
choosing a chart bar or a specific date. Its date selector jumps to the nearest
available historical bar. The requested AITrading interaction maps cleanly to the
existing provider coverage and Replay session APIs.

**References**: [TradingView Bar Replay](https://www.tradingview.com/support/solutions/43000474024-how-do-i-turn-bar-replay-on/), [date selection](https://www.tradingview.com/blog/en/selecting-bar-replay-starting-point-44104/).

**Alternatives considered**: Keep the bottom-right text button (rejected by the
request); copy TradingView visuals (rejected; only interaction hierarchy is used).

## Position setup

**Decision**: One Position Setup panel owns Long/Short, balance, entry, Risk %,
verified lot/quantity, SL %, TP % and calculated preview; it uses the existing
Replay command and position drawing.

**Rationale**: TradingView's documented position tool exposes account size, risk
amount/percentage, lot size, entry, target/stop and quantity precision. LuxAlgo's
public documentation describes the same entry/stop/target interaction and derives
position size from risk percentage and account balance. AITrading must keep its
own formulas and conservative execution rules.

**References**: [TradingView Long/Short tools](https://www.tradingview.com/support/solutions/43000475660-how-to-use-long-and-short-position-drawing-tools/), [LuxAlgo drawing tools](https://docs.luxalgo.com/vela/user/drawing-tools), [LuxAlgo calculators](https://www.luxalgo.com/blog/luxalgos-trading-and-investing-calculators/).

**Alternatives considered**: A separate calculator disconnected from Replay
(rejected due to duplicated state); always show Lot (rejected because current
Coinbase/Alpaca metadata does not establish contract lot semantics).

## Symbol search and logos

**Decision**: Search provider catalogs by pages, show symbol/name/provider/feed,
and resolve icons through approved sources with a deterministic fallback.

**Rationale**: TradingView's public UI documentation groups search by asset type
and source and supports paginated symbol search and logo URLs. It does not grant
rights to copy TradingView's own logo assets. The current project only draws a
small set of crypto SVGs and generic stock/futures glyphs.

The preferred crypto artwork candidate is
[spothq/cryptocurrency-icons](https://github.com/spothq/cryptocurrency-icons),
published under CC0-1.0 with SVG/PNG variants and a generic fallback. Any stock
company mark remains subject to trademark and provider-display rights; use a
ticker fallback unless a provider explicitly supplies a permitted image.

**References**: [TradingView Symbol Search guidance](https://www.tradingview.com/support/solutions/43000746682-tradingview-symbol-search-tips-for-finding-assets/), [Advanced Charts symbol/logo contract](https://tradingview.com/charting-library-docs/latest/ui_elements/Symbol-Search/).

**Alternatives considered**: Scrape TradingView/LuxAlgo logos (rejected); ship a
hardcoded logo switch for every ticker (does not scale); arbitrary third-party
logo URL (rejected for SSRF, tracking and license risk).

## Provider breadth

**Decision**: Expand only through providers that pass official API, quota,
display-right and actual-response checks.

- Coinbase public products/candles/WebSocket remain the crypto realtime base;
  official candle docs cap a response at 300 and warn about no-tick gaps.
- Binance's official public-data repository provides Spot and crypto Futures
  klines with checksums and symbol-download tooling. Futures still require verified
  contract sizing/identity before the UI exposes trading semantics.
- Frankfurter remains daily ECB reference Forex, never intraday or CFD.
- Alpaca free/standard equities use IEX or delayed SIP depending entitlement;
  current live browser proof is blocked without account credentials.
- Twelve Data Basic advertises broad free data but lists internal non-display
  usage; it is not accepted for this human-visible chart.
- Finnhub's official documentation marks Forex candles Premium.
- Massive Basic advertises free EOD stocks. It remains a research candidate until
  API-key, display/redistribution terms, symbol pagination and real response pass.
- No accepted free human-display source currently covers general broker CFDs or
  exchange futures such as CME. Those categories remain hidden rather than filled.

**References**: [Coinbase candles](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles), [Binance public data](https://github.com/binance/binance-public-data), [Alpaca market-data plans](https://docs.alpaca.markets/us/docs/about-market-data-api), [Twelve Data pricing](https://twelvedata.com/pricing), [Finnhub API](https://finnhub.io/docs/api/quote), [Massive stocks](https://www.massive.com/stocks).

## Timeframe, crosshair and timezone

**Decision**: Use a shared portal-based anchored popover for timeframe/clock;
timeframe visually matches Symbol. Preserve simultaneous price/time crosshair
labels and make their visibility an actual browser acceptance criterion.

**Rationale**: Current `TimeframePopover` already escapes toolbar overflow but its
trigger lacks hover/caret. Current `ChartClock` opens an absolute `bottom-9` panel
from the top toolbar, which can place it above the visible viewport. Current
`CandleChart` draws both labels, so implementation should repair visibility and
clamping rather than invent a second crosshair.

TradingView documents that chart timezone changes display, while exported/raw
time can remain UTC. AITrading keeps canonical candle timestamps UTC.

**References**: [TradingView Supercharts/timezone overview](https://www.tradingview.com/support/solutions/43000746464-getting-started-with-supercharts/), [timezone behavior](https://www.tradingview.com/support/solutions/43000691967-what-timezone-is-displayed-in-alerts/).
