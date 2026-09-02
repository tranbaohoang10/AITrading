# PB-025 actual browser evidence — Refs #27

Date: 02/09/2026 Asia/Ho_Chi_Minh. Codex in-app browser, actual Vite UI at
`127.0.0.1:5173`, actual loopback API/PostgreSQL; no route interception or mock.
Only the synthetic `pb025-browser@example.test` account was used.

| Check | Actual | Result |
| --- | --- | --- |
| Sign-in and chat | Created conversation and saved `PB025 browser synthetic note only; no real trading data.` | PASS |
| Provider unavailable | Check AI availability rendered `AI is not configured on the server.`; Ask AI remained disabled | PASS |
| Desktop layout | 1280×720; document client/scroll width both 1280 | PASS |
| Restart error | Reload during owned JVM restart rendered `Workspace unavailable` and bounded `Retry connection` | PASS |
| Restart recovery | Retry restored authenticated workspace, conversation list and exact saved message | PASS |
| Mobile layout | 390×844; client/scroll width both 390 | PASS |
| Mobile navigation | Dialog exposed all workspace/platform destinations; AI Chat reopened the persisted message | PASS |
| Cleanup | Signed out through UI; viewport override reset; agent-created test tab closed | PASS |

The browser restart was a second observed down/up on the same owned harness after
the CLI journey's restart. No Product Owner account, password, browser storage,
TradingView tab, private data or external target was read or modified.
