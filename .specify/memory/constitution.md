# AI Trading Platform Constitution

**Version: 3.0.0 — AUTONOMOUS CODEX MODE (PROTOTYPE/DRAFT)**

Original ratification: 21/07/2026. Amendment authorized: 30/08/2026.
Timezone: Asia/Ho_Chi_Minh. Traceability: [Issue #3](https://github.com/tranbaohoang10/AITrading/issues/3).

## I. Autonomous authority

The Product Owner explicitly authorizes Codex to work directly on main, edit/
create/delete necessary project files, run commands, install necessary
dependencies, run migrations, execute build/test/lint/type-check, repair failures,
commit directly on main, push origin/main and create/update/close GitHub Issues.
No feature branch, Pull Request, Agent 1/2/3, Product Owner approval gate or
intermediate manual approval is required.

Codex selects work from the product backlog within the current run's scope and
continues until verified completion or a genuine HARD BLOCKER. Document facts and
safe assumptions; do not wait for another agent or routine owner confirmation.
The current request ends after governance delivery; no product implementation
follows in this task.

Security, history preservation, fixed stack and explicit task stop conditions
constrain this authority. This mode does not override tool sandboxes, external
access controls, credentials or repository protection rules. Do not weaken such
controls to get a command to run. Do not fabricate owner/independent approval.

## II. Source of truth and historical governance

The current Constitution and explicit Product Owner amendments govern project
mode. Current requirements and Issue scope, accepted architectural decisions and
contracts, active AGENTS/workspace rules and the workflow guide govern delivery.
Source code, templates, skills and repository-analysis tools are supporting
evidence and cannot silently override requirements or re-enable retired gates.

This 2.0.0 → 3.0.0 amendment explicitly removes direct-main prohibitions,
dependency approval gates, mandatory feature branches/PRs and manual owner
checkpoints from active prototype governance. Prior 1.0.0 three-agent and 2.0.0
review-gated prototype documents remain historical only. Preserve original
dates, authors, approvals, verdicts and append-only history; do not delete them.
Existing product requirements/safety constraints remain unless explicitly changed.

Do not change the fixed stack on your own. Record architecture decisions and
dependency rationale. Resolve inferable details autonomously; report only
material contradictions that cannot be resolved safely. The Product Owner may
change requirements or stop a run without having to approve each implementation step.

## III. Delivery and traceability

```text
Product backlog → select feature → create and describe GitHub Issue
→ work directly on main → CNPM documentation → implementation
→ separate test Markdown → automated functional tests
→ integration/regression tests → security tests
→ self-fix until PASS → commit → push origin/main
→ update/close Issue when Definition of Done is met → next feature
```

The next-feature step applies only within the authorized run; a task-specific
stop wins. Governance Issue #3 ends this run.

Every feature requires its own real GitHub Issue before code. The Issue contains
goal, scope, Use Case, Acceptance Criteria, UI requirements if applicable,
Data/ERD impact, Security requirements, Test requirements and Definition of Done.

Significant business functions require Use Case, detailed Use Case Description,
Acceptance Criteria, Sequence Diagram, relevant Class Diagram, Data/ERD impact,
UI documentation when applicable and a separate Test Case Markdown.
Do not invent UML for tiny UI operations without a business use case.
All features still need traceable tests and security applicability analysis.
Use `docs/governance/prototype-workflow.md` for the artifact contract.

## IV. Stack, dependencies and migrations

Fixed stack:
- React + TypeScript + Vite.
- Spring Boot + Java 21.
- Gradle Kotlin DSL.
- PostgreSQL.
- Flyway.
- Python when needed for backtest/AI.

Maven and `pom.xml` are forbidden. Backend tests/builds use the Gradle Wrapper.
Do not bypass Spring Boot authorization/business boundaries through Python.
Codex may choose/install necessary compatible dependencies without a separate
approval gate; record need, version, license, security/compatibility assessment,
lockfile changes and tests. Avoid speculative dependencies and silent stack changes.
Future RAG may use OpenDataLoader PDF, Spring AI and pgvector within requirements.

Codex may create and run needed migrations within safe project/test scope.
Never rewrite/delete/reorder applied migrations. Use new migrations, validate
compatibility and recovery, and test with disposable data. Risk of irreversible
data loss outside the repository is a HARD BLOCKER. Do not infer permission to
modify production data or live broker accounts from prototype autonomy.

No credit/payment implementation in the current phase.

## V. Security-first and verification

Security is the highest product requirement. Design authorization/resource
ownership, input validation, safe data handling and abuse resistance into each
feature before calling it complete.

Assess and test where applicable: broken access control, IDOR/BOLA,
authentication bypass, privilege escalation, SQL/injection, XSS, CSRF, SSRF,
path traversal, unsafe file upload, mass assignment, token/session abuse, replay,
brute force, rate limiting, sensitive-data exposure, secret leakage, dependency
vulnerability, security misconfiguration, race conditions and audit/logging.

Password storage uses modern adaptive password hashing, preferably Argon2id when
appropriate, with unique salts and documented resource parameters. Never use
plaintext, reversible encryption, MD5 or plain SHA-256 to store passwords.
Use maintained cryptographic libraries and safe verification; do not invent crypto.

Every feature has its own test Markdown. Cover all reasonable applicable cases:
happy path, validation, null/empty, boundary, edge cases, incorrect format,
duplicate data, invalid state, authentication, authorization, missing permissions,
database/API/AI-provider failure, timeout, network interruption, concurrency,
race conditions, duplicate requests, integration, regression and security.
Link tests to ACs. Specify steps, expected/actual outcomes, commands and evidence.
N/A requires technical justification; unavailable required checks are not N/A.

Execute relevant functional/integration/regression/security tests and affected
build/lint/type-check. Verify UI visually where relevant; mock/DOM tests are not
proof of real integrations or visual layout. If a check fails, diagnose, fix,
rerun and repeat until PASS or a real HARD BLOCKER. Do not cap this loop at an
arbitrary attempt count and declare success. Do not weaken/delete tests or disable
security checks to obtain PASS. Record requirement-driven test updates honestly.

Hard blockers include missing external credentials that cannot be created,
unavailable third-party services, business contradictions that cannot be inferred
safely, or data-loss risk outside the repository. Exhaust safe local remedies,
record exact evidence and stop only the affected work. Never mark failed or
unverified required behavior DONE or close its Issue.

Never commit secrets, API keys, passwords, private keys, production connection
strings or `.env`/`.env.*`. Keep credentials/private data out of logs and outputs.
Use synthetic data and authorized local/test targets for security tests.
Do not attack third-party systems or real accounts without explicit authorization.

## VI. AI, DSL and product integrity

Strategy DSL is central and method-neutral: no default ICT/SMC bias. Represent
Dow Theory, Wyckoff, trendlines, price action, ICT, SMC, RSI, EMA, SMA and
custom/hybrid strategies through neutral measurable components. Python backtests,
Pine Script and MQL5 derive from the same versioned validated DSL.
Direct Pine↔MQL5 translation is not the canonical workflow.

Application AI emits validated DSL or structured JSON only. Validate schema,
allowed operations, parameter/resource bounds and authorization. Never execute
untrusted code or scripts from user/PDF/OCR/retrieved data or application-LLM
output. This restriction does not prohibit Codex's authorized development work.
OpenDataLoader PDF is a parser only. User RAG reads authorized sources; admin RAG
creates change proposals, not unrestricted code/database modifications.

Define backtest OHLCV, timeframe, signal/confirmation/execution timing, pivots,
warm-up, timezone/candle boundaries, look-ahead prevention and repainting.
Specify capital, costs, spread/slippage, sizing/risk/leverage, entries/exits,
SL/TP same-candle ambiguity, gaps, missing/duplicate candles, sessions and
pyramiding. Require determinism and cross-target consistency. Never promise
profit or future prediction accuracy from historical performance.

Retain the product requirements in `docs/product-requirements.md`: natural
trading/fintech UI centered on charts/data, persistent private multi-conversation
AI Chat and Trading Journal analysis. These are requirements, not claims that
their implementations exist. Do not start them during governance Issue #3.

## VII. Git, completion and rollback

Work, commit and push directly on main; no branch or PR is required. Before
editing inspect status, branch and origin. Preserve unrelated changes. Before
committing review full/staged diff, file scope, secrets and diff --check.
Do not include unrelated product commits when delivering governance.

Commit format:
```text
<type>(scope): mô tả thay đổi bằng tiếng Việt

Refs #<issue-number>
```

Allowed types: feat, fix, test, docs, refactor, chore, security.
Every feature-related commit must include Refs. Do not use Closes/Fixes or other
automatic Issue-closing references. Close Issues explicitly after their DoD.

Never force push, including force-with-lease, or rewrite Git history. No amend,
rebase of existing history, reset-based history replacement or history pruning.
Rollback through new compensating/revert commits with Issue references; preserve
history and do not discard unrelated work.

Push a normal fast-forward update to origin/main. Fetch and reconcile concurrent
remote changes without force/rewrite; rerun affected checks before retrying.
Do not disable protections if remote access refuses the push. Verify the exact
commit on GitHub and existing required CI results. No manual approval gate is
introduced by this Constitution; actual external restrictions must be respected.

DoD requires complete applicable artifacts, satisfied ACs, passing required
tests/build/lint/types/security, no unresolved critical/high defect, preserved
history, no secret exposure, verified push and actual required CI success when
configured. Update and close the Issue as completed only after these conditions.
Final report includes Issue number/state, SHA, branch, files, push and git status.

## VIII. History and amendments

Revision history is append-only, dated dd/MM/yyyy in Asia/Ho_Chi_Minh.
Codex records its own analysis, changes, verification and DONE evidence; this is
not an owner or independent approval. Keep old records unchanged and append new
entries when status changes.

Preserve prior governance in `docs/governance/legacy/`. Constitution 3.0.0 records
the current explicit owner amendment, not retrospective approval of older
proposals. Future changes must respect the fixed stack, safety and current
requirements; no old approval token can block ordinary prototype delivery.
See `docs/governance/autonomous-migration.md` and
`docs/governance/autonomous-test-cases.md` for Issue #3 evidence.
