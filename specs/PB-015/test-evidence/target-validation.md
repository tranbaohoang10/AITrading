# Official Pine validation — PARTIAL / Pine Logs BLOCKED

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
