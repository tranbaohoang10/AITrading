# PB-010 — Deterministic Python backtest engine

31/08/2026. Issue [#11](https://github.com/tranbaohoang10/AITrading/issues/11)
created before implementation; depends on delivered PB-005/PB-006.

UC-BT-01: an offline research caller supplies one Strategy DSL1.0.0 and one
immutable closed UTC OHLCV dataset. Engine validates both, computes identities,
evaluates causal indicators/rules, executes next-open/protective fills and returns
reproducible traces/trades/equity/run card. Invalid, unsupported or over-budget
input returns a fixed error without partial results. No position is fabricated
or liquidated just because the dataset ends. History never guarantees profit.

| AC | Required behavior |
| --- | --- |
| BT-01 | Closed grammar, typed DAG, risk/warm-up revalidation; six Java canonical goldens match; no trusted client hash |
| BT-02 | Matching symbol/timeframe, exact decimal OHLCV, UTC/aligned/closed contiguous1..5000 bars; PB-006 dataHash |
| BT-03 | Every v1 indicator, lag/cross/three-valued condition; causal confirmed pivots/trendline; prefix invariance |
| BT-04 | Next-open one-position execution, exit priority/no reversal, conflict skip, sizing/leverage/costs, SL/TP/gaps/stop-first/end handling |
| BT-05 | Stable versioned run card/input/data/DSL/result hashes, timestamps/indices, closed trades/open position, equity/drawdown/accounting |
| BT-06 | Bounded offline stdin/stdout, strict data-only parsing, complexity/deadline/output budgets, safe fixed errors |
| BT-07 | Hand-computed and adversarial tests, full relevant regression/build/audit/CI, verified main SHA and explicit Issue closure |

Separate design/test-cases/tasks/revision history are mandatory. Data impact:
versioned JSON boundary only, no DB/migration or UI. PB-011 owns authenticated
Java jobs/persistence/cancellation and process supervision. PB-015/016/017 own
external generators/runtime equivalence. No broker, AI, payment or profit claim.

Security: no eval/shell/network/dynamic imports/caller paths; no credentials or
payload logging; reject unknown fields/duplicate keys/nonfinite/unbounded values.
DoD: all AC evidenced, scope/diff/secret checks, local tests and actual CI PASS,
Vietnamese Refs #11 commit, normal main push, exact remote SHA verified, then
close completed. No product-owner/inter-agent gate in autonomous mode.
