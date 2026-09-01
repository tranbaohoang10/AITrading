# Official MQL5 runtime evidence — 01/09/2026 — Refs #18

All target work used the isolated portable build 6140 at
`H:\AITrading\tmp\pb016-target\terminal64.exe /portable`, on its synthetic
`PB016_SYNTH,H1` chart. The Open an Account prompt was cancelled; no broker
account was created or used. Algo Trading remained unchecked and New Order was
disabled. The research scripts only read the local `MQL5/Files` CSV sandbox.

## Positive event/accounting traces

The eight actual MT5 Experts traces were copied before this evidence update to
`runtime-logs/`. Each was checked with:

```text
python scripts/verify_mql5_trace.py --fixture backend/src/test/resources/pine/<name>.json --log runtime-logs/<name>.log
```

All comparisons PASS: causal-all-indicators (24 bars), costs-both-hit-gap (6),
hand-next-open (4), long-target-cap (3), nonpositive-equity (4),
rule-exit-before-barriers (3), short-target-cap (3), and simultaneous-entries
(4). The verifier compares source/hash, ordered events, fills, costs, quantity,
balance/equity and END accounting; it does not execute MQL5 itself.

## Negative CSV/runtime checks

Actual target logs previously recorded malformed/header/column/number/date/time,
price, duplicate/reversed/gap/size, traversal/extension/missing, Windows device
name and NUMERIC_RANGE rejection. Each produced an error and no successful END.
The last missing future-candle case was run at 15:30:10.017 on 01/09/2026 with
`long-target-cap`, `CsvFilename=future.csv`, `ConfirmCsvSymbol=BTC_USDT`,
`ConfirmCsvTimeframe=1h`, and `EmitTrace=true`. The portable Experts log emitted
the actual line `ERROR: CSV_INVALID row 2`; no result was produced. `future.csv`
contains only `2099-01-01T00:00:00Z`, so this confirms the future-data guard.

No source snapshot, parser fixture, Python simulation or fabricated log is used
as evidence of this official runtime result.
