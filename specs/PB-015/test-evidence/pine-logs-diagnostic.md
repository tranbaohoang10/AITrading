# Pine Logs subsystem diagnostic — 01/09/2026

An authenticated TradingView Pine Editor session ran this independent minimal v6
indicator, which contains no AITrading source or fixture data:

```pine
//@version=6
indicator("PB015 Pine Logs diagnostic", overlay=false)
if barstate.islast
    log.info("PB015_LOG_SUBSYSTEM_OK")
plot(close)
```

TradingView reported `Compiled.` then `Added to chart.` at 15:52:42. Pine Logs
still showed only its loading state and no `PB015_LOG_SUBSYSTEM_OK` entry. Browser
console repeatedly emitted `Fetch:https://undefined/ping. TypeError: Failed to
fetch` from `static.tradingview.com` bundles. Thus this is independent of the
AITrading exports and does not supply event traces. No fixture was rerun and no
generated text/parser result is treated as runtime evidence.

PB-015 remains OPEN/BLOCKED. The required eight actual fixture traces remain the
only missing acceptance evidence; do not lower the DoD or close Issue #17.

## Chrome Incognito browser-isolation diagnostic — 01/09/2026

Product Owner manually authenticated a clean Chrome Incognito TradingView session;
the ChatGPT Chrome extension was enabled for Incognito. Codex used that tab only,
not the earlier in-app-browser session, and ran:

```pine
//@version=6
indicator("PB015 Log Diagnostic")
log.info("PB015_LOG_SUBSYSTEM_OK")
```

It compiled and was added to the chart. Opening **Pine Logs** displayed repeated
`PB015_LOG_SUBSYSTEM_OK` entries, so the log subsystem is capable of working in
this isolated session. No repository fixture was altered for this diagnostic.

The first missing target trace, `hand-next-open.pine`, was then pasted with only
its prepared `bool trace = false` switch changed to `true` in the browser copy.
The pinned repository fixture and its hash remain unchanged. TradingView displayed
the actual four bar event/accounting trace, the final `DATASET_END` record, and:

`SYNTHETIC hand-next-open: all 4 event/indicator/accounting assertions passed in this actual Pine execution.`

When the next fixture, `costs-both-hit-gap`, was compiled with that same
browser-only trace switch, Pine Logs stopped returning entries. The browser console
again repeatedly emitted `Fetch:https://undefined/ping. TypeError: Failed to fetch`
from `static.tradingview.com`. No retry was made and the remaining seven fixtures
were not run. This proves the original failure is not permanently fixed by browser
isolation; it is intermittent/TradingView-side and still prevents the required
complete eight-fixture actual trace comparison.

PB-015 therefore remains OPEN/BLOCKED. `hand-next-open` is valid partial official
runtime evidence only; it is not a substitute for the seven missing fixture traces
or for the full Definition of Done.

## Clean-session continuation — 01/09/2026

In a new Product-Owner-authenticated Chrome Incognito session, the existing
official `costs-both-hit-gap` assertion copy was active with its browser-only
trace switch. Pine Logs responded through all six bars and showed `DATASET_END`
followed by:

`SYNTHETIC costs-both-hit-gap: all 6 event/indicator/accounting assertions passed in this actual Pine execution.`

The observed final accounting record was `exit=-1`, `exitReason=2`,
`exitFill=150.105`, `closedNet=-429.1643388640097`,
`balance=422.6007359013559`, `equity=422.6007359013559`, consistent with the
pinned assertion fixture's floating-point tolerance.

Pine Logs was confirmed responsive before `long-target-cap` was compiled and
updated on chart. It returned the expected three bar/exit records, including the
bar-two target exit (`exitReason=3`, `exitFill=200`, `closedNet=1000`,
`balance=2000`). It did **not** return `DATASET_END` or the required
`SYNTHETIC long-target-cap ... assertions passed` line after the log was scrolled
to its end. Browser console collection continued to contain repeated
`Fetch:https://undefined/ping. TypeError: Failed to fetch` records.

No retry of `long-target-cap` occurred in this session. `short-target-cap`,
`nonpositive-equity`, `rule-exit-before-barriers`, `simultaneous-entries`, and
`causal-all-indicators` were not run. Official PASS evidence now exists only for
`hand-next-open` and `costs-both-hit-gap`; the incomplete `long-target-cap` trace
and the five untouched fixtures keep Issue #17 OPEN/BLOCKED.

## Fresh long-target-cap reproduction — 01/09/2026

Product Owner opened another clean authenticated Chrome Incognito session. Codex
started `long-target-cap` again from the untouched default Pine editor, pasted the
prepared assertion fixture with only browser-local `trace=true`, added it to chart,
and opened Pine Logs. This is a new official execution, not a reuse of the earlier
partial trace.

The three expected event/accounting bars appeared and matched the fixture:
`1000` balance/equity at bar zero and one, then target `exitReason=3`,
`exitFill=200`, `closedNet=1000`, `balance=2000`, `equity=2000` at bar two.
After an explicit wait, no `DATASET_END` or assertion-PASS line appeared. The
console then recorded `Fetch:https://undefined/ping. TypeError: Failed to fetch`
from the TradingView static bundle. No retry occurred and no next fixture was run.

This fresh reproduction confirms that `long-target-cap` is still PARTIAL, not
PASS. Complete official PASS traces remain exactly `hand-next-open` and
`costs-both-hit-gap`; Issue #17 remains OPEN/BLOCKED.

## Compact browser-only long-target-cap diagnostic — 01/09/2026

Before execution, the temporary compact variant was structurally round-tripped to
the pinned fixture. The recovered SHA-256 was exactly
`0b872e1ff5020a619fa0c3bb7c9bf15d4821c81c87fe6df93999b2aa956b28a4`.
Only the browser-local trace instrumentation changed: it accumulated each bar in
memory, saved the endpoint state before the existing `sim.pending := 0`, and
replaced eight log deliveries with one final log after every original assertion.
The synthetic OHLCV, runtime, expected arrays, assertions and state-mutation
order were unchanged. No pinned repository fixture was modified.

In a new authenticated Incognito session, the single official Pine Logs entry was:

```text
COMPACT long-target-cap: b=0,sig=1,entry=0,entryFill=null,exit=0,reason=0,exitFill=null,net=null,bal=1000,eq=1000|b=1,sig=0,entry=1,entryFill=100,exit=0,reason=0,exitFill=null,net=null,bal=1000,eq=1000|b=2,sig=1,entry=0,entryFill=null,exit=1,reason=3,exitFill=200,net=1000,bal=2000,eq=2000|DATASET_END: cancelledPending=1;openSide=0;ASSERTIONS=PASS
```

All values match the pinned expected arrays. `ASSERTIONS=PASS` is emitted after
the unchanged checks, so this is official runtime PASS evidence for
`long-target-cap` using temporary test instrumentation. Browser console showed
only an unrelated settings warning and no `undefined/ping` error. Stop before the
next fixture: `short-target-cap`, `nonpositive-equity`,
`rule-exit-before-barriers`, `simultaneous-entries`, and
`causal-all-indicators` remain unexecuted. Issue #17 stays OPEN/BLOCKED pending
those complete traces.
