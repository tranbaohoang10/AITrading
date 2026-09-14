# Market-data provider routing

## Deterministic policy

The registry keeps one provider route for a request and does not round-robin or
merge candles from multiple providers. The preferred order is:

| Asset class | Primary | Fallbacks | Notes |
| --- | --- | --- | --- |
| Stock | Alpaca | None | US equity route only. |
| ETF | Alpaca | None | Uses the provider's ETF instrument semantics. |
| Crypto | Binance | None | Keeps symbols such as `BTC/USDT` unchanged. |
| Forex | cTrader | Capital.com, then Dukascopy reference | cTrader is selected only when the authenticated account catalog contains the symbol. |
| Commodity / metal | Capital.com | cTrader when the authenticated catalog contains it, then Dukascopy reference | Capital instruments are CFDs; cTrader fallback is account-specific. |

The historical sync service may move to the next configured provider only when
the selected provider fails before storing any candle. It never appends a
second provider to an already stored series. Each persisted route retains its
provider and provider symbol, so a fallback is visible in coverage and dataset
provenance.

## cTrader catalog rule

cTrader symbols are discovered from the authenticated broker account. The
application does not invent a cTrader metal symbol from a display label. A
metal fallback is eligible only after the real account catalog returns a
matching instrument. If cTrader authentication or catalog discovery fails, the
route remains unavailable or uses the configured policy fallback; no synthetic
symbol is created.

## Runtime isolation

Provider clients and stream hubs are separate. cTrader failures are converted to
provider-scoped failures and do not stop Alpaca, Binance, Capital.com or
Dukascopy workers. Redis hot state includes the provider identifier and source
symbol. The cTrader stream publishes current M1, M5, M15, M30, H1, H4 and D1
forming candles through the existing Redis/SSE contract while persisting only
finalized M1 candles.

## Historical verification status — 13/09/2026

Local routing, aggregation and provider-isolation tests pass. The real cTrader
smoke test reached the demo Open API but was rejected with
`CH_CLIENT_AUTH_FAILURE` during application authentication on 13/09/2026. A
bounded cross-check using Spotware's `ctrader-open-api` 0.9.2 SDK, with the same
official demo endpoint and only the application-auth request, returned the same
error. TCP/TLS and protobuf framing therefore pass; the failure is classified as
an external cTrader application-credential rejection, not an access-token,
refresh-token or account-catalog failure. The exact portal-side reason is not
visible to this application. No real cTrader catalog, history or realtime
capability is claimed until the app credentials/entitlement are corrected and
the smoke matrix passes.

### Sanitized diagnostic stages

| Stage | Result | Evidence |
| --- | --- | --- |
| TCP/TLS | PASS | `demo.ctraderapi.com:5035` reachable; TLS established |
| Protobuf framing | PASS | Production client and official SDK both received a decoded `ProtoOAErrorRes` |
| Application auth | FAIL | `CH_CLIENT_AUTH_FAILURE` from both implementations |
| Account auth | NOT RUN | Correctly blocked until application auth passes |
| Catalog/history/realtime | NOT RUN | Correctly blocked until account auth passes |

The cTrader token lifecycle remains implemented in-memory with atomic access /
refresh-token rotation and secret-safe failure handling. Persistent secure
storage is not implemented, so rotated credentials do not survive an application
restart automatically.

### Sunday realtime semantics — 13/09/2026

The real demo stream for `EURUSD` completed TCP/TLS, application auth, account
auth and spot subscription. The bounded 35-second observation on Sunday,
13/09/2026, received no new quote, so the truthful state is
`CONNECTED` + `SUBSCRIBED` + `NOT_VERIFIED_MARKET_CLOSED`; it is not a connect or
subscription failure and no historical or synthetic tick was used.

On 14/09/2026, an open-market real stream produced `CONNECTED` + `SUBSCRIBED`+
`LiveQuote=PASS` with 43 EURUSD events in the bounded observation. cTrader spot
events may carry only one of the optional bid/ask fields; the decoder therefore
retains the latest pair and emits a midpoint only after both sides are known.
### Frontend live-route remediation — 14/09/2026

