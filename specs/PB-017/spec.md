# PB-017 — Cross-target event consistency

Issue: [#26](https://github.com/tranbaohoang10/AITrading/issues/26). Created
01/09/2026 before implementation. Dependencies PB-010, PB-015 and PB-016 are DONE.

## Goal and Use Case

UC-PB017 lets the Product Owner verify that Python, official Pine and official
MQL5 evidence from the same neutral DSL and synthetic dataset agree at bar/event/
accounting level. Final profit alone is insufficient. Missing, stale, tampered or
unexplained evidence fails closed.

## Acceptance Criteria

- AC-01 binds fixture name, DSL/data/result hashes, source hashes and target
  versions; only eight allowlisted repository fixtures are read.
- AC-02 compares warm-up/rules/indicators where asserted, signal, confirmation,
  next-open entry/exit, fill/cost/quantity, skips, exit reason, PnL,
  balance/equity and dataset-end state by bar.
- AC-03 decisions/time/order/side/reason are exact. Numeric comparison uses only
  absolute `1e-8` plus relative `1e-12`; NaN/Infinity are rejected.
- AC-04 all eight shared fixtures PASS Python↔Pine↔MQL5. Pine evidence mode is
  reported honestly: retained raw compact trace or official runtime assertion
  certification. No generated source string alone counts as target execution.
- AC-05 deterministic JSON/Markdown report and CLI; no network, broker, login or
  target rerun is required.
- AC-06 malformed/duplicate/missing/out-of-order/tampered/oversized/path-escaping
  evidence and tolerance boundaries have negative tests.
- AC-07 docs, test Markdown, regression/security, scoped diff, normal push,
  exact GitHub SHA and CI PASS before Issue completion.

## Security and DoD

Strict bounded parsers; repository-root path confinement; no eval/shell/URL/DLL/
WebRequest, secret or private-strategy input. Synthetic evidence only. All AC and
tests must pass with zero unexplained divergence and no high/critical finding.
