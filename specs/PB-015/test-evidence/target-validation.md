# Official Pine validation — PASS (8/8 official runtime traces)

31/08/2026. Actual anonymous TradingView chart and Pine Editor are reachable.
Clicking **Add to chart** on the editor's untouched default indicator opened
**Sign in**. [Observed DOM](target-access.md). No private strategy, project account
or generated fixture has been submitted. No official compiler result exists yet.
Product Owner was notified to sign in with an authorized test account if available;
passwords are not requested in chat. No undocumented API/authentication workaround.

## Prepared verification, not completed verification

1. `python scripts/prepare_pine_fixtures.py` runs the actual Decimal34 Python engine
   on eight synthetic inputs, including hand-asserted trades. Reference JSON holds
   full bars, indicators, pivot confirmations, rules, events, trades and run card.
2. `PineGeneratorTests` validates the same canonical DSL hashes and generates
   normal Pine exports. This checks source binding and determinism, not Pine syntax.
3. `python scripts/build_pine_target_fixtures.py` prepares Pine assertion scripts
   using those exact generated helper/indicator/rule/simulator blocks. Only chart
   input identifiers/configuration are adapted to fixed synthetic OHLCV/time values.
   It structurally verifies that the runtime body remains unchanged. Files and
   hashes are in [target fixture manifest](target-fixtures/manifest.json).
4. In an authorized Pine Editor, run each `*-export.pine` on a matching standard
   chart/window to check normal compilation and real chart guards. Then run each
   assertion `.pine` (without `-export`) on a chart with enough closed history.
   Do not publish scripts, connect a broker, create alerts or place orders.
5. Assertion scripts call `runtime.error` for any event/rule/confirmation mismatch
   or numeric divergence exceeding absolute1e-8 + relative1e-12. A fixture success
   message is meaningful **only when actually observed from official runtime**.
   Generated success-message source text is not a test result.
6. Save actual compiler diagnostics/Pine logs, version/date and screenshots;
   investigate every difference before marking target validation PASS. Exercise
   wrong symbol mapping, interval, nonstandard chart, missing/unaligned start/end,
   gaps, open bars, insufficient history and resource bounds separately: the
   synthetic input adapter intentionally does not test native chart guards.

## Known precision/platform limits

