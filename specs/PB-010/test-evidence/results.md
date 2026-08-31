# PB-010 verification — 31/08/2026 (Asia/Ho_Chi_Minh)

Issue #11. Local verification PASS; scoped publication and actual GitHub CI are
still required before completed. This report distinguishes offline worker from
future authenticated jobs and never treats source inspection as runtime parity.

| Cases / AC | Evidence | Result |
| --- | --- | --- |
| BT-T01 / BT-01 | Six existing Java DSL canonical/hash/minimumBars goldens, exact exponent/-zero/Unicode variants, label neutrality | PASS |
| BT-T02 / BT-01,06 | Closed schema/types/unknowns, bool-number distinction, cycles/units/missing/duplicate IDs, disabled sides/risk/warm-up/tree/depth/parser limits | PASS |
| BT-T03 / BT-02 | Existing Java OHLC hash bc335f...d35f8 and independent fixture hash; seven timeframes, cutoff/alignment/calendar/order/gap/duplicate/range/count rejection | PASS |
| BT-T04–06 / BT-03 | Hand SMA/EMA/RSI/ATR/extrema, nested forward DAG/lag/reset, strict pivot and original-index trendline, all comparisons/cross/undefined logic | PASS |
| BT-T05 / BT-03 | Six families at prefix1/7/22/37 of50 bars; mutate bars25–49 and compare earlier indicator/rule/equity/event traces exactly | PASS |
| BT-T07–09 / BT-04,05 | Hand long/short next-open, fees/combined costs/leverage/resizing, stop/TP/both/gaps/entry bar, exit precedence, no reversal/pyramiding, end open mark/cancel, negative equity/loss retention | PASS |
| BT-T10 / BT-05 | Byte-identical deterministic serialization, Decimal ambient precision6 isolation, result hash recomputation, labels do not change traces; 12 concurrent runs on4 workers equal | PASS |
| BT-T11 / BT-06 | Actual isolated subprocess valid/error/duplicate/arguments/oversize; fixed stdout and empty stderr; work/deadline/output fail closed, inert script/path-shaped input | PASS |
| BT-T12 / BT-07 | 5000 candles with32 indicators, period2000+lag2000, output bounded; regression counts below | PASS local |
| BT-T13 / BT-07 | Scope/diff/secret checks, normal push exactSHA and actual CI | Local scope checked; publication pending |

## Commands and actual results

- `python -m unittest discover -s python/tests -v`:35 tests,0 failures/errors,
  exit0. Full named output in engine-tests.txt. No skip/dependency/mocked engine.
- `python -m compileall -q python`:exit0.
- `python scripts/test_backend.py` with Java21:clean Gradle compile/bootJar/test/
  dependencyInventory exit0; actual PostgreSQL17 temporary cluster;84 tests,
  0 failures/errors/skipped (backend-tests.json). Owned pg-test-bqmekkr3 stopped,
  generated credential file removed. No user PostgreSQL service changed.
- Frontend `npm run lint`, `npm run build`, `npm test`, `npm audit --audit-level=high`:
  all exit0,88 tests,0 vulnerabilities. Existing dist remains B9cXtKor.js /
  Dm56lsLT.css; no UI source changed, browser visual rerun N/A for this feature.
- `python -m unittest discover -s scripts -p test_verification_tools.py -v`:
  6 fail-closed verifier tests PASS, exit0.
- `python scripts/check_dsl_fixtures.py`:6 independent Decimal canonical goldens
  PASS, exit0, in addition to the engine's Java-contract fixture tests.
- `python scripts/check_dependencies.py backend/build/reports/dependencies.txt
  tmp/pb010-dependency-audit.json`:118 resolved Java dependencies, no findings,
  passed true, exit0. Sanitized full report dependency-audit.json. No new Python
  third-party package; standard library has no project dependency lock to audit.
- Actual isolated CLI example in python/examples/long-next-open.json:exit0,
  equity1100/net100 as hand-calculated, output example-result.json. Synthetic only.

## Failure repaired, not hidden

First31-test run had one failure: `python -I` intentionally excludes the script
directory, so package import failed before protocol startup. Launcher now inserts
only its fixed trusted package directory and safely handles import/configuration
failure. It still ignores cwd/PYTHONPATH and accepts no args. The same subprocess
test passed on rerun; expanded34/35-test suites PASS. No assertion was weakened.

## Security and limits

Engine receives no owner IDs or secrets and exposes no network service. BOLA,
session/CSRF/password/rate limiting remain the authenticated Java boundary;84
backend regressions continue to verify that boundary. Later PB-011 must resolve
owned snapshots and enforce process supervision; offline input hashes are not
authorization. No eval, shell, network, arbitrary file path, user schema/import,
HTML renderer or upload parser exists. Script-shaped metadata remains inert text.
No private payload/error traceback is printed. Threat and bounds contract in design.

Compute deadline is cooperative15s/5million units; input pipe waiting and an OS
hard timeout belong to the supervisor. Large supported combinations may fail the
explicit work/output budget rather than silently approximate or skip indicators.
Output32MiB and input2MiB; exact Decimal34 rounding policy is versioned. No broker
ticks/lot/funding/liquidation or real market source verification. Intrabar execution
time is unknown, terminal position is marked rather than fabricated closed. A
dataset cutoff is explicit provenance, not proof of current server time.

No Pine/MQL runtime equivalence or web backtest functionality is claimed. No UI,
database migration, dependency lock, fixed stack, governance or protected legacy
review document changed. Existing V1–V5 and schema1.0.0 remain byte-identical to
main; only Java capabilities + matching assertion report the offline engine.

## Delivery — 31/08/2026

Commit2a3cf2004ea6034ee3abf5738cd2cec0e3c334d3 normal-pushed to origin/main;
remote and GitHub API SHA agree. CI33359737530 both jobs success. Downloaded
JUnit84/0/0/0, OSV118PASS and actual log35 Python tests/OK verified. BT-T13 PASS.
Issue11 closed completed, evidence comment5474069904. Working tree clean at delivery.
