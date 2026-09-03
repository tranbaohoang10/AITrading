# PB-030 — Frontend test cases

| ID | Evidence | Expected | Status |
| --- | --- | --- | --- |
| TC-01 | Authenticated synthetic Quant account beside current public LuxAlgo Quant | Original Quant design with comparable hierarchy, density and chart focus | PASS — visual comparison completed 03/09/2026 |
| TC-02 | `desktop-1920.png`; avatar and shell component tests | No large header Backtest CTA; subtle Private pill; avatar opens Account | PASS |
| TC-03 | `desktop-1920-chat-menu.png`; `AiChat`/`Conversations` tests | Compact actions; direct new-chat typing; voice shell; existing history/menu behavior preserved | PASS |
| TC-04 | `desktop-1440-export.png`; real PNG action; workspace tests | Icon-first rail/tooltips; export menu honest; supported actions work without backend changes | PASS |
| TC-05 | Synthetic 96-candle import rendered in real app; full frontend regression | Existing functionality preserved in compact controls | PASS |
| TC-06 | `test-evidence/*.png` plus automated layout/overflow metrics | Correct layouts at 1920×1080, 1440×900, 1024×768 and 390×844; no horizontal overflow | PASS |
| TC-07 | `npm test`; `npm run lint`; `npm run build`; `git diff --check` | All pass; frontend/spec scope only; no secrets/contracts/business logic changed | PASS locally; publication pending |
