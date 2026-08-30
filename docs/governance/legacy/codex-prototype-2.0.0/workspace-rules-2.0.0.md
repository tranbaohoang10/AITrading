# AI Trading Platform — Active Prototype Governance

Mode: **Codex-only PROTOTYPE/DRAFT**, authorized by the Product Owner on 30/08/2026.

Read `AGENTS.md`, `.specify/memory/constitution.md`,
`docs/governance/prototype-workflow.md` and the current requirement before work.
Codex performs analysis, design, code, tests, docs, Issues, branches, commits and
Pull Requests end-to-end within the requested scope.

Do not require Agent 1/2/3 handoffs, Phase A/B or legacy approval/status tokens.
Legacy roles and `docs/governance/legacy/**` are historical reference only.
Current Constitution and prototype rules govern this repository; old product
specifications/contracts still constrain the corresponding product behavior.

For each new feature: separate GitHub Issue → ASCII
`feat/<issue-number>-<feature-name>` branch → CNPM artifacts → implementation →
separate test Markdown → automated/security tests → commit → push → PR.
Use the full workflow and required artifact checklist in the prototype guide.
Do not start another feature or exceed an explicit no-push/no-commit boundary.

Keep React + TypeScript + Vite, Spring Boot Java 21, Gradle Kotlin DSL,
PostgreSQL, Flyway and Python for backtest/AI when needed. No Maven or `pom.xml`.
Use the Gradle Wrapper for backend commands. Keep dependency/ADR approval controls.

Security-first and broad relevant tests are mandatory. Passwords use modern
adaptive hashing, preferably Argon2id when suitable; no plaintext or plain MD5/SHA.
Protect secrets, existing tests, migrations and append-only revision history.
Strategy DSL remains method-neutral; no privileged ICT/SMC. No credit/payment
implementation in the current prototype. No implicit live-trading scope.

Use Vietnamese accented commit descriptions and `Refs #<issue-number>`.
Do not use `Closes #...` in commits or automatic Issue-closing PR references.
Close Issues only after required testing and Definition of Done are satisfied.

Never push directly to main, force push or self-approve a PR. Never merge into
main without explicit Product Owner permission. Preserve unrelated changes and
separate pre-existing changes from task-created changes in reports.

GitNexus is a read-only aid, not permission or proof. Do not silently rewrite
governance, disable branch protection or weaken CI/security checks.