The chart provider factory now normalizes live cTrader and Capital.com catalog
instruments to the canonical chart symbol while retaining the broker symbol for
history and SSE subscription requests. Capital.com is included in the frontend
catalog and stream whitelist, and Alpaca/Capital/cTrader routes use the same
authenticated backend stream contract. Configured live routes replace the static
Frankfurter reference rows; reference rows remain only as a fail-safe when a live
provider is unavailable. Forex display precision defaults to five decimals for
non-JPY pairs and three decimals for JPY pairs, while provider increments remain
authoritative when supplied.

This change does not fabricate realtime data: an instrument is shown as live only
when its provider catalog advertises `REALTIME` and the authenticated stream emits
provider events. Full Spring real-provider verification still requires the
disposable PostgreSQL/Redis test services.

## Current verification status — 14/09/2026

The 14/09/2026 rerun used the disposable PostgreSQL test database and the real
provider endpoints. `RealMarketProviderIntegrationTests` completed `2/2` with
all 19 required symbols in `READY` state: seven Forex routes through cTrader,
four metals through Capital.com, two crypto symbols through Binance, and six
stocks/ETFs through Alpaca. The test persisted real M1 data and derived M5, H1
and D1 coverage for each ready route.

### Sanitized cTrader diagnostic stages

| Stage | Result | Evidence |
| --- | --- | --- |
| TCP/TLS | PASS | `demo.ctraderapi.com:5035` reachable; TLS established |
| Protobuf framing | PASS | Production codec decoded bounded cTrader responses |
| Application auth | PASS | `ProtoOAApplicationAuthRes` received |
| Account auth | PASS | `ProtoOAAccountAuthRes` received for the configured account |
| Forex catalog | PASS | EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF and NZDUSD discovered |
| Historical M1 | PASS | Required cTrader windows returned real rows; parser honors `[from,to)` |
| Realtime quote | PASS | Bounded EURUSD stream received 38 real quote events |

The cTrader account catalog exposes XAUUSD, XAGUSD and XPDUSD as enabled; XPTUSD
is not enabled in that account. The required XPT/USD route therefore remains
available through Capital.com rather than being fabricated as a cTrader symbol.

### Redis/SSE downstream

`MarketRedisIntegrationTests` and `MarketLiveStateRedisIntegrationTests` pass
against the owned Redis QA listener at `127.0.0.1:6387`, including TTL, lease,
degradation and a one-character cTrader provider ID key. The real Binance test
updated Redis, published SSE and persisted a finalized M1 candle. A disposable
authenticated API test also received a real cTrader candle over SSE and then
returned live-state HTTP `200` with Redis health `HEALTHY`, status `LIVE` and a
latest state present.

The one-character key fix is required because cTrader catalog IDs include `1`,
`2`, `4`, `5`, `6` and `8`; rejecting those IDs silently dropped cTrader live
state while the SSE candle still appeared. Redis writes now accept sanitized
provider keys from one to 64 alphanumeric characters.

### Frontend live-route remediation — 14/09/2026

The chart provider factory normalizes live cTrader and Capital.com catalog
instruments to canonical chart symbols while retaining broker symbols for
history and SSE subscription requests. Capital.com is included in the frontend
catalog and stream whitelist, and Alpaca/Capital/cTrader routes use the same
authenticated backend stream contract. Configured live routes replace static
Frankfurter reference rows; reference rows remain only as a fail-safe when a
live provider is unavailable. Forex display precision defaults to five decimals
for non-JPY pairs and three decimals for JPY pairs, while provider increments
remain authoritative when supplied. Forex rows render currency flags/logos.

This change does not fabricate realtime data: an instrument is shown as live only
when its provider catalog advertises `REALTIME` and the authenticated stream emits
provider events. cTrader token rotation remains atomic and secret-safe, but
persistent secure credential storage is not implemented; automatic refresh across
application restart is explicitly not claimed.
