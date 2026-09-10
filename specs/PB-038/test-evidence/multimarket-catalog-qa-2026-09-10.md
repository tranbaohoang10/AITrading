# PB-038 — Multi-market catalog QA — 10/09/2026

Issue: [#39](https://github.com/tranbaohoang10/AITrading/issues/39)

Status: **PASS_WITH_REALTIME_BLOCKER**. This evidence contains no credential,
session token, account identifier or provider authentication header.

## Coinbase catalog

- Official Coinbase Exchange REST returned HTTP 200 and 837 product records.
- The backend-neutral catalog accepted 484 schema-valid `*-USD` products with
  verified positive price/base increments. A stricter operational snapshot that
  additionally required `status=online` and `trading_disabled=false` contained
  399 USD products in the final snapshot. These counts use different documented predicates and are
  intentionally reported separately.
- Empty-query discovery paginated 20 bounded pages, protected against repeated
  cursors, duplicate instrument identities, request abort and a 20-second UI
  timeout. Typed queries still call the provider-backed server catalog.
- Target discovery PASS: BTC, ETH, SOL, XRP, DOGE, ADA, AVAX, LINK, LTC, BCH,
  DOT, SUI, UNI, AAVE, SHIB, PEPE, XLM and HBAR.
- `TRX-USD`: **UNSUPPORTED_BY_COINBASE** in the observed catalog; no row was
  fabricated.
- Representative browser chart QA used real history and Coinbase WebSocket
  events for BTC, ETH, SOL, XRP, ADA and AVAX. BTC 1m/5m received real live
  events; higher timeframes stayed truthful while waiting for the next trade.
  Symbol switching did not mix providers or retain stale-symbol candles.

## Alpaca Paper / IEX

- Capability HTTP 200: `configured=true`, historical/realtime enabled, and all
  required timeframes `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d` advertised.
- Catalog: **13/13 PASS** for AAPL, NVDA, MSFT, TSLA, AMZN, META, GOOGL, GOOG,
  AMD, SPY, QQQ, IWM and DIA.
- Historical: **91/91 PASS** with non-empty real IEX/raw responses, valid OHLCV
  invariants and bounded timestamps. The sequential run completed 90 cases; the
  sole `GOOGL 1h` HTTP 429 case passed on one isolated retry after cooldown.
- The high-volume QA respected both application and provider throttling. It did
  not disable or bypass the authenticated `/api/market/providers/**` limiter.
- Official IEX WebSocket authentication/subscription was already verified in
  `alpaca-authenticated-qa-2026-09-10.md`. The provider clock showed the US
  equity market closed; no trade event was fabricated. Live event and realtime
  CandleChart update remain **BLOCKED_MARKET_CLOSED**.

| Symbol | 1m | 5m | 15m | 30m | 1h | 4h | 1d | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AAPL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |
| NVDA | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |
| MSFT | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |
| TSLA | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |
| AMZN | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |
| META | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |
| GOOGL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |
| GOOG | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |
| AMD | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |
| SPY | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |
| QQQ | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |
| IWM | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |
| DIA | PASS | PASS | PASS | PASS | PASS | PASS | PASS | 7/7 |

## Other asset classes

- Forex: **NOT_READY_REALTIME**. cTrader is not configured. Frankfurter is
  historical/delayed reference data only and is not labelled live.
- Commodities: **NOT_READY**. cTrader is not configured; XAU/USD, XAG/USD and
  USOIL are not fabricated or incorrectly mapped to futures.
- Futures: **NOT_READY**. No approved realtime futures catalog is configured;
  crypto spot is not presented as futures.

## Icon and row QA

- Local 28x28 SVG coverage includes BTC, ETH, SOL, XRP, ADA, DOGE, LINK, AVAX,
  LTC, BCH, USDT, DOT, SUI, UNI, AAVE, XLM and HBAR. SVG XML parsing and the
  forbidden construct scan passed; assets contain no script, event handler,
  `foreignObject`, external URL/entity or runtime hotlink.
- SHIB and PEPE remain discoverable with a deterministic accessible fallback;
  missing approved artwork never removes a real provider instrument.
- Normal rows contain icon, display symbol and friendly name only. Provider/feed
  identity remains metadata and `Alpaca`/`IEX` is not shown as row clutter.
- Browser All contained 497 rows: 484 Coinbase instruments plus the 13 bounded
  Alpaca stock/ETF rows. Asset-class-aware ranking prevents Coinbase symbols such
  as `META-USD` and `DIA-USD` from being promoted as the featured equity ticker.

## Verification

- Focused frontend catalog/icon tests: 18/18 PASS.
- `python scripts/test_backend.py`: PASS, Gradle `BUILD SUCCESSFUL` in 5m02s.
- `npm run lint`: PASS.
- `npm run build`: PASS; existing chunk-size warning only.
- `npm audit --audit-level=high`: PASS, 0 vulnerabilities.
- `git diff --check`: PASS.
- Full frontend suite: 57 files, 327/327 PASS with one worker. Earlier parallel
  runs observed isolated 5-second timeouts under concurrent provider/backend and
  497-row browser rendering load; Journal 17/17 and Market 16/16 both passed on
  isolated reruns without changing test timeouts or expectations.
- Browser Symbol Search: 497 All rows, major icons/fallbacks, stock/ETF rows,
  truthful Futures/Forex/Commodities states and zero console warn/error PASS.

## Final result

- Catalog remediation, Coinbase discovery, target crypto, icons, truthful empty
  states, Alpaca catalog and Alpaca historical 91/91: **PASS**.
- Alpaca actual trade event and CandleChart update: **BLOCKED_MARKET_CLOSED**.
- Issue #39 remains open until real IEX trade-to-candle evidence is observed
  during market-open conditions.
