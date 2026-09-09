# Product Owner refinement — 08/09/2026

Status: IN_PROGRESS. This refinement supersedes conflicting older PB-038 UX rules.

- Provider routing is an internal market-data concern. Normal Symbol Search is canonical-symbol-first.
- Keep seven category tabs with truthful empty states; remove the four-coin allowlist limitation using actual provider discovery and licensed icons.
- Keep canonical identity separate from configured historical/realtime/Replay routes; never fabricate account catalog entries or silently switch Replay providers.
- Show current wall-clock HH:mm:ss below the current right-axis price, following the selected timezone. This is not candle time or a countdown. Isolate clock ticks from candle geometry.
- Use curated city labels with dynamically calculated Intl/IANA offsets, sorted by current offset then city; UTC, Exchange and Local time remain first. Hide raw IANA IDs in normal labels.
- Exchange timezone comes from verified instrument metadata; unavailable metadata must not invent exchange time. Preserve stored UTC timestamps and Replay identity.
- Verify icon, history, actual live event and candle update per required symbol; missing credentials are BLOCKED_EXTERNAL, not PASS.
- Complete frontend/backend, DST, clock-isolation and responsive 1440/1024/390 browser/network QA before claiming completion.

Source: Product Owner attachment c3b4126b-3c55-4bfb-b44c-89179200a2fc/pasted-text.txt. Full scope includes canonical routing, Coinbase discovery beyond four symbols, configured Alpaca/OANDA/cTrader adapters, historical-only Binance/Frankfurter separation, icons, Redis provenance, timezone and price clock.

Audit baseline: main and origin/main at 0cc370b87af09d5e47c1ae8134b277d1b8510a8f. Existing uncommitted realtime corrections and unrelated untracked files are preserved. Earlier 302-test PASS applies to the pre-refinement working tree, not completion of this refinement.
