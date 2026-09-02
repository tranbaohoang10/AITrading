# PB-026 — Prototype readiness and thesis artifact assembly

Issue: [#28](https://github.com/tranbaohoang10/AITrading/issues/28), created
02/09/2026 before implementation. Dependency PB-025 is DONE.

## Use Case Description

UC-PB026 lets a developer/operator start with the repository, identify the fixed
stack and safe configuration boundary, run the reproducible verification path,
inspect an honest capability matrix, and navigate all nine CNPM/thesis artifact
groups. Every implemented claim traces to an Issue, feature specification, test
case and evidence. Deferred broker/connector work and prototype limitations stay
explicit.

## Acceptance Criteria

- AC-01 reconciles every required/deferred PB state with Issue and evidence.
- AC-02 documents reproducible prerequisites, startup and locked test commands.
- AC-03 indexes all nine CNPM deliverable groups through valid local links.
- AC-04 derives overall use cases, physical/class views and ERD from current code
  and immutable Flyway V1–V17 migrations.
- AC-05 provides deterministic fail-closed readiness JSON/Markdown verification.
- AC-06 final backend/frontend/Python/security/dependency regression passes.
- AC-07 indexes actual responsive/accessibility UI evidence without redesign.
- AC-08 isolated verification needs no untracked input and cleans credentials.
- AC-09 scopes, publishes and verifies exact GitHub SHA/CI before Issue closure.

## Security and exclusions

The verifier bounds files, rejects traversal/symlinks/duplicate JSON/migration
tamper/stale claims and scans tracked text for credential shapes. It never reads
environment secret values or browser/account state. Only synthetic local data is
allowed. There is no broker login, order placement, live trading, payment/credit,
external target rerun, provider call, migration or product feature in PB-026.

## Definition of Done

AC-01–09 have executable evidence; nine artifact groups resolve; capability and
limitation claims agree with implementation and DONE evidence; full regression and
audits pass without high/critical finding; no secret/temp artifact is committed;
normal main push, exact SHA and required CI succeed before Issue #28 is completed.
