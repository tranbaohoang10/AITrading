# Chart interaction contract

## Top toolbar Replay

- Accessible name: `Open Bar Replay`.
- Click/Enter/Space opens a viewport-clamped dialog/popover below the trigger.
- Day and Month are the only range modes.
- Start is disabled until selected range and provider coverage are valid.
- Starting opens the existing authenticated simulation; it never places a broker order.

## Left rail Position Setup

- Desktop placement: immediately below `More drawing controls`.
- Accessible name: `Open Position Setup`.
- One panel exposes Long/Short, balance, entry, sizing, SL %, TP % and preview.
- `LOT` is absent or disabled with reason unless instrument metadata is verified.
- Draft edits send zero mutation requests. Confirm is idempotent. Active level drag
  sends one `LEVELS` command on pointer-up.

## Symbol search page

Proposed private API shape (exact endpoint may reuse current provider routes):

```json
{
  "items": [{
    "instrumentId": "COINBASE:BTC-USD",
    "displaySymbol": "BTC/USD",
    "providerSymbol": "BTC-USD",
    "assetClass": "CRYPTO",
    "provider": "COINBASE",
    "exchange": "Coinbase",
    "feed": "PUBLIC",
    "icon": { "kind": "LOCAL", "value": "btc", "source": "CC0" },
    "sizingStatus": "QUANTITY_ONLY"
  }],
  "nextCursor": null
}
```

Query, asset class, provider and cursor are bounded. Server never accepts an
arbitrary upstream URL. Icon responses are SVG/PNG only, capped and nosniff.

## Timeframe and timezone

- Timeframe trigger always shows label plus downward caret; hover/focus has a
  translucent background. Menu reports selected item and disables unsupported EOD intervals.
- Clock click opens a selector below its trigger. Selection updates active chart
  labels without changing stored candle instants.
- Both popovers close on Escape/outside click and restore trigger focus.

## Crosshair

- Pointer inside plot displays both labels in the same frame.
- Price label attaches to right axis using instrument precision.
- Time label attaches to bottom axis using active timezone.
- Labels clamp within axes at all supported viewports; no fabricated candle is used
  when the pointer is in future blank space.
