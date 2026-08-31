# Official MQL5 target verification — compilation PASS, runtime NOT RUN

31/08/2026, MetaTrader5 build6140. Existing installed MetaEditor64 and terminal64
had valid Authenticode signatures for MetaQuotes Ltd. Their binaries were copied
to ignored `tmp/pb016-target`; compiler SHA256
`05718f3fa55f3f59fd2f024d8c433b457fbd58fcf39e947a16ccdad00a614ec7`.
No owner profile/account/configuration was copied or changed. No trading login,
orders, DLL or external source upload. The terminal itself performed default
vendor discovery/community connection attempts; no successful account login or
MQL runtime execution was observed.

## Actual compiler result

`python scripts/compile_mql5_fixtures.py --compiler H:\AITrading\tmp\pb016-target\MetaEditor64.exe --report specs/PB-016/test-evidence/compiler.json`
exited0: **eight generated fixtures, zero errors and zero warnings**, fresh EX5
artifacts and SHA256 recorded in [compiler.json](compiler.json). MetaEditor process
exit1 can accompany successful compilation; the verifier instead requires the
official zero-error/zero-warning result and a newly created nonempty executable.
Initial warning62 (CSV row counter shadowing global count) was fixed by renaming
only that local variable. No warning suppression or compiler substitute was used.

## Runtime attempts and exact limitation

An isolated default script probe compiled0/0 and loaded on EURUSD/H1 but did not
produce its OnStart marker/file. Terminal reported initialization failure after
waiting, then stopped. This is **not** runtime PASS; the exact cause was not
established. A separate chart-independent service probe compiled0/0, but no actual
service execution was observed. Computer Use window handles expired in early
attempts; the subsequent app approval timed out. UI attempts stopped and PO was
notified asynchronously. No authentication or app-approval workaround was used.
Generated product output remains a research script, not the service probe.

## Remaining official procedure

Use an authorized target session/window and initialized chart environment. Keep
trading disabled; no broker login or money operation is part of this test. Put
each prepared synthetic CSV in the target's local `MQL5/Files` sandbox. Compile
the matching `.mq5` and explicitly set CsvFilename, ConfirmCsvSymbol and
ConfirmCsvTimeframe from [manifest](target-fixtures/manifest.json). Run one fixture
at a time, save actual Experts log from START through END, including every BAR.
The script simulates CSV only and does not read chart/broker prices.

`python scripts/verify_mql5_trace.py --fixture backend/src/test/resources/pine/<name>.json --log <actual-owned-target-log>`
requires exact source/hash/count, ordered unique bars, rule/side/event/pivot timing,
fill/cost/quantity/balance/equity and completion/cancellation. Float tolerance is
absolute1e-8 + relative1e-12; event decisions have no numeric tolerance. Verifier
unit tests use synthetic log text solely to test parser rejection, not to certify
MQL execution. Source text and generated success markers are not runtime evidence.

Also execute invalid filename/traversal/extension, missing/empty/oversized CSV,
Windows device filenames (`CON.csv`, `NUL.csv`, `COM1.csv`, `LPT9.csv`),
bad header/columns/numbers, NaN/Infinity, negative/zero price, huge/small values,
invalid dates, UTC alignment, duplicate/reversed/gapped/open/future candles and
row bounds. Assert no valid result is reported for rejected data. These CSV/runtime
negative tests remain NOT RUN until official execution is available.
Include extreme repeated growth/fees to exercise NUMERIC_RANGE: nonfinite account
state must abort without an END completion marker, not return null accounting.
Prepared `overflow-repeated-target.csv` uses1100 synthetic bars with open100,
high200,low100,close100. Run with the `long-target-cap.mq5` source (same DSL with
100% allocation/100% target/no costs) to exercise repeated doubling. Expected
NUMERIC_RANGE before completion; actual target test is still NOT RUN.

Binary doubles differ from Decimal34, including near-threshold rules/pivots. CSV
must have known UTC provenance; this does not convert broker time or tick volume.
Native lot/tick/stop/margin/liquidation/funding and Strategy Tester fills are outside
this research simulator. Do not close Issue18 or claim target event parity until
remaining runtime/negative checks pass. Independent READY backlog work may proceed.
