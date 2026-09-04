# PB-035 — Test cases

Issue: #36

| ID | Scenario | Expected result |
| --- | --- | --- |
| TC-01 | Drag plot horizontally, wheel zoom around a cursor, then append a Coinbase candle | Time range changes as requested; manual time view is not reset by realtime. |
| TC-02 | Drag right axis repeatedly in both directions | Price span expands/contracts around a sensible anchor without pinning candles to an edge. |
| TC-03 | Drag plot vertically/diagonally, append a candle, resize chart, move crosshair, then reset | Price range pans and remains MANUAL until Auto/double-click/0; reset returns dynamic margins. |
| TC-04 | Draw trend, channel, fib, rectangle, Price Note and Long Position; pan/zoom/resize | Anchors remain time+price based and visible at the same data locations. |
| TC-05 | Open each rail group and choose a tool | One compact cell per group; icon remembers last-used; one flyout closes on choice/Escape/outside. |
| TC-06 | Inspect Patterns and More | Unsupported patterns are disabled with “Coming later”; Magnet, Stay, Eraser, Lock, Hide and confirmed Remove All are honest. |
| TC-07 | Start capture, create/resize/move selection, Escape/right-click/outside | Plot-bounded dimmed overlay has 8 handles, moves correctly, and leaves no persisted drawing. |
| TC-08 | Capture at DPR 1 and >1 and send to current Assistant | Crop matches selected SVG region; metadata is allow-listed; success uses the existing Assistant or displays exact provider/API unavailable state. |
| TC-09 | Camera full-chart menu | Copy, Save and Assistant actions use the same capture pipeline and never include browser chrome/sidebar. |
| TC-10 | Security and regression | No secrets/DOM/sidebar in payload; Coinbase remains the only production provider; frontend tests/lint/build pass. |

## Execution results

## Execution results — 04/09/2026

- `frontend/npm run build` — PASS (TypeScript + Vite production build; existing chunk-size advisory only).
- `frontend/npm run lint` — PASS.
- `frontend/npx vitest run src/market/liveMarket.test.ts src/market/chartCapture.test.ts --reporter=verbose --no-file-parallelism` — PASS, 2 files / 11 tests.
- Focused `Workspace.test.tsx` + `Market.test.tsx` + `liveMarket.test.ts` — all reported tests PASS after updating the expected last-used tool title; the test runner wrapper did not emit its final summary before its 30-second tool window, so this is recorded as focused evidence rather than a claim of a completed full-suite report.
- `backend/.../gradlew.bat test` — not PASS: the direct run lacked the repository-owned disposable database and failed precondition assertions (`...was: null`). The official `scripts/test_backend.py` created and stopped its owned PostgreSQL cluster correctly but stopped at Gradle `clean` because an existing Java process held `backend/build/libs/api-0.0.1-SNAPSHOT.jar`; no user data was touched or deleted.
- Backend provider unit reports after the attachment changes: `OpenAiProviderTests` 12/12 PASS and `GeminiProviderTests` 12/12 PASS, including PNG attachment payload assertions. `compileJava` completed without compiler errors.
- Browser QA: Chrome local Quant tab at `http://127.0.0.1:5173/`, live Coinbase BTC-USD 1m chart, desktop viewport approximately 1536×768. Confirmed topbar clusters, 10 compact rail groups, Lines & Channels additions, Price Note, disabled pattern placeholders, More utilities and Camera full-chart actions. The app reported AI ready through the local configured test provider. Real pointer QA verified selection drag, 8-handle resize, move, Escape cleanup while the prompt input was focused, and right-click cleanup. Send-to-Assistant was not submitted during QA because it would create/transmit a chat message; the bridge and provider contract are covered by automated tests.
- The same browser session verified Alt+T, Alt+H and Alt+V select the expected line tool and update the grouped main icon/title.
- Browser chart navigation verification: wheel zoom changed the visible window from 305 to 251 candles; horizontal plot drag changed the time range to `1–251 / 305`; right-axis drag exposed `Auto-fit price scale`; clicking Reset returned the viewport to `1–305 / 305` and removed manual price mode.
- No Binance/OANDA/FXCM path was added. No secrets, sidebar or browser chrome are included in capture payload design. No source code/assets were copied from LuxAlgo or official documentation.
- `python scripts/verify_readiness.py` — blocked by a pre-existing migration-ledger mismatch for clean `V10__mql5_exports.sql` in the working tree; the new V18 name/hash is present in the ledger and no existing migration was edited.
