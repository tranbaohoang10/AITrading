# Prototype Product Requirements

Source: Product Owner autonomous-mode request dated 30/08/2026; governance Issue #3.
These are retained requirements for later backlog work, not implemented features
or permission to start product work during the governance task.

## Fixed stack

React + TypeScript + Vite; Spring Boot Java 21; Gradle Kotlin DSL; PostgreSQL;
Flyway; Python when needed for backtest/AI. Do not substitute another stack.

## Strategy

Method-neutral; no default ICT/SMC. Support Dow Theory, Wyckoff, trendline, price
action, ICT, SMC, RSI, EMA, SMA and custom/hybrid approaches. Validated versioned
Strategy DSL is central; Python backtests, Pine Script and MQL5 derive from the
same DSL. Historical performance does not guarantee future profit.
No credit/payment implementation in the current phase.

## UI

Natural trading/fintech styling, with chart and data as the focus. Take layout
inspiration from LuxAlgo without copying it. Avoid generic AI-generated styling:
purple/blue AI gradients, glow, neon, sparkles, robot icons and excessive rounded
cards. Capture concrete visual acceptance criteria in each UI feature's Issue.

## AI Chat

Multiple conversations like ChatGPT; persistent conversations/messages; reopening
restores the correct context. A user can access only their own conversations.
Enforce ownership for list/read/write/delete and any retrieval/context operation,
with cross-user access tests. Do not treat hidden UI as authorization.

## Trading Journal

Profit by day/month, customizable date range, recorded entry reasons, chart next
to the journal, and AI/NLP assessment/feedback on entry reasons.
Define calculations, timezones and access/security behavior when designing the
corresponding feature; do not fabricate unstated financial rules.

## Existing work and current-task boundary

The local branch feature/mvp-ui contains previous UI implementation and re-review
commits. Issue #3 does not merge/cherry-pick them into main or modify their records.
Future product work must inspect existing branches/artifacts before duplicating
that work. This requirements document does not retroactively change old verdicts.
