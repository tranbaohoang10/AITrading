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

## short-target-cap compact attempt — NOT RUN — 01/09/2026

The full-field browser-only compact transform for `short-target-cap` passed its
round-trip check against pinned SHA-256
`362b17203018292b56c82db63fe313c79d85b6e5a5c4cc950e355e5112082188` before the
browser action. The current TradingView editor then reported compile error
`CE10285: Cannot create type with name "Simulation". Enum with the same name is
already defined.` No compact log, DATASET_END, assertion result or runtime trace
was emitted.

TradingView also displayed that the account session had been disconnected because
the account was active from another browser/device. This is not a fixture result
and is not counted as partial or PASS. No retry occurred in that browser session;
`short-target-cap` and the four later fixtures remain NOT RUN.

## short-target-cap clean-editor retry — blocked before runtime — 01/09/2026

Product Owner provided a single authenticated Incognito session with a default
editor. Codex selected all default text and replaced it with the one verified
compact `short-target-cap` source; the prepared source has exactly one
`//@version=6`, `indicator(...)`, `type Simulation`, fixture body and compact
final log, and its round-trip SHA stayed
`362b17203018292b56c82db63fe313c79d85b6e5a5c4cc950e355e5112082188`.

TradingView did not report a compiler error. It refused **Add to chart** because
the Basic account already had its maximum two temporary AITrading indicators on
the chart. Attempts to remove those temporary chart indicators did not take effect
through the current browser control session. No runtime execution, Pine Logs,
DATASET_END or assertion output resulted. This remains NOT RUN, not partial/PASS;
no later fixture was started.

## Persistent-slot compact continuation — 01/09/2026

The existing on-chart AITrading indicator was linked to Pine Editor and reused
exclusively through **Update on chart**. Before each execution, the editor was
proved empty, the compact transform round-tripped byte-for-byte to the pinned
fixture SHA-256, and the actual editor contained exactly one `//@version=6`, one
`indicator(...)`, one `type Simulation`, and one fixture body. Only trace
instrumentation changed; OHLCV, runtime/rule logic, expected values, assertions,
and state-mutation order were unchanged. The earlier CE10285 was confirmed as two
concatenated editor scripts and cleared by a successful sanitation update.

### short-target-cap — official compact runtime PASS

Pinned/restored SHA-256:
`362b17203018292b56c82db63fe313c79d85b6e5a5c4cc950e355e5112082188`.

```text
PB015_COMPACT short-target-cap: bar=0,openMs=1704067200000,closeMs=1704070800000,signal=-1,entry=0,entrySignalBar=-1,entryFill=null,entryFee=null,quantity=0,skipOpen=0,skipClose=0,exit=0,exitReason=0,exitSignalBar=-1,exitFill=null,exitFee=null,closedNet=null,balance=1000,equity=1000 | bar=1,openMs=1704070800000,closeMs=1704074400000,signal=0,entry=-1,entrySignalBar=0,entryFill=100,entryFee=0,quantity=10,skipOpen=0,skipClose=0,exit=0,exitReason=0,exitSignalBar=-1,exitFill=null,exitFee=null,closedNet=null,balance=1000,equity=1000 | bar=2,openMs=1704074400000,closeMs=1704078000000,signal=-1,entry=0,entrySignalBar=-1,entryFill=null,entryFee=null,quantity=10,skipOpen=0,skipClose=0,exit=-1,exitReason=3,exitSignalBar=-1,exitFill=50,exitFee=0,closedNet=500,balance=1500,equity=1500 | DATASET_END: cancelledPending=-1; openSide=0 | ASSERTIONS=PASS
```

All three bars match Python, including short entry `100`, target exit `50`,
quantity `10`, closed net `500`, and final balance/equity `1500`.

### nonpositive-equity — official compact runtime PASS

Pinned/restored SHA-256:
`5698188dda44a5a2fe2286328690532376ee0c7ccd37e59f8db65c1aaebc8160`.

