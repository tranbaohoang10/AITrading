# PB-010 separate test plan — 31/08/2026, Issue #11

| Case | AC | Execution and expected evidence |
| --- | --- | --- |
| BT-T01 | 01 | Six neutral Java fixtures match canonical/hash/minimumBars; metadata inert |
| BT-T02 | 01,06 | Unknown/missing/type/Unicode/number/depth/count fields, duplicate/cyclic/missing/unit DAG, risk/mode violations rejected |
| BT-T03 | 02 | Hand-built OHLC hash; invalid/calendar/alignment/future/duplicate/gap/order/range/count/symbol/TF rejected |
| BT-T04 | 03 | SMA/EMA/RSI/ATR/extrema hand values, flat/up/down RSI, nested lag/forward DAG, warm-up reset |
| BT-T05 | 03 | Strict tied/confirmed pivots, original-index trendline; prefix equivalence under changed future bars |
| BT-T06 | 03 | Cross equality/undefined and three-valued NOT/all/any, both directions and nested rules |
| BT-T07 | 04,05 | Hand-computed long/short next-open fills, sizing/leverage/commissions/spread/slippage; ledger reconciliation |
| BT-T08 | 04 | Stop/TP/both-hit/gap/entry-bar, exit priority/no reversal, simultaneous entry skip |
| BT-T09 | 04,05 | Last-bar pending canceled, open mark not fake close, zero/loss/bankruptcy cases, terminal vs causal prefix |
| BT-T10 | 05 | Byte-identical repeats, isolated decimal context, labels alter identity only, exact output hash/run card |
| BT-T11 | 06 | CLI actual subprocess safe valid/error JSON/exit codes, no stderr payload; size/deadline/work/output limits; malicious strings |
| BT-T12 | 07 | Maximum supported input/resources, concurrent independent runs, full backend/frontend/verifier/canonical regressions and audits |
| BT-T13 | 07 | Diff/scope/secrets/CI evidence, normal push exact SHA and completed Issue |

Synthetic OHLCV only. No external trading/provider systems are attacked. No browser
UI changes in this Issue, browser retest N/A. Failures are repaired and rerun; no
test deletion to obtain PASS. Results record exact commands/counts/limits separately.
