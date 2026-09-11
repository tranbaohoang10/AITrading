# PB-049 — Durable multi-asset M1 market data

Issue: #49

## Goal

Use the existing Spring Boot market abstractions to ingest real STOCK, ETF,
CRYPTO, FOREX and COMMODITY data into one canonical M1 store, derive larger UTC
timeframes locally, feed the existing deterministic backtest engine from
PostgreSQL and publish real provider events through Redis and application SSE.

## Use case

An authenticated trader selects a supported instrument. The backend resolves the
canonical instrument and provider mapping, serves locally persisted history,
syncs missing bounded ranges from the provider, and subscribes to a server-side
live stream where supported. The browser never receives provider credentials and
never calls Alpaca, Binance or Dukascopy directly.

## Acceptance criteria

- AC1: The required 19-symbol universe resolves through the V20 canonical catalog.
- AC2: PostgreSQL stores only provider M1 candles with idempotent instrument/time upsert and durable coverage state.
- AC3: M5, M15, M30, H1, H4 and D1 are derived deterministically from local M1 at UTC boundaries.
- AC4: Historical availability is provider-derived when possible; effective start is `max(2017-01-01, availableFrom)`.
- AC5: Alpaca IEX, Binance public REST and Dukascopy BID BI5 requests are bounded, fixed-host and truthfully classified.
- AC6: Closed provider candles can be materialized into the existing dataset contract with canonical OHLCV hashes.
- AC7: The existing Python worker accepts `PROVIDER` datasets, performs no network access in its inner loop and remains deterministic.
- AC8: Binance `aggTrade` events build the current M1, update real Redis, publish SSE and persist only finalized M1 candles.
- AC9: Missing optional credentials or Twelve Data configuration does not prevent startup or leak secrets.
- AC10: Frontend history and streaming use same-origin backend APIs and validate every returned frame.
- AC11: Real PostgreSQL, Redis, provider, backtest and stream evidence is recorded per symbol without fake PASS claims.

## Security requirements

- Provider hosts and WebSocket endpoints are constants; user input cannot select an arbitrary URL.
- Symbols, timeframes, ranges, page counts, body sizes, BI5 expansion and Redis key tokens are bounded.
- SQL is parameterized; M1 uniqueness prevents duplicate persistence and replay inflation.
- Credentials remain environment-backed and are never written to URLs, Redis, PostgreSQL, logs or evidence.
- Malformed provider payloads fail closed; Alpaca's documented `bars:null` is represented as an empty range.
- No live orders, broker mutations, arbitrary scripts or untrusted generated code are executed.

## Exclusions and truthful limitations

- No public Dukascopy realtime implementation is claimed.
- No full 2017-to-present M1 backfill is claimed; the existing immutable backtest snapshot contract is capped at 5,000 candles.
- No synthetic gap filling, fake ticks, cross-provider candle merging or silent provider substitution.
- No guarantee of redistribution/display rights beyond configured account entitlement and existing provider audit.

## Definition of done

Implementation, migration, test Markdown, real provider probes and regression
gates are committed and pushed on `main` with `Refs #49`. Issue #49 remains open
while required Dukascopy access, non-BTC live verification and full-range backtest
requirements remain incomplete.
