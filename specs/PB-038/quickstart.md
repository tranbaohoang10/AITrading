# Validation quickstart — planned Chart refinement

This guide defines completion evidence for the future implementation pass.

## Automated checks

```powershell
npm --prefix frontend test -- --run
npm --prefix frontend run lint
npm --prefix frontend run build
python scripts/test_backend.py
python scripts/verify_readiness.py
```

Expected: all commands exit 0; no existing Chart/Replay/security regression;
provider/lot/icon negative tests pass.

## Browser scenarios

Run each at 1440, 1024 and 390 CSS pixels:

1. Open Chart. Confirm Replay is in the top toolbar and no detached bottom-right
   Replay button remains. Select Day, then Month; verify exact UTC range and coverage.
2. Click Position Setup below `…`. Select Long and Short; verify balance, Risk %,
   available quantity/lot mode, SL %, TP %, drawing synchronization and one confirm.
3. Open Symbol Search. Search provider symbols in every enabled category, paginate,
   verify icon/fallback, provider/feed identity and no duplicate rows. Disabled
   provider categories must be absent or explain the blocker.
4. Hover/click timeframe. Verify translucent background, downward caret, selection,
   Escape and focus return.
5. Move crosshair to center and every edge. Price and time labels must be visible
   together and use selected precision/timezone.
6. Click clock and choose UTC, Exchange, Local, Asia/Ho_Chi_Minh and
   America/New_York. Verify axis/crosshair labels change while underlying ISO UTC
   timestamps and OHLCV do not.

Actual provider evidence is recorded separately. Missing Alpaca or other required
credentials is `BLOCKED_EXTERNAL`; fixture success cannot replace a real response.
