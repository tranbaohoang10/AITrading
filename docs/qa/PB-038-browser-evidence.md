# PB-038 browser evidence

Date: 04/09/2026 (Asia/Ho_Chi_Minh)
Surface: Chrome via Codex CUA, `http://127.0.0.1:5173/`
Provider state: Coinbase public feed; no Alpaca credentials configured.

## Observed flows

- Initial chart loaded real Coinbase candles and displayed `COINBASE · PUBLIC · LIVE`.
- Symbol Search opened with configured-provider guidance, category tabs derived from available instruments and bounded search. With the fail-closed Alpaca state, only `All` and `Cryptos` were presented. Query `ETH` returned `ETH-USD` with Coinbase/public feed metadata; selecting it updated the active chart.
- Indicators opened as a library with Favorites, My Indicators, Built-ins, AI Quant and AITrading Community sections. Built-ins included SMA, EMA, WMA, BB, VWAP, RSI, MACD, ATR, STOCHASTIC, CCI and OBV. Stochastic was added and then removed.
- Settings exposed UTC, Exchange, Local and IANA timezone choices, spacing, price increment and precision. Local was selected once without chart failure, then UTC was restored.
- Layout menu exposed `1`, `2H`, `2V`, `4` and `8`; 2H/4/8 rendered the expected cell counts and directional splitters. The final layout was restored to `1`.
- Right-clicking the chart opened a chart context menu containing `Go to realtime`, `Undo drawing`, `Redo drawing` and `Chart settings`; Escape dismissed it.

## Limits

This evidence covers the available desktop browser surface. The CUA session did
not provide a reliable tablet/mobile viewport-resize control, so those responsive
checks remain unverified. It also does not substitute for an Alpaca real request:
the server remained fail-closed without `ALPACA_API_KEY_ID` and
`ALPACA_API_SECRET_KEY`.

## Follow-up evidence — 05/09/2026 (Asia/Ho_Chi_Minh)

- Chrome first showed the original failure mode: direct public Coinbase candle URLs were blocked by the local browser extension with `ERR_BLOCKED_BY_CLIENT`.
- After signing in on the permitted local origin, the same workspace loaded BTC/USD 1m through the authenticated same-origin proxy and showed 301 loaded candles, a live price, and `COINBASE · PUBLIC · LIVE`.
- The toolbar screenshot showed `Indicators ^` on one horizontal row. The picker stayed multi-select capable: SMA was added, then RSI was added, and both remained visible in the chart's active indicators.
- WebSocket fallback behavior is covered by the provider test; when no open event arrives within five seconds, the provider polls the same-origin series endpoint and reports `DELAYED`.
