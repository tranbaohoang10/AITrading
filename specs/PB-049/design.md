# PB-049 — Design

## Historical sequence

```mermaid
sequenceDiagram
  participant UI as React chart
  participant API as Spring market API
  participant R as Symbol registry
  participant P as Alpaca/Binance/Dukascopy
  participant DB as PostgreSQL M1 store
  participant B as Existing backtest engine
  UI->>API: local history(symbol, timeframe, range)
  API->>R: resolve canonical route
  API->>DB: read persisted M1 range
  alt range missing
    API->>P: bounded provider M1 sync
    P-->>API: validated real candles or typed failure
    API->>DB: idempotent M1 upsert + coverage state
  end
  DB-->>API: M1 rows
  API->>API: aggregate requested UTC timeframe
  API-->>UI: normalized candles
  API->>DB: materialize immutable PROVIDER dataset
  DB-->>B: local snapshot only
  B-->>API: deterministic result + provenance hash
```

## Realtime sequence

```mermaid
sequenceDiagram
  participant BN as Binance aggTrade WS
  participant S as BinanceStreamProvider
  participant C as CurrentM1CandleBuilder
  participant R as Redis
  participant DB as PostgreSQL
  participant SSE as Same-origin SSE
  participant UI as React chart
  BN-->>S: real aggregate trade
  S->>C: id, event time, price, quantity
  C-->>S: accepted current M1 + optional finalized M1
  S->>R: latest quote + current M1 + LIVE status
  opt minute rollover
    S->>DB: upsert finalized M1
  end
  S-->>SSE: normalized candle/status event
  SSE-->>UI: validated partial candle
```

## Main classes

```mermaid
classDiagram
  class MarketSymbolRegistry
  class MarketHistoricalSyncService
  class MarketProviderCandleStore
  class MarketTimeframeAggregator
  class ProviderDatasetMaterializer
  class AlpacaHistoryProvider
  class BinanceArchiveProvider
  class DukascopyHistoryProvider
  class BinanceStreamProvider
  class CurrentM1CandleBuilder
  class MarketLiveStateStore
  MarketHistoricalSyncService --> MarketSymbolRegistry
  MarketHistoricalSyncService --> MarketProviderCandleStore
  MarketHistoricalSyncService --> AlpacaHistoryProvider
  MarketHistoricalSyncService --> BinanceArchiveProvider
  MarketHistoricalSyncService --> DukascopyHistoryProvider
  MarketProviderCandleStore --> MarketTimeframeAggregator
  ProviderDatasetMaterializer --> MarketProviderCandleStore
  BinanceStreamProvider --> CurrentM1CandleBuilder
  BinanceStreamProvider --> MarketLiveStateStore
  BinanceStreamProvider --> MarketProviderCandleStore
```

## Data / ERD impact

```mermaid
erDiagram
  MARKET_INSTRUMENT ||--o{ PROVIDER_MARKET_CANDLE : owns
  MARKET_INSTRUMENT ||--o{ PROVIDER_MARKET_SYNC_STATE : tracks
  MARKET_DATASET ||--o{ MARKET_CANDLE : snapshots
  PROVIDER_MARKET_CANDLE {
    uuid instrument_id PK
    varchar timeframe PK
    timestamptz open_time PK
    numeric open
    numeric high
    numeric low
    numeric close
    numeric volume
    varchar provider
  }
  PROVIDER_MARKET_SYNC_STATE {
    uuid instrument_id PK
    varchar provider PK
    varchar timeframe PK
    timestamptz historical_available_from
    timestamptz synced_through
    varchar status
    varchar error_code
  }
```

Flyway V21 reuses V20 `market_instrument` and permits `PROVIDER` in the existing
immutable backtest dataset table. Redis remains an expiring hot-state projection,
not the durable history source.

## UI impact

- Binance and Dukascopy history use `/api/market/local/history`.
- Binance live uses the existing authenticated `/api/market/stream` SSE contract.
- Provider frames are validated for provider, symbol, timeframe, UTC bucket and OHLC fields before chart mutation.
- Unsupported/unverified realtime remains non-LIVE; no browser-side provider key or direct provider request is added.

## Dependency decision

`org.tukaani:xz:1.10` is required to decode Dukascopy BI5 LZMA payloads. It is a
small maintained Java library under the public-domain-compatible XZ for Java
licensing model, locked in `gradle.lockfile`; no new service or framework is added.
