# Provider audit — Replay mission

Verified 06/09/2026 Asia/Ho_Chi_Minh. Refs #39, #46, #47.
This extends the previous free-provider-audit.md; older conclusions remain history.
Repository license does not independently establish every upstream data right.
Accepted scope here is attributed local research prototype; no assertion of
commercial redistribution rights. Secrets and entitlement checks remain backend.

| Provider / official repository or API | Asset | Historical / intraday / realtime | Depth / quota / bulk / key | Display/license and status | Reason |
| --- | --- | --- | --- | --- | --- |
| [Coinbase](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles) | Crypto | REST OHLCV / yes / public WS | 300/request; exact earliest unknown; no bulk; no key | ACCEPTED for existing attributed public research | REST paging; no-tick gaps; WS required for realtime |
| [Binance Public Data](https://github.com/binance/binance-public-data) | Crypto Spot; futures archive candidates | daily/monthly kline archives / yes / no stream in this adapter | archive-specific verified ranges; daily files next day; checksum; no key | ACCEPTED local public historical research; MIT repository, public download documented | bounded selected Spot archives; no Coinbase relabeling; futures contract sizing not yet enabled |
| [Frankfurter](https://frankfurter.dev/) / [repository](https://github.com/lineofflight/frankfurter) | FX reference | daily observations / no / no | provider-specific coverage; public or self-host; no key | ACCEPTED ECB reference display under existing audit | EOD/reference only; no normal trading replay |
| [Alpaca](https://docs.alpaca.markets/us/docs/about-market-data-api) | US stocks/ETF | historical bars / yes / IEX when entitled | plan-dependent depth/limits; key required; pagination | CONDITIONAL configured account and feed/display entitlement | IEX is not consolidated US market; live verification pending |
| [FRED](https://fred.stlouisfed.org/docs/api/fred/) | Macro | economic observations / not candles / not exchange realtime | series-dependent; API key; no candle replay | CONDITIONAL series terms/key; runtime adapter pending | keep MACRO separate |
| [Alpha Vantage](https://www.alphavantage.co/support/) | Global daily candidates | endpoint/entitlement-dependent | standard 25/day documented; key; full/premium not assumed | CONDITIONAL; runtime disabled until exact entitlement | replaces prior blanket rejection for new explicitly conditional scope |
| [OpenBB](https://github.com/OpenBB-finance/OpenBB) | Multi-asset integration reference | depends upstream | provider-specific | REFERENCE, AGPLv3; no copied code/service | provider normalization reference only |
| [AKShare](https://github.com/akfamily/akshare) | Multi-asset research | upstream-dependent | upstream-dependent | RESEARCH_ONLY | exact upstream display/stability audit required |
| [FinanceDataReader](https://github.com/FinanceData/FinanceDataReader) | Multi-asset reader | upstream-dependent | upstream-dependent | RESEARCH_ONLY | crawler routes not accepted runtime feed |
| Dukascopy downloader candidates | FX/CFD | claimed tick/history by third parties | not verified | BLOCKED_LICENSE | written automated use/display/storage permission absent; official terms URL retrieval failed; no bypass |
| Twelve Data | multi-asset | plan-dependent | free limited | RESEARCH_ONLY/default disabled | existing official non-display audit; fresh terms verification pending |
| Tiingo | multi-asset | plan-dependent | free limited | RESEARCH_ONLY/default disabled | fresh intended display entitlement verification pending |
| EODHD | daily candidates | plan-dependent | free limited | RESEARCH_ONLY/default disabled | fresh intended display entitlement verification pending |
| Marketstack | EOD candidates | plan-dependent | free limited | RESEARCH_ONLY/default disabled | fresh intended display entitlement verification pending |
| TradingView/tvdatafeed/Yahoo/Investing/ForexFactory scraping | none enabled | no accepted contract | N/A | REJECTED | explicitly excluded, no hidden endpoints |

Implementation and real integration status are tracked separately in
specs/REPLAY/test-cases.md. ACCEPTED does not mean browser QA passed.

## Technical facts affecting implementation

Binance Spot timestamps from 01/01/2025 are microseconds; older timestamps use
milliseconds. Checksum must match downloaded bytes before CSV parsing. Archive
updates can occur, so a persisted replay snapshot must remain stable.
Coinbase may return candles preceding requested start; filter and deduplicate UTC
boundaries. Do not fabricate intervals with no ticks. Coverage shows only probed
range, no invented global earliest date.

## Dependency decision

[Spring Boot Redis documentation](https://docs.spring.io/spring-boot/reference/data/nosql.html)
confirms starter-data-redis uses Lettuce and StringRedisTemplate. Use the current
Boot 4.1.1 dependency management and lock resolved versions. Spring Data/Lettuce
are Apache-2.0; dependency vulnerability checks still required before delivery.
Redis network endpoint stays server-side; local test deployment must bind loopback,
following [Redis security guidance](https://redis.io/docs/latest/operate/oss_and_stack/management/security/).
JDBC sessions remain unchanged.

## Revision history

06/09/2026: initial fresh official-source audit. Unverified terms are explicitly
pending and disabled, not inferred permission. No third-party repository code copied.

## 07/09/2026 — fresh entitlement and implementation review

- [Twelve Data terms](https://twelvedata.com/terms) and
  [usage guidance](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage)
  distinguish internal/personal development use from commercial display and
  redistribution. External display requires the relevant plan/add-on/agreement;
  the application has no verified entitlement, so this candidate stays disabled.
- [Tiingo pricing](https://www.tiingo.com/about/pricing) distinguishes internal
  use from data distribution. No application display agreement is configured;
  disabled, rather than treating a free key as redistribution permission.
- [EODHD commercial licensing](https://eodhd.com/financial-apis/commercial-vs-personal-license-use)
  identifies listed retail packages as personal-use offerings, with commercial
  onboarding separate. Its feed provenance can be indicative/aggregated; no
  exchange-realtime claim or default adapter is enabled.
- [Marketstack agreement](https://marketstack.com/agreement) was retrieved.
  Exact plan/data-source display rights for this application are not established;
  candidate remains disabled pending that evidence.
- Alpaca normalized adapter now implements bounded next_page_token paging with
  explicit start/end and IEX/raw feed, retains unknown sizing metadata, and reports
  configured=false without credentials. Corrected existing URI resolution that
  discarded /v2. Live entitlement verification remains BLOCKED_EXTERNAL.
- Frankfurter is represented in the common capability registry as FX_REFERENCE,
  daily only, nontradable, no lot metadata, historicalReplaySupported=false. The
  backend enforces the prohibition, independently of UI provider options.
- Redis test server is Alpine package 8.4.2 in an isolated WSL distribution;
  [Redis licensing](https://redis.io/legal/licenses/) documents the Redis 8 license
  choices. This is unmodified local test infrastructure, not copied application
  code or a redistributed server build. Spring Data/Lettuce remain Apache-2.0.
  CI uses Ubuntu's maintained redis-server package in a disposable runner.

No new provider contract is inferred from these audits. Real Binance/Coinbase
browser evidence and Redis tests are recorded separately from licensing status.

## 09/09/2026 — Owner refinement audit limitation

Official OANDA account/pricing documentation and cTrader connection documentation could not be fetched in this environment (connection refused on port 443). This does not prove the services are generally unavailable; it blocks current API/terms verification here. Alpaca real-time stock data documentation returned HTTP 200, but no authorized credentials/entitlement or genuine live adapter has been established. No new broker route is enabled or inferred from sample symbol names. See specs/PB-038/owner-refinement-tests.md for explicit unfinished implementation versus external blockers.

## 09/09/2026 — Provider completion implementation audit

- `dereknguyen269/free-services` is classified `INFRA_REFERENCE_ONLY`. Its
  current README is a curated list of hosting, database, cache, monitoring and
  other developer free tiers. Upstash and Redis Cloud may be useful operational
  references, but the repository is not an executable or licensed financial
  market-data source and is not accepted for Forex, CFD, Stock, Futures or crypto
  candles. No dependency or runtime feed was added from it.
- Alpaca now has a server-side IEX WebSocket adapter using authenticated trade
  subscriptions, bounded frames, validated symbols/events, candle aggregation,
  provider-specific Redis state, shared subscriptions and bounded reconnect.
- OANDA now has a server-side v20 account-catalog adapter, bounded midpoint
  candlestick windows and the authenticated pricing HTTP stream. Only instruments
  returned by the configured account become routes; `USOIL` is exposed only when
  the actual `WTICO_USD` instrument is present.
- cTrader now has a minimal protobuf wire implementation derived from Spotware's
  official schemas, TLS hostname verification, application/account auth, broker
  symbol discovery, trendbars and spot subscriptions over the official demo/live
  proxy hosts. It does not scrape or substitute an HTTP quote source.
- External terms pages for OANDA/cTrader still refused HTTPS from this environment.
  Official OANDA's `v20-python` source and Spotware's official protobuf/example
  repositories were used as protocol evidence. Real account entitlement and live
  events remain `BLOCKED_EXTERNAL` until credentials are supplied privately.

## 09/09/2026 — Final provider audit correction

The earlier statement that the Alpaca/OANDA/cTrader adapters were unfinished is
historical. All three adapters are now locally implemented and test-verified.
Spotware protobuf field IDs were checked against official commit
`3fd8bddfbe0cfc2ecfda079623dc4e498af11e66`; OANDA protocol behavior remains
based on the official `oanda/v20-python` implementation because the documentation
host refused this environment's HTTPS connection.

Catalog exposure remains fail-closed and account-derived. OANDA does not map every
CFD to commodity, and cTrader does not infer every six-character symbol is Forex.
Real display entitlement and authenticated event evidence are still external
requirements, so implementation completion does not change their
`BLOCKED_EXTERNAL` QA status.
