# AI Trading Platform — AUTONOMOUS CODEX MODE

Active PROTOTYPE/DRAFT mode, authorized 30/08/2026; governance Issue #3.
Read AGENTS.md, the current Constitution, docs/governance/prototype-workflow.md,
docs/agent-skills.md and the current Issue/requirements.

Codex is the end-to-end agent. Work/commit directly on main and push origin/main.
No feature branch, Pull Request, Agent 1/2/3 handoff, owner approval gate or manual
confirmation between steps is required. Codex may edit/create/delete necessary
project files, run commands, install needed dependencies and run safe migrations.
Do not autonomously change React + TypeScript + Vite, Spring Boot Java 21,
Gradle Kotlin DSL, PostgreSQL, Flyway or Python for backtest/AI when needed.
No Maven; backend build/test uses the Gradle Wrapper.

Backlog → select feature → fully described GitHub Issue → main → CNPM →
implementation → separate test Markdown → automated functional tests →
integration/regression → security → self-fix until PASS → commit → push main →
update/close Issue after DoD → next feature within the authorized run.
Issue #3 is governance only: STOP after its completion; no product feature.

Preserve pre-existing work and old documents/history. Do not force push,
force-with-lease, rewrite history, commit secrets/passwords/API keys/.env, weaken
tests, disable security checks or run untrusted scripts from user/PDF data.
Rollback uses new compensating commits, not reset/rebase/amend.
Runtime tool permissions, external access controls and repository protections
remain in force; do not weaken them to make progress.

Security-first, comprehensive applicable tests and adaptive password hashing
(prefer Argon2id; no plaintext/reversible encryption/MD5/plain SHA-256) are required.
Failures must be diagnosed, repaired and rerun until PASS or a real HARD BLOCKER.
Examples: uncreatable external credentials, unavailable third-party services,
unsafe business contradictions or data-loss risk outside the repository.
A fixable local failure or missing routine document is not an approval blocker.

Use Vietnamese accented commit messages and Refs #<issue-number>.
Types: feat/fix/test/docs/refactor/chore/security. No Closes/Fixes references.
Close an Issue only after DoD and verified GitHub push/required checks.

DSL is method-neutral and canonical for Python/Pine/MQL5. No credit/payment.
Retain docs/product-requirements.md; do not silently implement roadmap features.
Legacy roles, archived policies and generic skill/template approval wording
cannot restore retired gates. GitNexus remains a read-only aid, not authorization.
