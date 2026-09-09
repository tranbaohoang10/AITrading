# PB-038 — Alpaca authenticated QA — 09/09/2026

Status: **BLOCKED_AUTH_FAILED**. Issue #39 remains open. No credential, session
token, request authentication header or secret value was read, printed, logged or
committed.

## Runtime and safety boundary

- Existing backend runtime: `127.0.0.1:8080`, capability endpoint authenticated
  through a disposable local application account and owner-bound workspace header.
- Existing frontend runtime: `127.0.0.1:5173`, browser workspace already signed in.
- QA was read-only market-data work. No order endpoint or broker mutation was used.
- At the QA time, 09/09/2026 approximately 05:14–05:29 America/New_York, the US
  regular session had not opened. Market closure alone does not explain the REST
  authentication failures or the WebSocket reconnect loop.

## Actual provider observations

1. `GET /api/market/providers/capabilities` returned Alpaca/IEX with
   `configured=true`, `historical=true`, `realtime=true`, asset classes STOCK/ETF.
2. Actual catalog requests for AAPL, NVDA, MSFT, TSLA, SPY, QQQ, IWM and DIA all
   returned HTTP 502 with safe code `ALPACA_PROVIDER_UNAVAILABLE` on the running
   pre-fix backend.
3. Actual 5-minute historical requests for AAPL, NVDA, SPY and QQQ over
   01/09/2026–02/09/2026 all returned HTTP 502 with the same safe code.
4. The authenticated application SSE stream connected with HTTP 200, then exposed
   `CONNECTING` and repeated `RECONNECTING` statuses for 22 seconds. It never
   exposed a candle. Therefore Alpaca WebSocket authentication, subscription and
   provider event receipt did not PASS.
5. Browser Symbol Search opened successfully. The Stocks tab truthfully displayed
   `No live instruments available.` No normal symbol row exposed Alpaca/IEX text.
   Actual stock/ETF rows and icons could not be browser-PASSed because catalog data
   was unavailable.

## Corrective implementation

- Alpaca asset catalog now uses the Paper Trading host rather than the live
  trading host.
- REST 401/403 responses map to the explicit safe code `ALPACA_AUTH_FAILED`.
- The IEX WebSocket adapter now emits `AUTHENTICATED` after the provider success
  event and `AUTH_FAILED` after a provider error event, without exposing provider
  messages or credential material.
- UI tests cover local approved AAPL/NVDA/SPY/QQQ icons and prove normal rows omit
  Alpaca/IEX text. Existing stream tests prove disposal aborts the active request,
  prevents late candle delivery and cleans retry timers during symbol/timeframe
  switching.

The backend process that contains the configured credentials is owned by a hidden
launcher. The current shell does not contain those credential variables. It was
not stopped because restarting from this shell would discard the configured
environment. The corrective build is verified but requires the Product Owner to
restart the backend once more with the same credential environment before the
real QA can be rerun.

## Verification

- Backend disposable PostgreSQL full `clean test bootJar dependencyInventory`
  harness: PASS, exit 0, 5m16s; owned database data retained and credential file removed.
- Backend targeted Alpaca test and `bootJar`: PASS, exit 0.
- Alpaca REST/WS/stream tests: PASS, exit 0.
- Frontend Symbol Search/icon/stream/chart isolation tests: 5 files, 14 tests PASS.
- Frontend symbol/timeframe switching and cleanup tests: 3 files, 8 tests PASS.
- `git diff --check`: PASS.

## Required result matrix

| Symbol | Catalog | Icon | Historical | WS Auth | Live Event | Candle Update | Result |
| ------ | ------- | ---- | ---------- | ------- | ---------- | ------------- | ------ |
| AAPL | FAIL — HTTP 502 | BLOCKED_RUNTIME; local icon contract PASS | FAIL — HTTP 502 | FAIL — reconnect loop | BLOCKED_AUTH_FAILED | BLOCKED_AUTH_FAILED | BLOCKED_AUTH_FAILED |
| NVDA | FAIL — HTTP 502 | BLOCKED_RUNTIME; local icon contract PASS | FAIL — HTTP 502 | Not reached independently | BLOCKED_AUTH_FAILED | BLOCKED_AUTH_FAILED | BLOCKED_AUTH_FAILED |
| SPY | FAIL — HTTP 502 | BLOCKED_RUNTIME; local icon contract PASS | FAIL — HTTP 502 | Not reached independently | BLOCKED_AUTH_FAILED | BLOCKED_AUTH_FAILED | BLOCKED_AUTH_FAILED |
| QQQ | FAIL — HTTP 502 | BLOCKED_RUNTIME; local icon contract PASS | FAIL — HTTP 502 | Not reached independently | BLOCKED_AUTH_FAILED | BLOCKED_AUTH_FAILED | BLOCKED_AUTH_FAILED |

## Exact unblock condition

Restart the patched backend with the same intended Alpaca Paper Trading market-data
credentials. The rerun must first show catalog/history success and WS
`AUTHENTICATED`. If authentication passes but no provider trade arrives while the
US market is closed, live-event and candle-update rows must be recorded as
`BLOCKED_MARKET_CLOSED`, never PASS from history, polling or mock data.
