# PB-049 — Durable multi-asset market data

Issue: #49

## Goal

Use the existing Spring Boot market abstractions to ingest real STOCK, ETF,
CRYPTO, FOREX and COMMODITY data, retain provider historical M1 in PostgreSQL,
derive deterministic higher historical timeframes, and publish live provider
quotes through Redis and same-origin SSE without exposing provider credentials.

## Historical and realtime invariants

Historical and realtime aggregation are separate pipelines:

- Historical: Capital REST M1 -> PostgreSQL -> deterministic M1/M5/M15/M30/H1/H4/D1 aggregation.
- Realtime: Capital WebSocket quote -> `RealtimeTimeframeAggregator` -> current M1/M5/M15/M30/H1/H4/D1 in Redis -> SSE -> React.
- A realtime quote must update all seven current candles immediately. It must not wait for M1 close before changing a larger timeframe.
- Only finalized M1 is written durably by the realtime stream. Historical higher timeframes remain deterministic projections of stored M1.
- A chart combines closed historical candles with the current live candle by bucket time, replacing an equal bucket and appending the next bucket without duplicate or gap.

## Use case

An authenticated trader selects a supported instrument. The backend resolves the
canonical provider route, synchronizes a bounded historical M1 range when needed,
serves locally aggregated history, and subscribes to a server-side live stream.
The browser never receives Capital, Alpaca or other provider credentials and never
calls those providers directly.

## Acceptance criteria

- AC1: Canonical mappings resolve the required symbol universe without provider symbols leaking into business logic.
- AC2: PostgreSQL provider M1 upsert is idempotent and coverage remains durable.
- AC3: Capital historical requests use M1 only; M5/M15/M30/H1/H4/D1 are aggregated locally at UTC boundaries.
- AC4: Historical synchronization runs before a history read even when a live-only M1 candle already exists.
- AC5: A valid Capital quote immediately updates current M1/M5/M15/M30/H1/H4/D1 from the same MID price.
- AC6: Larger realtime candles are not finalized before their own boundary and do not depend on M1 finalization.
- AC7: Redis stores separate current keys for all seven timeframes and SSE publishes the requested current candle.
- AC8: Finalized realtime M1 persists to PostgreSQL; gaps are not fabricated.
- AC9: History plus the current live candle merges by bucket with no duplicate or discontinuity at the join.
- AC10: Real GOLD history returns multiple closed candles at all seven timeframes, not one live-only candle.
- AC11: Forex symbols use locally authored overlapping country flags and commodities retain asset icons.
- AC12: The immutable provider dataset and Python worker accept at least 10,000 candles while retaining a hard 20,000-candle limit.
- AC13: Missing credentials, provider errors, weekend empty windows and Redis failures degrade truthfully without secret leakage.
- AC14: Backend, frontend, Python, readiness, dependency and security gates pass.

## Security requirements

- Provider REST and WebSocket hosts are fixed; user input cannot select an arbitrary URL.
- Symbols, timeframes, ranges, page counts, payload sizes and Redis tokens are bounded.
- SQL remains parameterized and unique instrument/timeframe/open-time keys prevent replay inflation.
- Credentials stay environment-backed and never enter URLs, Redis, PostgreSQL, logs, evidence or frontend code.
- Malformed provider payloads, invalid OHLC, duplicate IDs and out-of-order quotes fail closed.
- No live order, broker mutation, arbitrary script or untrusted generated code is executed.

## Truthful limitations

- Capital instruments are CFDs with provider MID prices; they are not claimed as spot, futures or centralized-volume feeds.
- Historical availability is asserted from the verified Capital baseline `2024-01-03T00:00:00Z`, not from 2017.
- No synthetic gap filling, fake tick, cross-provider candle merge or silent provider substitution is allowed.
- The overall Issue remains partial while original non-Capital full-range and independently requested provider-live evidence is incomplete.

## Definition of done

The Capital historical/realtime correction is complete only when real M1 history,
all seven historical projections, immediate seven-timeframe quote aggregation,
Redis, SSE, finalized M1 persistence and browser history/live joining are evidenced.
Issue #49 remains open unless every original Issue blocker is also resolved.
