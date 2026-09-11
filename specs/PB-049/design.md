# PB-049 — Design

## Historical sequence

```mermaid
sequenceDiagram
  participant UI as React chart
  participant API as MarketProviderRuntimeController
  participant S as MarketHistoricalSyncService
  participant C as Capital REST
  participant DB as PostgreSQL M1 store
  participant A as MarketTimeframeAggregator
  UI->>API: history(symbol, timeframe, from, to)
  API->>S: bounded idempotent sync
  S->>C: GET prices resolution=MINUTE
  C-->>S: validated real M1 or typed empty gap/failure
  S->>DB: upsert closed M1 + coverage
  API->>DB: read stored M1 range
  API->>A: aggregate requested UTC timeframe
  A-->>API: closed M1/M5/M15/M30/H1/H4/D1 candles
  API-->>UI: normalized closed history
```

Historical code never requests Capital M5/H1/H4 data. M1 is the canonical
historical source and every larger closed candle is derived deterministically.

## Realtime sequence

```mermaid
sequenceDiagram
  participant C as Capital WebSocket
  participant S as CapitalStreamProvider
  participant A as RealtimeTimeframeAggregator
  participant R as Redis
  participant DB as PostgreSQL M1 store
  participant SSE as Same-origin SSE
  participant UI as React chart
  C-->>S: quote(eventId, time, bid, offer)
  S->>A: accept quote immediately
  A-->>S: current map for seven frames + optional finalized M1
  par hot state
    S->>R: current M1/M5/M15/M30/H1/H4/D1
  and client update
    S-->>SSE: requested current candle
    SSE-->>UI: validated live candle
  end
  opt M1 boundary crossed
    S->>DB: upsert finalized M1 only
  end
```

The realtime path does not call the historical aggregator and does not wait for
M1 close. Every accepted quote independently selects all seven UTC buckets and
updates their open/high/low/close values in the same synchronized operation.

## Chart join

```mermaid
flowchart LR
  H[Closed historical candles] --> M[Merge by openTime]
  L[Current live candle] --> M
  M -->|same bucket| R[Replace final displayed bucket]
  M -->|next bucket| A[Append one current bucket]
  R --> C[Chart]
  A --> C
```

Live-only `closed=false` candles do not satisfy historical cache coverage. The
chart therefore loads closed history first and then replaces/appends the current
live bucket, preventing the former commodity one-candle failure.

## Main classes

```mermaid
classDiagram
  class CapitalMarketDataClient
  class MarketHistoricalSyncService
  class MarketProviderCandleStore
  class MarketTimeframeAggregator
  class CapitalStreamProvider
  class RealtimeTimeframeAggregator
  class MarketLiveStateStore
  class MarketProviderRuntimeController
  CapitalMarketDataClient ..|> HistoricalSourceTimeframeProvider
  MarketHistoricalSyncService --> CapitalMarketDataClient
  MarketHistoricalSyncService --> MarketProviderCandleStore
  MarketProviderCandleStore --> MarketTimeframeAggregator
  MarketProviderRuntimeController --> MarketHistoricalSyncService
  CapitalStreamProvider --> RealtimeTimeframeAggregator
  CapitalStreamProvider --> MarketLiveStateStore
  CapitalStreamProvider --> MarketProviderCandleStore
```

## Data impact

- V21 stores durable provider M1 and sync coverage.
- V22 raises the immutable backtest dataset candle constraint to 20,000.
- Redis keys use `aitrading:v2:market:CAPITAL:<SYMBOL>:<FRAME>:current` for all seven frames.
- Redis is an expiring hot projection; PostgreSQL remains the durable historical source.

## UI impact

- Capital history uses `/api/market/local/history`; Capital live uses `/api/market/stream`.
- Historical timeout is bounded at 120 seconds in the provider and 60 seconds in the chart load guard.
- Forex pairs render two overlapping locally authored country flags.
- Commodity symbols retain local asset icons.
- No frontend code contains or transmits Capital credentials.

## Dependency decision

No new dependency is required for the Capital extension. Existing provider and
serialization libraries are reused; the dependency inventory remains locked.
