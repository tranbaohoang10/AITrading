# Free market-data provider audit

Date of audit: 04/09/2026 (Asia/Ho_Chi_Minh)
Issue: [#39](https://github.com/tranbaohoang10/AITrading/issues/39)

## Policy

`public-apis/public-apis`, `PantherAlgoTrading/finance-apis` and
`BuiltByEcho/public-api-finder` are discovery/reference sources only. Their
README entries do not establish that a provider is operational, free, realtime,
licensed for display, historically deep enough or commercially usable. Runtime
calls must go to a selected provider's official endpoint through an adapter.

An ACCEPTED provider must have current official documentation, a usable free
tier for this prototype, appropriate historical OHLCV, truthful data mode,
permitted display use, no paywall bypass/scraping and a passing mapping test.

## Discovery findings

| Discovery source | Finding | Runtime use |
| --- | --- | --- |
| [public-apis/public-apis](https://github.com/public-apis/public-apis) | Lists community-curated finance/crypto entries including Coinbase, Binance, Alpha Vantage, Twelve Data and others; auth/CORS/availability fields are not entitlement proof. | None; discovery only. |
| [PantherAlgoTrading/finance-apis](https://github.com/PantherAlgoTrading/finance-apis) | Curated finance API directory useful for candidate enumeration and comparison. | None; discovery only. |
| [BuiltByEcho/public-api-finder](https://github.com/BuiltByEcho/public-api-finder) | Optional searchable discovery tool for free/public APIs. | None; discovery only. |

## Candidate audit

| Provider | Asset class | Free tier/auth | Historical/realtime | Limits/depth | Display/commercial rights | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Coinbase Exchange | CRYPTO | Public Exchange market-data endpoints; no private key for current public feed. | Official candles REST; public WebSocket trades/matches. Candles max 300/source request and incomplete no-tick intervals. | Current adapter uses bounded 300-source requests and lazy pages; platform/rate limits apply. | Public read-only market-data use is the current prototype basis; retain Coinbase attribution and do not infer rights beyond official terms. | ACCEPTED |
| Alpaca Market Data Basic | STOCK, ETF | Basic is $0 for Trading API; API key ID/secret required server-side. | Historical stock bars and WebSocket IEX feed. Basic equity realtime is IEX only; history has latest-15-minute restriction and since-2016 availability per current plan table. | Official plan table: 200 historical API calls/minute, 30 WebSocket symbols; backend must bound/dedupe/cache. | Use is limited to the configured account/use case and applicable Alpaca/exchange terms. UI must say `ALPACA · IEX`, never consolidated SIP/NASDAQ LIVE. Runtime is enabled only after server configuration and health/mapping checks. | ACCEPTED |
| Twelve Data Basic | FOREX (candidate) | Free individual plan API key. | Realtime forex and history/reference are advertised, but individual plans are personal/internal/non-display; business external display requires paid plan/licensing. | Basic pricing page currently lists 8 API credits/800 day and 8 trial WS; depth/entitlements vary. | Official usage policy prohibits redistribution and commercial display to third parties for individual plans. Not eligible for human-visible chart. | RESEARCH_ONLY |
| Finnhub free | FOREX (candidate) | API key. | Official API documentation marks Forex Candles Premium; free quote/rates do not establish free historical candles. | Endpoint/plan dependent. | No free-tier evidence for the required human-visible FX OHLC chart. | REJECTED |
| Alpha Vantage free | STOCK, FOREX (candidate) | API key. | Many datasets are free, but official support/premium pages state standard 25 requests/day; realtime/15-minute US data requires premium/entitlement flow. | 25 requests/day is incompatible with multi-cell active chart use; history depth/endpoint terms vary. | Not suitable for this live chart and not used as a quota checkbox. | REJECTED |
| CME Group/DataMine | FUTURES (candidate) | Account/licensing/Information License Agreement or product access. | Official pages describe REST/WebSocket futures data and historical DataMine, but access is licensed rather than a free prototype tier. | Product/license specific. | Official page requires licensing/access steps; no free display entitlement established. | REJECTED |
| Polygon/Massive market data | STOCK/FOREX/FUTURES candidate | Account/API key; plan and exchange entitlements vary. | Official terms/pricing do not establish a free, human-displayable futures/FX feed meeting this Issue. | Plan/exchange dependent. | Market-data terms restrict redistribution/display absent applicable rights. | REJECTED |

## Official evidence used

- [Coinbase product candles](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles): REST path, OHLCV schema, no-tick caveat and 300-candle cap.
- [Alpaca Market Data API](https://docs.alpaca.markets/us/docs/about-market-data-api): Basic $0, US Stocks/ETFs, IEX realtime, 30 symbols, historical availability and request limits.
- [Alpaca Market Data FAQ](https://docs.alpaca.markets/us/docs/market-data-faq): server headers, IEX WebSocket endpoint, IEX vs SIP distinction and feed parameter.
- [Alpha Vantage pricing/support](https://www.alphavantage.co/premium/) and [support FAQ](https://www.alphavantage.co/support/): 25-request/day standard limit and realtime/delayed entitlement caveats.
- [Finnhub official API docs](https://finnhub.io/docs/api/quote): Forex Candles marked Premium.
- [Twelve Data commercial/personal usage](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage) and [business pricing](https://twelvedata.com/pricing-business): individual internal/non-display restriction and paid external display plans.
- [CME futures data](https://www.cmegroup.com/market-data/browse-data/catalog/futures-and-options-data.html): DataMine/API access and Information License Agreement path.

## Production policy outcome

Crypto remains enabled through Coinbase. Stocks/ETFs are enabled only when
server-side Alpaca credentials are present and successful mapping/search/history
checks pass; all visible feed labels remain IEX. Forex and Futures remain hidden
by default in this prototype. A future provider cannot be enabled from this file
alone: it must pass a fresh official-doc/terms/pricing audit and the Issue's real
request, mapping-test and browser evidence gates.
