# AI Trading Platform — Prototype / Draft

This repository is the **PROTOTYPE/DRAFT** of AI Trading Platform.
**Codex-only Prototype Mode** is the active development workflow.

The product direction is a method-neutral platform for converting prompts, images,
documents and trading rules into validated Strategy DSL, running deterministic
Python backtests, and generating Pine Script or MQL5 from the same DSL version.
This describes the direction, not a claim that every capability is implemented.
Historical performance never guarantees future profit.

## Fixed technology

- Frontend: React + TypeScript + Vite.
- Backend: Spring Boot + Java 21.
- Build: Gradle Kotlin DSL; use the Gradle Wrapper, never Maven.
- Database: PostgreSQL + Flyway.
- Python for backtest/AI when needed.
- Future RAG: OpenDataLoader PDF + Spring AI + pgvector.

Market-data integrations and generated-code targets remain feature-specific
roadmap items, not blanket permission to add dependencies or live trading.
Credit/payment is excluded from the current prototype.

## Prototype workflow

Product Owner requirement → Codex analysis → GitHub Issue → feature branch →
CNPM design → implementation → test MD → automated tests → security tests →
commit → push → Pull Request.

Codex performs this work end-to-end. The mandatory three-agent handoffs do not
apply. The Product Owner retains scope and PR approval authority.
Never push directly to main. Never force push. Never merge into main without
explicit Product Owner permission. Individual tasks can prohibit commits/pushes/PRs.

Read [AGENTS.md](AGENTS.md), the [Constitution](.specify/memory/constitution.md),
[prototype workflow](docs/governance/prototype-workflow.md) and
[skill guidance](docs/agent-skills.md) before work.

Strategy DSL must not default to ICT/SMC or privilege any trading method.
The [legacy inventory](docs/governance/legacy/README.md) preserves the previous
official-KL/three-agent workflow and the prior README; it is not active governance.
