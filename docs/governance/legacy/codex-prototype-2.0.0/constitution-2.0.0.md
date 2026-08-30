# AI Trading Platform Constitution — Prototype

**Version: 2.0.0 — Codex-only Prototype Mode**

**Original ratification: 21/07/2026**

**Mode change authorized by Product Owner: 30/08/2026**

**Timezone: Asia/Ho_Chi_Minh**

**Document changes: awaiting Product Owner review; not a PR approval or merge authorization.**

## I. Mode and authority

This repository is a PROTOTYPE/DRAFT. The Product Owner has explicitly authorized
Codex to perform analysis, design, code, tests, documentation, GitHub Issue
management, branch management, commits and Pull Requests end-to-end.

The mandatory Agent 1 → Agent 3 Phase A → Agent 2 → Agent 3 Phase B workflow is
retired for this mode. Separate-agent sign-offs, Phase A/B tokens and old
role-specific write restrictions are not prerequisites for prototype work.
Codex remains accountable for real verification and cannot call its own review
independent or approve its own Pull Request.

The Product Owner is final authority for scope, governance, accepted ADRs,
dependency/technology changes, PR approval and permission to merge into main.
Within a requested feature, Codex authors and maintains its specification, design,
tasks and tests without requiring a separate analyst or tester handoff.
Material ambiguity, scope expansion and unapproved technology changes still
require Product Owner resolution. Specific task restrictions remain binding.

## II. Source of truth and legacy transition

Project authority order:

1. This current Constitution and explicit Product Owner amendments to it.
2. Accepted ADRs.
3. Product Owner-authorized feature requirements and specifications.
4. Accepted contracts and the feature task plan.
5. Active `AGENTS.md`, workspace rules and prototype workflow.
6. Source code as implementation evidence, supporting tools, templates and skills.

Do not treat source code as permission to contradict requirements.
Report unresolved conflicts rather than silently choosing an interpretation.
The Product Owner's 30/08/2026 mode-change request explicitly amends the previous
role separation and approval workflow; that change is not blocked by legacy rules.

The unmodified Constitution 1.0.0 and previous active governance are retained in
`docs/governance/legacy/`. Old agent roles, proposals, approvals and Phase A/B
records remain historical evidence for the official-KL/legacy process. They do
not re-enable the old workflow in prototype mode. Existing product contracts,
acceptance criteria and safety constraints are not automatically invalidated.
Do not rewrite old approval states, dates, authors or test results.

Changing back to official-KL governance requires a new explicit Product Owner
decision; reading a legacy file or invoking a template cannot switch modes.

## III. Delivery workflow and required design

```text
Product Owner requirement
→ Codex analysis
→ create GitHub Issue
→ create feature branch
→ CNPM design
→ implementation
→ test MD
→ automated tests
→ security tests
→ commit
→ push
→ Pull Request
```

Each new product feature must have a separate GitHub Issue before its feature
branch and implementation. Record the real Issue URL/number in its artifacts.
CNPM means software-engineering analysis and design for the feature.

Every feature must include:

- Use Case and detailed Use Case Description.
- Acceptance Criteria with stable IDs and observable outcomes.
- Sequence Diagram for its interactions.
- Class Diagram for relevant classes/types/components and responsibilities.
- Data/ERD impact, including relationships, constraints and migrations when needed.
- UI requirements when applicable.
- Security requirements and threat/applicability analysis.
- Separate Markdown test cases with expected and actual results.
- Definition of Done and traceability from requirements to tests.

The artifact layout and acceptance checklist are specified in
`docs/governance/prototype-workflow.md`. Explicitly justify N/A impacts; do not
omit required analysis. Define scope/paths and exact test commands during design.
Tests may be designed or written earlier; the sequence never permits testing to
be omitted. Do not wait for another agent to create them.

## IV. Fixed stack and migration safety

- Frontend: React + TypeScript + Vite.
- Backend: Spring Boot + Java 21.
- Build: Gradle Kotlin DSL.
- Database: PostgreSQL.
- Migrations: Flyway.
- Backtest/AI: Python when needed.
- Future RAG components remain OpenDataLoader PDF, Spring AI and pgvector.

Maven and `pom.xml` are forbidden. Backend tests/builds use the Gradle Wrapper.
Do not move Spring Boot authorization/business responsibilities into Python by
default. A stack change requires a Product Owner-approved ADR; dependency changes
require explicit Product Owner approval. No dependencies are authorized merely
because they appear in a roadmap or generated design.

Never rewrite, delete, reorder or rename an applied migration. Schema changes use
new migrations with design, compatibility and rollback analysis. Destructive data
operations need explicit authorization and a retention/recovery plan.

Credit/payment implementation is excluded from the current prototype. Prototype
mode does not authorize real-money trading or production broker access.

## V. Verification and security-first development

Test all reasonable applicable cases: happy path, validation, boundary, edge case,
error handling, integration, auth/permission, concurrency, regression and security.
Use acceptance, unit, contract and integration tests appropriate to the change.
Check lint, types and build for affected modules. Verify UI visually when relevant;
DOM tests alone are not proof of visual layout.

