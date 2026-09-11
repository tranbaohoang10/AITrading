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
