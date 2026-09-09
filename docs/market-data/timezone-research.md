# Chart timezone research — 08/09/2026

Official reference fetched successfully (HTTP 200): https://www.tradingview.com/charting-library-docs/latest/ui_elements/timezones/

The documented supported list includes the requested major trading cities, with US/Mountain representing the Denver region. AITrading uses America/Denver, the equivalent runtime IANA identity. Chart display timezone and instrument exchange timezone are distinct. No TradingView code/assets are copied.

Implementation uses runtime Intl.DateTimeFormat longOffset for the current instant, not manual DST tables. UTC/Exchange/Local precede city options sorted by current offset then city. Fixed-offset legacy stored values remain readable but are absent from the normal curated list. UTC candle data is never rewritten by a display change.

Current-price clock owns its interval in a memoized SVG child; changing its clock does not set CandleChart parent state. Targeted tests cover New York and London seasons, Mumbai half-hour offset, Ho Chi Minh, midnight preservation and timer cleanup.