Pine uses binary floats and rounds operands of comparison operators to nine
fractional digits. Python uses Decimal34. These can cause rule/SL/TP/pivot divergence
near thresholds even when the source formulas match; finite fixtures cannot certify
all strategies. Native chart history/feed can differ from an imported CSV.
[Official type system](https://www.tradingview.com/pine-script-docs/language/type-system/).
Pine logs also have display/retention limits; trace mode is intended for small
fixtures. [Official debugging guidance](https://www.tradingview.com/pine-script-docs/writing/debugging/).

This export is an experimental **research indicator**, not native Strategy Tester,
an EA, order routing or a guarantee of financial performance. Do not close Issue17
or claim PB-015 DONE without the target verification above. Independent backlog
work can continue while authorized external access is unavailable.

## 01/09/2026 authenticated validation and subsystem diagnostic

All eight assertion fixtures and eight generated exports were officially compiled
and Updated on chart without compiler diagnostics or `runtime.error`. The remaining
required evidence is the actual per-fixture Pine Logs event trace. Pine Logs stayed
on its loading state even for the independent minimal v6 `log.info()` diagnostic;
the authenticated page console repeatedly reported `Fetch:https://undefined/ping.
TypeError: Failed to fetch`. Details are in [pine-logs-diagnostic.md](pine-logs-diagnostic.md).
This is a TradingView-side/UI runtime blocker, so no fixture is rerun and PB-015
must stay OPEN/BLOCKED.

## 01/09/2026 Chrome Incognito isolation and partial official trace

A clean, Product-Owner-authenticated Chrome Incognito session successfully showed
the independent `PB015_LOG_SUBSYSTEM_OK` entries. In that same session,
`hand-next-open.pine` with browser-only `trace=true` emitted all four actual event/
accounting bars, `DATASET_END`, and its official assertion-PASS line. Its final
bar was `exit=1`, `exitReason=1`, `exitSignalBar=2`, `exitFill=120`,
`closedNet=200`, `balance=1200`, `equity=1200`, matching its pinned Python/
assertion fixture.

The next intended trace, `costs-both-hit-gap`, did not return any Pine Logs after
its official update; the console resumed repeated `Fetch:https://undefined/ping.
TypeError: Failed to fetch` errors. No retry occurred and the remaining seven
fixtures were not run. See [the subsystem diagnostic](pine-logs-diagnostic.md).
The evidence is partial and #17 remains OPEN/BLOCKED until all eight actual traces
are collected and compared.

## 01/09/2026 clean-session continuation

`costs-both-hit-gap` now has complete official evidence: six actual trace bars,
`DATASET_END`, and the fixture's assertion-PASS line. Its final observed balance
and equity were `422.6007359013559`; its asserted float values remained within the
fixture tolerance.

`long-target-cap` was the next sequential fixture. Its three expected bar/exit
records appeared, including its target exit at `200` and final balance `2000`, but
Pine Logs did not emit the final `DATASET_END` or assertion-PASS entry. No retry
was made in that session. `short-target-cap`, `nonpositive-equity`,
`rule-exit-before-barriers`, `simultaneous-entries`, and `causal-all-indicators`
remain untouched. The intermittent `undefined/ping` console failure remains the
external blocker; two fixtures have complete official PASS traces, six do not.

## 01/09/2026 fresh long-target-cap reproduction

In another new authenticated Chrome Incognito session, `long-target-cap` was
executed from the default Pine editor, then Pine Logs was opened. Its three
expected event/accounting bar records reappeared and match the prepared assertion
values, but its `DATASET_END` and assertion-PASS records again did not appear.
The page console emitted `Fetch:https://undefined/ping. TypeError: Failed to fetch`
after the wait. This is a repeatable partial trace, not PASS evidence. No retry or
next-fixture execution occurred in that session; #17 remains OPEN/BLOCKED.

## 01/09/2026 compact long-target-cap official PASS

The repeated missing final delivery was isolated with a browser-only compact trace
variant. Its round-trip transform recovered the pinned fixture byte-for-byte with
SHA-256 `0b872e1ff5020a619fa0c3bb7c9bf15d4821c81c87fe6df93999b2aa956b28a4`.
It changed only logging: three per-bar records were accumulated in memory, endpoint
state was captured before the original pending reset, and one final log was emitted
after the unchanged assertions. The one actual Pine Logs record contains all three
expected bars, `DATASET_END: cancelledPending=1;openSide=0`, and
`ASSERTIONS=PASS`; full text is in [pine-logs-diagnostic.md](pine-logs-diagnostic.md).

`long-target-cap` is therefore official runtime PASS under test-only compact
instrumentation. The remaining unexecuted fixtures are `short-target-cap`,
`nonpositive-equity`, `rule-exit-before-barriers`, `simultaneous-entries`, and
`causal-all-indicators`. PB-015 remains BLOCKED until their traces are complete.

## 01/09/2026 short-target-cap attempt — no runtime result

The compact transform structurally restored pinned SHA-256
`362b17203018292b56c82db63fe313c79d85b6e5a5c4cc950e355e5112082188`, but the
TradingView editor reported CE10285 duplicate `Simulation` type declarations and
the account session was disconnected for concurrent browser/device activity.
No official trace was produced; no retry occurred. `short-target-cap` remains
NOT RUN and #17 remains OPEN/BLOCKED.

## 01/09/2026 clean-editor retry — chart slot blocker

A default editor was correctly replaced with the one verified compact
`short-target-cap` source and did not show a compiler diagnostic. TradingView
refused Add to chart because the Basic account chart retained two temporary
AITrading indicators and had no indicator slot available. Removal controls did
not apply through the current browser control session. No runtime evidence exists;
`short-target-cap` remains NOT RUN and #17 remains OPEN/BLOCKED.

## 01/09/2026 persistent validation-slot continuation

The existing linked indicator was reused only through Update on chart. The prior
CE10285 was traced to two concatenated editor scripts; after a successful minimal
sanitation update, every fixture started from a verified-empty editor and its
compact transform restored the pinned fixture byte-for-byte.

Complete official compact runtime traces now PASS for:

- `short-target-cap`: three bars, short entry `100`, target exit `50`, closed net
  `500`, final balance/equity `1500`, `cancelledPending=-1`, `openSide=0`;
- `nonpositive-equity`: four bars, stop exit `1000`, closed net `-90000`, final
  balance/equity `-89000`, and subsequent `skipOpen=1`;
- `rule-exit-before-barriers`: three bars, rule exit at next open `40`, signal bar
  `1`, closed net `-600`, final balance/equity `400`.

Every actual field matched the prepared Python event/accounting fixtures and each
single official log contained DATASET_END plus `ASSERTIONS=PASS`. Full logs and
SHA proofs are in [pine-logs-diagnostic.md](pine-logs-diagnostic.md).

`simultaneous-entries` compiled and updated from one verified compact fixture, and
the chart displayed balance/equity `1000`, but Pine Logs failed to open. Without
its compact trace, DATASET_END, and assertion result it remains PARTIAL. No retry
or `causal-all-indicators` execution occurred. Six of eight official fixture
traces are PASS; PB-015 and Issue #17 remain OPEN/BLOCKED.

## 01/09/2026 final clean-slot continuation — 8/8 PASS

The same existing on-chart validation slot remained linked to Pine Editor and was
updated without adding an indicator. No previously completed fixture was rerun.
Each browser-only compact transform retained the synthetic OHLCV, simulator/rule
logic, expected values, assertions and state-mutation order; only log delivery was
compacted. The actual editor was emptied before each paste and contained exactly
one version directive, indicator and `Simulation` type.

- `simultaneous-entries` restored pinned SHA-256
  `181915d5241b6cda3dae5190ffeb72cdf24e8e69ba41e4d901865e05925b2361`.
  Its official four-bar trace contains one `SIMULTANEOUS_ENTRIES` skip per bar,
  no entry/exit/trade, balance/equity `1000`, `DATASET_END` with
  `cancelledPending=0; openSide=0`, and `ASSERTIONS=PASS`.
- `causal-all-indicators` restored pinned SHA-256
  `535b352e14f3071dd883079f05f2fe3c09b107a186cf3fadcf67c0616dc0c677`.
  Its official 24-bar trace matched all 384 logged values from 16 pinned expected
  arrays and all 120 Python bar/time/accounting comparisons. Seven entries and
  seven rule exits matched Python exactly by bar, side, signal bar, fill and fee.
  It ended at balance/equity `1738.9619400908134`, then
  `DATASET_END: cancelledPending=1; openSide=0 | ASSERTIONS=PASS`.

The exact logs and machine-readable comparison summary are preserved under
[`official-traces`](official-traces/verification.json). All eight official fixture
traces now contain their complete bar/event/accounting records, dataset-end state
and a PASS emitted only after the original assertions. The pinned repository
fixtures were not modified. PB-015 target validation is complete; publication,
exact remote SHA and CI remain the final Issue #17 completion steps.
