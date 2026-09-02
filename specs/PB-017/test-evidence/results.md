# PB-017 local verification evidence — Refs #26

Date: 02/09/2026 (Asia/Ho_Chi_Minh). Scope: repository evidence only; no Pine,
MQL5, broker, account, network or live-trading execution.

## Cross-target result

`py -3 scripts/verify_cross_target.py --json-out specs/PB-017/test-evidence/report.json --markdown-out specs/PB-017/test-evidence/report.md`

- Exit code: 0.
- PASS: 8/8 allowlisted fixtures and 51 bars.
- Compared: 1,359 Pine assertion values, 764 retained Pine raw fields and 1,410
  MQL5 actual fields.
- Unexplained divergences: 0.
- Numeric tolerance: absolute `1e-8` plus relative `1e-12`; integer, time,
  ordering, side, reason and event identity remain exact.

## Tests and regression

| Command | Result |
| --- | --- |
| `py -3 -m unittest python.tests.test_cross_target_consistency -v` | PASS, 6 tests |
| `py -3 -m unittest discover -s python/tests -v` | PASS, 50 tests |
| `py -3 -m unittest discover -s scripts -p test_verification_tools.py -v` | PASS, 6 tests |
| `py -3 scripts/check_dsl_fixtures.py` | PASS, 6 canonical fixtures |
| `py -3 scripts/backtest_ui_fixtures.py --check` | PASS, 6 UI fixtures |
| `py -3 -m compileall -q scripts/verify_cross_target.py python/tests/test_cross_target_consistency.py` | PASS |

The PB-017 negative tests reject wrong hashes and evidence substitution; path
escape, duplicate JSON keys and oversized files; missing, duplicate,
out-of-order or altered Pine records; altered CSV/MQL5 accounting; incomplete
official-runtime status; malformed or duplicate fields; NaN/Infinity; and values
outside the declared tolerance. Inputs are copied synthetic evidence, and no
untrusted code, shell, URL, broker, DLL or WebRequest is executed.

Backend/frontend product code and dependencies are unchanged by PB-017. Their
required clean-checkout regression remains enforced by repository CI before the
Issue may be closed.

## Evidence limitations

Six Pine fixtures retain raw compact logs. The two earliest official runs retain
the complete-trace and assertion certification recorded by PB-015 rather than
copied raw log bytes; the report identifies this mode and does not invent raw
fields. Research simulators do not certify broker fills, ticks, margin,
liquidation, funding or future returns.