```text
PB015_COMPACT nonpositive-equity: bar=0,openMs=1704067200000,closeMs=1704070800000,signal=-1,entry=0,entrySignalBar=-1,entryFill=null,entryFee=null,quantity=0,skipOpen=0,skipClose=0,exit=0,exitReason=0,exitSignalBar=-1,exitFill=null,exitFee=null,closedNet=null,balance=1000,equity=1000 | bar=1,openMs=1704070800000,closeMs=1704074400000,signal=0,entry=-1,entrySignalBar=0,entryFill=100,entryFee=0,quantity=100,skipOpen=0,skipClose=0,exit=0,exitReason=0,exitSignalBar=-1,exitFill=null,exitFee=null,closedNet=null,balance=1000,equity=1000 | bar=2,openMs=1704074400000,closeMs=1704078000000,signal=-1,entry=0,entrySignalBar=-1,entryFill=null,entryFee=null,quantity=100,skipOpen=0,skipClose=0,exit=-1,exitReason=2,exitSignalBar=-1,exitFill=1000,exitFee=0,closedNet=-90000,balance=-89000,equity=-89000 | bar=3,openMs=1704078000000,closeMs=1704081600000,signal=-1,entry=0,entrySignalBar=-1,entryFill=null,entryFee=null,quantity=100,skipOpen=1,skipClose=0,exit=0,exitReason=0,exitSignalBar=-1,exitFill=null,exitFee=null,closedNet=null,balance=-89000,equity=-89000 | DATASET_END: cancelledPending=-1; openSide=0 | ASSERTIONS=PASS
```

All four bars match Python, including short stop `1000`, closed net `-90000`,
final balance/equity `-89000`, and `skipOpen=1` after nonpositive equity.

### rule-exit-before-barriers — official compact runtime PASS

Pinned/restored SHA-256:
`899600adcb2f567496eaa8837bebcc7f66acbeb237d2e537f923a5ceccf9ff25`.

```text
PB015_COMPACT rule-exit-before-barriers: bar=0,openMs=1704067200000,closeMs=1704070800000,signal=1,entry=0,entrySignalBar=-1,entryFill=null,entryFee=null,quantity=0,skipOpen=0,skipClose=0,exit=0,exitReason=0,exitSignalBar=-1,exitFill=null,exitFee=null,closedNet=null,balance=1000,equity=1000 | bar=1,openMs=1704070800000,closeMs=1704074400000,signal=2,entry=1,entrySignalBar=0,entryFill=100,entryFee=0,quantity=10,skipOpen=0,skipClose=0,exit=0,exitReason=0,exitSignalBar=-1,exitFill=null,exitFee=null,closedNet=null,balance=1000,equity=1000 | bar=2,openMs=1704074400000,closeMs=1704078000000,signal=1,entry=0,entrySignalBar=-1,entryFill=null,entryFee=null,quantity=10,skipOpen=0,skipClose=0,exit=1,exitReason=1,exitSignalBar=1,exitFill=40,exitFee=0,closedNet=-600,balance=400,equity=400 | DATASET_END: cancelledPending=1; openSide=0 | ASSERTIONS=PASS
```

All three bars match Python: rule exit executes at next open `40` before
barriers, with signal bar `1`, closed net `-600`, and balance/equity `400`.

### simultaneous-entries — PARTIAL, Pine Logs unavailable

The compact transform restored pinned SHA-256
`181915d5241b6cda3dae5190ffeb72cdf24e8e69ba41e4d901865e05925b2361`.
The editor was empty before paste and contained exactly one version, indicator,
`Simulation` type, and fixture body. Update on chart completed without compiler
diagnostics and the chart displayed balance/equity `1000`. Pine Logs then failed
to open, so no official compact log, DATASET_END, or assertion result exists.
This is PARTIAL, not PASS. No retry or `causal-all-indicators` run occurred.

Six fixtures now have official PASS traces: `hand-next-open`,
`costs-both-hit-gap`, `long-target-cap`, `short-target-cap`,
`nonpositive-equity`, and `rule-exit-before-barriers`. Issue #17 remains
OPEN/BLOCKED on `simultaneous-entries` and `causal-all-indicators`.

## Final clean-slot recovery — simultaneous and causal PASS — 01/09/2026

The Pine Logs spinner recovered after one bounded wait for each final execution;
neither fixture was retried. `simultaneous-entries` produced four complete skip
records, `DATASET_END: cancelledPending=0; openSide=0`, and `ASSERTIONS=PASS`.
`causal-all-indicators` produced 24 complete records, seven entries, seven rule
exits, final balance/equity `1738.9619400908134`,
`DATASET_END: cancelledPending=1; openSide=0`, and `ASSERTIONS=PASS`.

Both compact transforms round-tripped to their pinned SHA-256 values before the
official Update-on-chart executions. The exact copied Pine Logs are retained in
[`simultaneous-entries.txt`](official-traces/simultaneous-entries.txt) and
[`causal-all-indicators.txt`](official-traces/causal-all-indicators.txt); the
field-by-field comparison counts are in
[`verification.json`](official-traces/verification.json). No pinned source,
runtime semantics, fixture input, assertion or expected value changed.

Official runtime status is now 8/8 PASS. The earlier intermittent
`https://undefined/ping` observations remain truthful historical evidence, but no
longer block the completed target set.
