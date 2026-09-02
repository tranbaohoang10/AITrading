# PB-017 cross-target consistency report

Status: **PASS**. Numeric tolerance: absolute `1E-8` + relative `1E-12`.

| Fixture | Bars | Pine evidence | Pine asserted | Pine raw | MQL5 actual | Result |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| causal-all-indicators | 24 | RAW_COMPACT | 792 | 458 | 816 | PASS |
| costs-both-hit-gap | 6 | ASSERTION_CERTIFIED_RUNTIME | 126 | 0 | 132 | PASS |
| hand-next-open | 4 | ASSERTION_CERTIFIED_RUNTIME | 84 | 0 | 88 | PASS |
| long-target-cap | 3 | RAW_LEGACY_COMPACT | 63 | 32 | 66 | PASS |
| nonpositive-equity | 4 | RAW_COMPACT | 84 | 78 | 88 | PASS |
| rule-exit-before-barriers | 3 | RAW_COMPACT | 63 | 59 | 66 | PASS |
| short-target-cap | 3 | RAW_COMPACT | 63 | 59 | 66 | PASS |
| simultaneous-entries | 4 | RAW_COMPACT | 84 | 78 | 88 | PASS |

Totals: 8 fixtures / 51 bars; 1359 Pine assertion values, 764 retained Pine raw fields and 1410 MQL5 actual fields compared; unexplained divergences: 0.

## Limitations

- Pine uses binary floats while Python uses Decimal34; declared tolerance applies only to numeric fields.
- Two early Pine runs retain official complete-trace plus assertion certification rather than raw copied log bytes.
- Research simulators do not certify broker fills, ticks, margin, liquidation, funding or future profit.
