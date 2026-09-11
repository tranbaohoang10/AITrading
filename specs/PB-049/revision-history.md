# PB-049 — Revision history

## 11/09/2026 — Initial multi-provider implementation

- Added V21 provider M1 persistence, coverage state and deterministic historical aggregation.
- Added Binance/Alpaca/Dukascopy integration evidence and recorded external limitations without false PASS claims.

## 11/09/2026 — Capital historical/realtime correction

- Replaced Forex/metals primary routing with explicit Capital.com Demo mappings.
- Enforced Capital REST M1 as the historical base and local aggregation for all larger closed timeframes.
- Added direct quote aggregation into current M1/M5/M15/M30/H1/H4/D1 on every quote.
- Added seven-frame Redis state, SSE publication and finalized M1 persistence.
- Fixed live-only history cache suppression and the commodity single-candle browser failure.
- Added overlapping local country flags for Forex pairs.
- Added V22 and raised the immutable dataset ceiling from 5,000 to 20,000 candles.
- Verified real GOLD multi-timeframe history, real EUR/USD realtime, browser H1 joining and regression gates.
- Kept the overall Issue status partial until every original non-Capital blocker is resolved.
