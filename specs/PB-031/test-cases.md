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

## Manual browser verification

- Compare visual hierarchy with the current public LuxAlgo Quant interface without copying its brand or assets.
- Exercise real synthetic-dataset chart interactions and chat/sidebar navigation.
- Inspect 1920×1080, approximately 1440px, 1024px, and 390px widths.
- Confirm no unnecessary horizontal viewport overflow, clipped primary action, misleading feature claim, or persistent bright accent styling.
