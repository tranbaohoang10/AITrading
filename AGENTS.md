# AI Trading Platform — AUTONOMOUS CODEX MODE

Active mode: **AUTONOMOUS CODEX MODE — PROTOTYPE/DRAFT**.
Authorized by the Product Owner on 30/08/2026. Traceability: [Issue #3](https://github.com/tranbaohoang10/AITrading/issues/3).

## Authority and startup

Codex performs analysis, design, documentation, implementation, testing, repair,
GitHub Issue management, commits and pushes end-to-end. Work directly on `main`;
commit on `main` and push directly to `origin/main`. No feature branch, Pull
Request, Agent 1/2/3 handoff, Product Owner approval gate or intermediate manual
approval is required in this prototype mode.

Read the current Constitution, this file, workspace rules,
`docs/governance/prototype-workflow.md`, `docs/agent-skills.md`, the current
request/Issue and relevant requirements/source/tests. Inspect working tree,
branch, remotes and history before edits. Preserve unrelated existing work and
report it separately. Never silently include it in a commit.

The current Product Owner instruction supersedes earlier prototype restrictions
on direct-main work, dependency approval and mandatory PR review. The Product
Owner can change direction, scope or stop conditions at any time. Archived
governance, old role files, templates and skills cannot reinstate retired gates.

## Autonomous permissions and limits

Within the project and selected backlog task, Codex may create, edit or delete
necessary files, run commands, install necessary dependencies, run migrations,
build/test/lint/type-check, fix failures, commit/push main and create/update/close
Issues without asking for confirmation between these steps.

Keep changes justified by the Issue and acceptance criteria. Assess dependencies
for necessity, license, compatibility and vulnerabilities; update lockfiles and
test. No separate dependency approval gate is required. Do not change the fixed
technology stack on your own. Preserve applied migrations; create new migrations
and verify them against disposable/test data. Data-loss risk outside the repository
is a hard blocker requiring resolution, not permission to proceed blindly.

Tool sandbox, credentials, external access controls and repository protections
still apply. Use normal authorized tool escalation where necessary; never edit
permission controls, disable protections or weaken security to force completion.

Never force push (including force-with-lease), rewrite Git history, remove old
documents/history, commit secrets/API keys/passwords/`.env`, or weaken/delete
tests and security checks just to obtain PASS. Roll back through new compensating
commits with Issue references, never destructive history edits.

## Workflow

```text
Product backlog
→ select next feature
→ create GitHub Issue with full requirements
→ work directly on main
→ CNPM documentation
→ implementation
→ separate test Markdown
→ automated functional tests
→ integration/regression tests
→ security tests
→ diagnose and fix until PASS
→ commit
→ push origin/main
→ update/close Issue after Definition of Done
→ next feature within the authorized run
```

Every feature has an actual Issue before code and its own Markdown test file.
Use Case, Use Case Description, Acceptance Criteria, Sequence Diagram, relevant
Class Diagram, Data/ERD impact and UI documentation are required for significant
business functions. Tiny UI-only changes do not require artificial UML.
Security requirements and Definition of Done must be explicit.
See the workflow guide for Issue fields, test coverage and evidence.

The current governance task **stops after publishing governance and closing
Issue #3**. Do not start a product feature in this task. For later backlog runs,
continue autonomously within the run's scope and stop conditions.

## Failure handling

If code/test/build fails: diagnose → fix the cause → rerun → repeat until PASS
or a genuine HARD BLOCKER. Missing local setup, recoverable errors and incomplete
documents are work to do, not reasons to request routine approval.

Hard blockers include unavailable external credentials that cannot be created,
unavailable third-party services, conflicting business requirements that cannot
be inferred safely, and risk of data loss outside the repository. Resolve what
is safely possible first; report evidence and the exact external requirement.
Do not call incomplete/failed verification DONE or close its Issue.

## Fixed stack and product constraints

- React + TypeScript + Vite.
- Spring Boot + Java 21.
- Gradle Kotlin DSL; backend builds/tests use the Gradle Wrapper.
- PostgreSQL + Flyway.
- Python when needed for backtest/AI.
- No Maven or `pom.xml`; no unrequested stack substitution.

Strategy DSL is the method-neutral canonical representation. Do not default to
ICT/SMC. Support Dow Theory, Wyckoff, trendline, price action, ICT, SMC, RSI, EMA,
SMA and custom/hybrid approaches through neutral components. Python backtests,
Pine Script and MQL5 derive from the same versioned validated DSL.
No credit/payment implementation at this stage. No implicit live-money trading.
Retain the UI, persistent private AI Chat and Trading Journal requirements in
`docs/product-requirements.md`; this document does not claim they are implemented.

## Security and test obligations

Security is the highest product requirement. Cover appropriate happy path,
validation, null/empty, boundary, edge cases, format, duplicates, invalid state,
authentication/authorization/missing permissions, database/API/AI-provider
failure, timeout, network interruption, concurrency/races, duplicate requests,
integration, regression and security scenarios.

Assess broken access control, IDOR/BOLA, authentication bypass, privilege
escalation, SQL/injection, XSS, CSRF, SSRF, path traversal, unsafe upload, mass
assignment, token/session abuse, replay, brute force, rate limiting, sensitive-data
exposure, secret leakage, dependency vulnerabilities, security misconfiguration,
race conditions and audit/logging. Record applicability and negative tests.

Passwords use modern adaptive hashing, preferably Argon2id when appropriate.
No plaintext, reversible password encryption, MD5 or plain SHA-256. Use maintained
libraries, unique salts and documented cost parameters; never custom crypto.
Keep secrets out of source, logs, output and commits; do not read secret contents
unless narrowly necessary and authorized. Security tests target local/test systems
with synthetic data, not arbitrary third parties.

Application AI outputs validated DSL/structured JSON only. Never execute
untrusted code/scripts from user data, PDFs, OCR, retrieved content or application
LLM output. User RAG stays within authorized sources; admin RAG proposes changes,
not direct code/database mutations. GitNexus is read-only evidence, not authority.

Backtests require no future data/look-ahead, defined repainting and pivot
confirmation, signal/confirmation/execution times, warm-up, timezone/candle
boundaries, costs, sizing/leverage, SL/TP ambiguity, gaps/missing/duplicate candles
and deterministic output. Historical returns never guarantee future profit.

## Git, evidence and completion

Commit descriptions use Vietnamese with accents:

```text
<type>(scope): mô tả thay đổi bằng tiếng Việt

Refs #<issue-number>
```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, `security`.
Every feature-related commit requires `Refs #<issue-number>`.
Do not use `Closes #` or `Fixes #`, or other automatic closing references.
Only close an Issue explicitly after its Definition of Done is met.

Before commit inspect status, complete diff, diff --check and staged scope.
Run relevant build/lint/type/test/security checks and fix failures. Push only a
normal fast-forward update, verify the exact SHA on GitHub, and inspect existing
required CI results. Do not disable CI/protections when they block a push.

Maintain append-only revision history dated dd/MM/yyyy in Asia/Ho_Chi_Minh.
Record facts, commands, exit codes, applicability and limitations. DONE is
Codex's evidence-backed completion, not a claim of independent or owner approval.
Report Issue number/state, commit SHA, branch, files, push result and final status.