Every security review must assess applicability of:
broken access control; IDOR/BOLA; injection; XSS; CSRF; SSRF; path traversal;
upload security; session/token attacks; brute force; rate limiting; privilege
escalation; sensitive-data exposure; secret leakage; dependency vulnerabilities;
and race conditions.

Security controls must be verified at the server/resource boundary when present,
not inferred from hidden UI elements. Test cross-user access and negative cases.
Run security tests only on authorized local/test environments and synthetic data;
do not attack third-party systems or real accounts.

Passwords require modern adaptive password hashing with unique salts and
documented work/memory parameters. Prefer Argon2id when appropriate. Never store
plaintext passwords, reversible password encryption, or plain MD5/SHA password
hashes. Use maintained implementations; do not implement custom cryptography.

Protect secrets in source, logs, generated artifacts and outputs. Do not expose or
commit tokens, keys, credentials, private documents, connection strings or
`.env`/`.env.*`. Do not read, print or modify secret files without explicit,
narrowly scoped Product Owner authorization. Inspect security tooling before use;
do not install unapproved
dependencies. Report unavailable scans as BLOCKED/NOT RUN with their impact.

Record commands, environment, exit codes and meaningful evidence. Never claim
tests ran when they did not. Do not weaken, skip, delete or change assertions to
hide defects. Legitimate test updates must follow changed requirements with
documented rationale and preserved regression coverage.

## VI. AI, DSL, RAG and trading integrity

The platform and Strategy DSL are method-neutral. ICT/SMC, Dow, Wyckoff, price
action, indicators and custom methods have no privileged executable status.
Strategy-family labels are metadata; execution uses measurable neutral DSL rules.

Validated versioned Strategy DSL is canonical for Python backtests, Pine Script
and MQL5. Test event-level cross-target consistency and document unavoidable
platform differences. Direct Pine-to-MQL5/MQL5-to-Pine translation is not canonical.

Application AI outputs only validated Strategy DSL or structured JSON, with
schema, whitelist, parameter-range, resource-limit and authorization validation.
Never directly execute unrestricted application-LLM-generated Python, Java,
JavaScript, shell, SQL or filesystem operations.

PDFs, OCR and retrieved text are untrusted data. OpenDataLoader PDF is a parser
only. User RAG searches, explains and cites authorized sources; admin RAG creates
change proposals only, never directly changes code, database logic or permissions.
Application-AI restrictions do not prohibit Codex's authorized repository work.

Backtest/indicator features must define OHLCV, symbols/timeframes, signal,
confirmation and execution timing, pivots, warm-up, timezones, candle boundaries,
multi-timeframe synchronization, look-ahead prevention and repainting behavior.
Define initial capital, sizing, risk, leverage, commission, spread, slippage,
entries/exits, SL/TP including same-candle ambiguity, gaps, missing/duplicate
candles, sessions and pyramiding. Identical data/configuration must be deterministic.
Historical performance does not guarantee future profit or prediction accuracy.

## VII. Git, GitHub and completion

Use ASCII feature branches: `feat/<issue-number>-<feature-name>`.
Do not implement directly on `main`.

Commits use:

```text
feat(scope): mô tả bằng tiếng Việt có dấu

Refs #<issue-number>
```

Do not use `Closes #...` in commits. PR references must also avoid automatic
Issue closure. Close an Issue only after implementation and all required testing
are complete and the feature Definition of Done is met; document evidence.

Never push directly to `main`. Never force push (including force-with-lease).
Never merge into `main` without explicit Product Owner permission for that merge.
Never self-approve PRs, disable branch protection, or disable required GitHub Actions.

Before committing, review staged files and exclude unrelated/pre-existing work.
A no-commit/no-push or documentation-only instruction limits the workflow for
that task. Do not advance to another product feature without a request.

Definition of Done requires complete feature artifacts, satisfied ACs, meaningful
test/security/regression evidence, affected lint/type-check/build passes, no
unresolved critical/high defects, accurate revision history, scope compliance and
no secret exposure. Required CI and Product Owner PR approval remain merge gates.
If CI is not configured or a required check cannot run, report the gap; do not
claim success. Do not require Agent 3 approval in prototype mode.

## VIII. Revision history and amendments

Maintain append-only `specs/<feature-id>/revision-history.md` and the project
summary `docs/revision-history/index.md`; governance-only changes may keep their
detailed record under `docs/governance/`.
Dates use `dd/MM/yyyy`, timezone `Asia/Ho_Chi_Minh`.
Codex may append PROPOSED, IMPLEMENTED and TESTED evidence under its own name.
Product Owner approval/VERIFIED records require actual Product Owner approval.
Never alter old authors, dates, status rows or verdicts to fit a new workflow.

Future amendments record reason, scope, impact, semantic version change and
Product Owner authorization. Major versions change responsibilities; minor
versions add principles; patches clarify wording. Codex can prepare amendments,
but cannot approve them on behalf of the Product Owner.

This 1.0.0 → 2.0.0 change replaces role boundaries for the prototype, retains the
fixed stack and safety rules, and adds the requested CNPM, testing and Git rules.
See `docs/governance/prototype-migration.md` for scope and review evidence.
