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

## Follow-up result — 04/09/2026

- Direct LuxAlgo Quant reference inspection: PASS. Lines and Text flyouts expose icon-plus-label subtools with a single open flyout; the local UI follows the same density and hierarchy without copying brand assets.
- Local browser pass at 1536×730 with the persisted synthetic `DEMO_USD` dataset: PASS. Verified continuous 100-candle rendering, OHLCV/status placement, time and price axes, horizontal/vertical/diagonal pan, reset, Lines/Fibonacci/Prediction/Shapes/Text flyouts, exclusive menus, trend/horizontal/Fibonacci/Long/Short/Text drawings, semantic time-price anchors, object-tree deletion, undo/redo, RSI insertion and splitter resize, timezone display conversion, chart settings, and dark theme.
- Regression found and repaired during browser QA: incomplete Long/Short drafts no longer crash the chart renderer; completed tools show validated risk/reward metrics.
- Automated quality: focused regression 7 files / 69 tests PASS; full frontend suite 31 files / 227 tests PASS; `npm run lint` PASS; `npm run build` PASS; `git diff --check` PASS.
- Responsive evidence remains covered by the existing PB-031 captures at 1920×1080, 1440×900, 1024×768, and 390×844; the active browser-control surface did not expose a viewport-resize operation for a fresh multi-size capture in this pass.

## Phase A/B chart foundation cases

| ID | Scenario | Expected |
|---|---|---|
| TC-14 | Slow and fast wheel input at different cursor positions | Zoom changes continuously in bounded increments and preserves the cursor time anchor |
| TC-15 | Horizontal, vertical, and diagonal cursor drag | Time and display-price viewports move independently/together without changing OHLCV |
| TC-16 | Reset after manual navigation | Loaded time window and auto-fit price range are restored |
| TC-17 | Zoom/pan/resize/timeframe with drawings | Anchors remain attached to their time/bar and price values |
| TC-18 | Use each enabled grouped tool | Real geometry is created; unsupported advanced tools are disabled and labeled |
| TC-19 | Select and drag drawing handles | Anchors update in chart coordinates and the edit is undoable/redoable |
| TC-20 | Press Delete/Backspace/Escape/Ctrl+Z/Ctrl+Y/0 | Safe chart shortcuts work and never intercept editable controls |
| TC-21 | Resize RSI splitter | Pane height changes within bounds and main chart receives remaining space |
| TC-22 | Change timezone from clock/settings | Both controls stay synchronized; only displayed time changes |
| TC-23 | Empty/one-line/five-line composer | It auto-grows without a scrollbar until the maximum height |
| TC-24 | Inspect 1920, 1440, 1024, and 390 widths | Chart remains dominant with no document overflow or clipped core controls |

## Critical visual/chart correction pass — 04/09/2026

- Zoom continuity: PASS. Existing browser evidence confirmed the real LuxAlgo and local Quant wheel sequence changes the loaded candle window continuously (100 → 84 bars); the implementation keeps the cursor-time anchor and bounds the window without fabricating candles.
- Auto price fit: PASS. Horizontal time navigation remains automatic; only vertical/diagonal drag establishes the explicit manual price viewport, and reset clears it.
- No candle clipping: PASS. The chart derives an internal top inset from the status/indicator rows and reserves pane space before mapping candle highs/lows.
- Status overlay: PASS. Symbol, timeframe, OHLC, change, and volume render inside the SVG canvas with desktop/medium/small priorities.
- Indicator overlay: PASS. RSI browser verification shows a compact vertical in-canvas legend; hover/focus exposes hide, configure, and remove controls without covering the candles.
- Full chart height: PASS. The local chart SVG fills the available chart workspace below the toolbar and rail.
- No wasted chart row: PASS. The former permanent “Synthetic research sample” row is screen-reader-only; dataset provenance and window/delete actions remain in compact popovers.
- Time axis: PASS. Adaptive time labels remain directly on the bottom chart axis, including with the RSI pane.
- Warm neutral theme: PASS. Chart shell, grid, axes, and controls use the neutral charcoal palette; the visual review was compared with the currently open LuxAlgo Quant reference.
- Responsive evidence: PASS via the existing PB-031 captures at 1920×1080, 1440×900, 1024×768, and 390×844. Fresh viewport resizing was unavailable in the active browser-control surface.
- Final automated evidence: full frontend suite 31 files / 227 tests PASS; ESLint PASS; TypeScript/Vite production build PASS; `git diff --check` PASS.
