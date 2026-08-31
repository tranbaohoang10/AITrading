# AI Trading Platform — Autonomous Prototype

This repository is a **PROTOTYPE/DRAFT** running in **AUTONOMOUS CODEX MODE**.
Codex performs analysis, design, documentation, implementation, tests and repair,
commits directly on `main`, pushes `origin/main`, and manages GitHub Issues.
No feature branch, Pull Request or intermediate Product Owner approval is required.

Every feature has an Issue before code, relevant CNPM documentation and its own
test Markdown. Codex runs functional/integration/regression/security checks,
fixes failures until PASS or a genuine hard blocker, commits with `Refs #...`,
verifies GitHub and closes the Issue only after its Definition of Done.

## Fixed stack and safety

- React + TypeScript + Vite.
- Spring Boot + Java 21.
- Gradle Kotlin DSL; backend commands use the Gradle Wrapper, never Maven.
- PostgreSQL + Flyway.
- Python when needed for backtest/AI.

Necessary dependencies and safe migrations can be handled autonomously.
No force push or history rewriting. Never weaken tests/security checks or commit
secrets/passwords/.env. Preserve old documents and fixed technology choices.
No credit/payment implementation in the current phase.

Strategy DSL is method-neutral and central to Python backtests, Pine Script and
MQL5 generation. Do not default to ICT/SMC. Historical results never guarantee
future profit.

## Requirements and governance

The [product requirements](docs/product-requirements.md) describe the intended
trading UI, persistent private AI Chat and Trading Journal; they are not a claim
that these features are implemented on main.

Read [AGENTS.md](AGENTS.md), the [Constitution](.specify/memory/constitution.md),
[autonomous workflow](docs/governance/prototype-workflow.md) and
[skill guide](docs/agent-skills.md).
[Historical governance](docs/governance/legacy/README.md) is preserved but inactive.

Governance [Issue #3](https://github.com/tranbaohoang10/AITrading/issues/3) changes
documents only and ends after commit/push verification and Issue closure.
It does not merge the existing product work from `feature/mvp-ui` or start the
next feature.

## Autonomous product build

The subsequent Product Owner request starts continuous product work. The durable
[master backlog](docs/product-backlog.md), [execution state](docs/execution-state.md)
and [CNPM index](docs/cnpm-index.md) track that run separately from governance #3.

The frontend foundation is recovered from feature/mvp-ui with provenance in
[PB-001](specs/PB-001/spec.md). It currently demonstrates responsive workspace,
read-only sample scripts and labelled synthetic chat/backtest data. It does **not**
yet implement a connected AI provider, persistent research content or real backtests.
PB-003 adds real authentication/account persistence around that demo workspace.

From frontend/ with Node 22.12+ (verified Node 24.8.0) and npm:

```powershell
npm ci --ignore-scripts
npm run dev -- --host 127.0.0.1
npm run lint
npm run build
npm test
npm audit --audit-level=high
```

Keep the dev server local. Branding is centralized in frontend/src/brand.ts.
The Java/PostgreSQL backend is implemented below; Python backtest/AI work remains
in the backlog. No production readiness is implied by the frontend demo.

## Backend foundation (PB-002 delivered)

Java21 is required; use backend/gradlew or backend/gradlew.bat for all backend
commands. Gradle distribution checksum is pinned. No global Gradle/Maven needed.

Run real isolated DB tests from the repository root with installed PostgreSQL
binaries (Windows default: C:/Program Files/PostgreSQL/17/bin; otherwise set
AITRADING_TEST_PG_BIN). The harness creates its own cluster under ignored tmp/,
uses random credentials, runs Wrapper tests/build and stops only that cluster:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
python scripts/test_backend.py
python scripts/check_dependencies.py backend/build/reports/dependencies.txt backend/build/reports/dependency-audit.json
```

For a persistent local developer DB, optionally use docker compose up -d db after
setting a unique AITRADING_DB_PASSWORD in your shell. No .env file is required or
committed. Set AITRADING_DB_URL to jdbc:postgresql://127.0.0.1:55432/aitrading and
AITRADING_DB_USER to aitrading, then run backend/gradlew.bat bootRun. Keep the password
in environment only; never paste it into Issues/logs. The API binds 127.0.0.1:8080.
GET /api/health reports DB readiness; unimplemented endpoints default-deny.

Stop local DB with docker compose stop db; do not delete its volume if data matters.
Applied Flyway migrations are never edited/reset. Test clusters are retained under
tmp/ after shutdown for diagnosis; they are never committed. Actual verification
and limitations live in specs/PB-002/test-cases.md, not inferred from setup commands.

## Authentication (PB-003 delivered)

The real UI entrypoint requires a server-verified account. Start the API on
loopback8080 and Vite on127.0.0.1:5173; /api is proxied to the backend. Register a
synthetic/local account, then sign in. Email is a normalized login identifier;
this prototype does not verify mailbox ownership or provide email password reset.
Never reuse a real service password for testing. Passwords are Argon2id-hashed;
sessions live server-side in PostgreSQL with HttpOnly/SameSite cookies and CSRF.
Use Account in desktop/mobile navigation to edit your name, change password or
sign out. Password change revokes all sessions and requires signing in again.
PB-003 is verified on GitHub at099d6a5, Actions33349231331 success, Issue6 completed.
PB-004 replaces the authenticated chat demo; chart/strategy/backtest samples remain
explicitly labelled until their own features.

For a completely disposable browser-test workspace, with installed PostgreSQL
binaries and JAVA_HOME pointing to Java21, run from repository root:

```text
python scripts/test_backend.py --serve
```

This mode builds/serves, **does not run tests**. Run npm run dev in frontend in a
separate terminal. The harness prints an owned tmp/pg-test-... directory and API
PID. Create the printed stop-api file to stop only that API and DB; create the
printed restart-api file to restart only that API against the same test database.
No production/user database is used. Test passwords stay in the process environment
and ignored temporary file, removed on shutdown; do not paste them in Issues.
Ordinary integration verification remains python scripts/test_backend.py.

For deployment beyond this local machine, provide TLS at a trusted endpoint,
Secure cookies and an explicit AITRADING_ALLOWED_ORIGINS value. Forwarding headers
are not trusted by default; do not expose the development proxy or HTTP API publicly.
The current feature is not a production identity/security certification.

## Persistent conversations (PB-004, verification in progress)

Sign in, open AI Chat on mobile/tablet or use the desktop chat pane. New Chat
creates an owned conversation. Save message persists text; it does not call an AI
provider yet. Select past conversations, rename, delete with confirmation, and
load more/earlier pages. Reload messages before retrying a stale-version conflict.
After an uncertain network save, Retry save keeps the same request ID and text
to avoid duplication. No automatic unsafe replay occurs.

Prototype limits:100 conversations/account,2000 messages/conversation,4000 characters
per message,120 mutations/account/15min; list pages20/default50max and message
pages50/default100max. Lists sort by creation time, newest first, so rename/send
does not shift page boundaries. Conversation deletion permanently removes its
messages; it is distinct from preserving Git/governance history. Do not store
secrets in research prompts. Provider/context generation follows PB-008.
