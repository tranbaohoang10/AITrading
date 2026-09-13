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

## Verification status

Local routing, aggregation and provider-isolation tests pass. The real cTrader
smoke test reached the demo Open API but was rejected with
`CH_CLIENT_AUTH_FAILURE` during application authentication on 13/09/2026. No
real cTrader catalog, history or realtime capability is claimed until the
configured app/account entitlement is corrected and the smoke matrix passes.
