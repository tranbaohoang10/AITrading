# PB-049 — Tasks

- [x] T1 Preserve canonical provider abstractions and existing Binance/Alpaca behavior.
- [x] T2 Add explicit Capital mappings for seven Forex and four metals/commodities symbols.
- [x] T3 Use Capital REST M1 as the only Capital historical source timeframe.
- [x] T4 Persist Capital M1 idempotently and aggregate all historical timeframes locally.
- [x] T5 Add direct quote-to-seven-timeframe `RealtimeTimeframeAggregator` behavior.
- [x] T6 Write seven Redis current candles and publish requested candles through SSE.
- [x] T7 Persist only finalized realtime M1 and preserve real provider gaps.
- [x] T8 Prevent live-only cache entries from suppressing historical chart loads.
- [x] T9 Merge closed history with the current live candle without duplicate/gap.
- [x] T10 Add overlapping Forex country flags and retain commodity icons.
- [x] T11 Raise the immutable dataset limit to 20,000 and add Flyway V22.
- [x] T12 Verify real Capital historical, realtime, Redis, SSE and browser behavior.
- [x] T13 Run regression, readiness, dependency and security gates.
- [x] T14 Deduplicate unified Forex catalog routes and prefer Capital realtime.
- [x] T15 Receive real live candles in five independent Forex checks.
- [ ] T16 Resolve any remaining original Issue #49 blockers before closing the Issue.
