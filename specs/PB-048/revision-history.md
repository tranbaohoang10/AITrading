# PB-048 — Revision history

## 10/09/2026 — Initial architecture

- Confirmed the browser currently fans out provider catalog requests.
- Confirmed catalog caching is five-minute memory/Redis only with no durable LKG.
- Selected PostgreSQL canonical instruments, provider mappings, aliases and sync state.
- Selected Free Ticker Database and Frankfurter as free-first sources; Twelve Data is optional.

## 11/09/2026 — Implementation and verification

- Added V20 normalized instrument, provider mapping, alias and sync-state tables.
- Added transactional provider snapshots, isolated retry/backoff and last-known-good behavior.
- Fixed full Free Ticker ingestion by replacing a Cartesian reconciliation update with indexed joins.
- Bounded long provider names so one valid symbol with oversized metadata cannot invalidate an entire snapshot.
- Treated Frankfurter `end_date` as source freshness with a seven-day weekend-safe window instead of currency expiry.
- Added exact-match and featured cross-asset ranking, USD preference and routed-row priority for Symbol Search.
- Verified real ingest, authenticated API searches and Chromium browser behavior without exposing credentials.
## 11/09/2026 — Product Owner catalog curation refinement

- Reopened Issue #48 after the completed ingestion exposed too many bulk and
  reference-only rows in Symbol Search.
- Preserve the normalized PostgreSQL catalog for metadata enrichment and
  last-known-good operation, but require a compatible chart route in selector
  API results.
- Curate empty-query Crypto, Stocks, ETFs, Forex and Commodities independently;
  typed search initially remained available for supported non-featured instruments.

## 11/09/2026 — Product Owner strict approved-universe refinement

- Constrained both ingestion and typed search to the approved cross-asset product
  universe rather than treating every provider-supported symbol as user-visible.
- Kept reference repositories as metadata enrichment only; they cannot create a
  new selector symbol unless that symbol is explicitly approved and routed.
- Added route-driven cleanup for stale reference mappings so last-known-good
  metadata survives only while its approved chart route remains active.
