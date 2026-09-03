# PB-031 — Frontend test cases

## Automated

| ID | Scenario | Expected |
|---|---|---|
| TC-01 | Aggregate a 1-minute sequence into 5-minute UTC buckets | OHLCV uses first/max/min/last/sum deterministically and retains gaps without fabrication |
| TC-02 | Request lower or non-divisible timeframe | Selection is unavailable and no synthetic lower candles are produced |
| TC-03 | Calculate SMA, EMA, and RSI on known closes | Deterministic values and warm-up gaps match documented formula behavior |
| TC-04 | Open/close expanded navigation and choose destinations | Existing workspace/chat routes activate without destroying providers |
| TC-05 | Use icon-only workspace controls | Buttons expose accessible names, pressed state, and keyboard focus |
| TC-06 | Change chart type/settings/indicators | Real SVG output changes and unsupported enriched modes remain disabled |
| TC-07 | Draw, select, delete, undo, redo, and clear | Local drawing state responds without API or persistence calls |
| TC-08 | Open layout and camera menus | Single layout is active; future layouts and send-to-chat are disabled; PNG/copy remain available |
| TC-09 | Existing frontend regression suite | All existing behavior remains passing |
| TC-10 | Inspect the permanent rail | Only the Q trigger remains; real destinations and account stay available in the drawer |
| TC-11 | Add, hide/show, and remove multiple indicators | A vertical in-chart legend reflects active configuration and chart visibility |
| TC-12 | Draw ray, vertical line, rectangle, and arrow | Each creates real selectable SVG geometry and participates in undo/delete history |
| TC-13 | Wheel zoom, drag pan, keyboard pan/zoom/reset | Viewport changes only within loaded candles and restores deterministically |

## Manual browser verification

- Compare visual hierarchy with the current public LuxAlgo Quant interface without copying its brand or assets.
- Exercise real synthetic-dataset chart interactions and chat/sidebar navigation.
- Inspect 1920×1080, approximately 1440px, 1024px, and 390px widths.
- Confirm no unnecessary horizontal viewport overflow, clipped primary action, misleading feature claim, or persistent bright accent styling.

## Follow-up result — 03/09/2026

- Automated frontend suite: 31 files / 227 tests PASS.
- ESLint: PASS.
- TypeScript and Vite production build: PASS.
- Runtime visual review: PASS at 1920×1080, 1440×900, 1024×768, and 390×844.
- Document width matched viewport width at every reviewed size; the desktop rail exposed only the Q trigger.
- Advanced parallel-channel drawing and send-to-chat export remain visibly disabled because this iteration does not provide complete implementations.
