# PB-048 — Symbol catalog multi-provider

Issue: #48

## Goal

Provide a durable, searchable catalog for STOCK, ETF, FOREX and COMMODITY while
preserving existing crypto, historical and realtime provider routes. A failed or
disabled external provider must not empty the selector.

## Use case

An authenticated trader opens Symbol Search, filters or searches instruments and
selects a route supported by the current application. The backend serves one
normalized PostgreSQL catalog instead of making the browser fan out to providers.

## Acceptance criteria

- AC1: Real STOCK, ETF, FOREX and COMMODITY rows are normalized and persisted.
- AC2: Identity never uses ticker alone; same ticker on different exchanges remains distinct.
- AC3: Aliases support compact and delimited FX/commodity searches.
- AC4: Provider refresh is isolated and last-known-good survives failures.
- AC5: Search supports asset class, query, exchange, country, active and bounded pagination.
- AC6: Optional credentials remain backend-only and a missing key disables that provider cleanly.
- AC7: The frontend uses the unified endpoint with debounce and truthful loading/error/empty states.
- AC8: Existing provider catalog/history/realtime endpoints remain compatible.
- AC9: Empty-query browsing is curated and balanced; reference-only and low-value
  bulk rows never crowd the chart selector. Typed search is constrained to the
  same approved product universe; provider/repository catalogs only enrich those
  symbols and never expand the selector implicitly.

## Security

Fixed outbound hosts, bounded payloads and row counts, timeouts, strict normalized
fields, parameterized SQL and bounded cursors. Secrets are never included in URLs,
responses, logs, evidence or source.

## Exclusions

No TradingView cookie ingestion, paid entitlement bypass, Python service, live
order placement, or semantic merging of spot commodities, futures and ETF proxies.

## Definition of done

Migration, implementation, automated tests, browser QA and append-only evidence
pass; the main branch is committed and pushed with `Refs #48`.
