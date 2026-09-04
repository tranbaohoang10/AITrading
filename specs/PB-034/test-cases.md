# PB-034 — Test cases

Issue: #35

| ID | AC | Scenario | Expected result |
| --- | --- | --- | --- |
| TC-01 | AC-01–03 | Parse Coinbase REST rows, direct and derived timeframes | Neutral domain values are valid, chronological and deduplicated; 30m/4h aggregate only in provider. |
| TC-02 | AC-04 | Feed same/new-bucket public match events | Same UTC bucket updates O/H/L/C/V; later bucket finalizes one prior candle and appends one new candle. |
| TC-03 | AC-04 | Close/reconnect and change symbol/timeframe | Backoff is bounded, old timer/socket is cleaned, stale subscription cannot render a new selection. |
| TC-04 | AC-05 | Hover bullish/bearish historical candle and leave chart | Header OHLC/change/volume follow inspected candle, direction color is correct, leave returns latest. |
| TC-05 | AC-06 | Drag/double-click price axis and append candle | Manual scale appears, double-click clears it, appended candle does not reset a manual historical viewport. |
| TC-06 | AC-07 | Inspect compact toolbar and toolbar order | Eight primary groups only; More contains operational actions and confirmation is required for remove-all. |
| TC-07 | All | Lint, test, TypeScript/Vite build and public REST smoke | Commands exit 0; public sample is read-only and no secret is present. |

## Security applicability

Malformed external payload rejection, product filtering, bounded requests and socket cleanup are covered in unit tests. The feature adds no user mutation, private exchange credential, persistence, authorization, upload, SQL or AI execution boundary; the associated attacks are N/A.

## Execution results — 04/09/2026

| ID | Result | Evidence |
| --- | --- | --- |
| TC-01 | PASS | `liveMarket.test.ts` maps Coinbase `[time, low, high, open, close, volume]`, orders/deduplicates and aggregates 30m. |
| TC-02 | PASS | Public `match` fixtures prove current-bucket O/H/L/C/V update, prior-bucket finalization and single later-bucket append. |
| TC-03 | PASS | Tests cover bounded reconnect, status transition, socket cleanup and BTC-USD/ETH-USD + 1m/5m selection cleanup. |
| TC-04 | PASS | Deterministic SVG hover test confirms bearish/bullish header values, direction-colored volume and mouse-leave latest restoration. |
| TC-05 | PASS | Deterministic SVG test proves axis manual range survives realtime append and double-click resets autoscale. |
| TC-06 | PASS | DOM tests verify eight compact primary controls, last-used selection and the remove-all confirmation. |
| TC-07 | PASS | Frontend Vitest, ESLint and TypeScript/Vite production build pass. A read-only Coinbase REST call returned current BTC-USD 1m rows. |
| Browser QA | PASS | Real local app browser: BTC-USD/1m showed `COINBASE · LIVE`, live header and compact rail; switched ETH-USD then 30m and observed valid live historical chart/header. Current LuxAlgo Quant browser was inspected only as interaction/layout reference; no assets or source were copied. |

Commands:

- `npm test -- --run --reporter=dot --no-file-parallelism` — exit 0.
- `npm run lint` — exit 0.
- `npm run build` — exit 0; Vite emitted only the existing advisory about a minified chunk over 500 kB.
- Read-only `GET https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60` — returned current valid Coinbase OHLCV arrays without a credential.
