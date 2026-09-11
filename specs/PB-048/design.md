# PB-048 — Design

## Flow

```mermaid
sequenceDiagram
  participant S as Scheduled sync
  participant P as Catalog provider
  participant D as PostgreSQL
  participant A as Unified API
  participant U as Symbol Search
  S->>P: bounded fixed-host fetch
  P-->>S: normalized snapshot
  S->>D: transactional provider upsert
  Note over S,D: failure updates sync state only; LKG rows remain
  U->>A: query + filters + cursor
  A->>D: parameterized bounded search
  D-->>A: canonical instruments + preferred route
  A-->>U: one page
```

## Data model

- `market_instrument`: canonical identity and descriptive metadata.
- `instrument_provider_mapping`: provider route/reference symbol and capabilities.
- `instrument_alias`: normalized search aliases.
- `instrument_catalog_sync`: provider health, counts and last successful refresh.

Stable identifiers such as ISIN are preferred. Otherwise canonical identity is
asset class + normalized exchange/MIC + symbol. Provider symbols remain mappings.

## Provider order

1. Twelve Data reference metadata when configured.
2. Existing entitled/configured market routes (Alpaca, OANDA, cTrader, etc.).
3. Free Ticker Database for global STOCK/ETF reference fallback.
4. Frankfurter official daily reference catalog for FOREX/metals.

Rows with executable chart modes are preferred over reference-only mappings. A
reference-only row is visible but not selectable until a compatible route exists.

## Recovery

Each provider snapshot is committed independently. Empty/invalid snapshots and
network failures never deactivate the previous successful snapshot. Subsequent
successful snapshots replace only that provider's active mappings.
