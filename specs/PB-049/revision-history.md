# PB-049 — Revision history

## 11/09/2026 — Initial implementation and real QA

- Added V21 provider M1 persistence and coverage state without duplicating the V20 catalog.
- Added required canonical routes, Dukascopy BI5 decoding, Binance REST pagination and provider-derived availability.
- Corrected Alpaca `bars:null` handling and derived this account's actual earliest IEX M1 per symbol.
- Added deterministic local aggregation and provider dataset materialization.
- Extended the existing Python contract to accept `PROVIDER` while retaining `sourceVerified=false`.
- Added real Binance WebSocket → Redis → SSE → finalized PostgreSQL flow.
- Verified real Binance/Alpaca historical data, all seven backtest timeframes and real BTC/USDT realtime.
- Recorded Dukascopy endpoint failure, closed-market realtime gaps and full-range snapshot limitation without false PASS claims.
