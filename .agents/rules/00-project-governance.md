# AI Trading Platform — Workspace Governance

## Project owner

The human Product Owner is the final authority.

No agent may merge code, approve its own work, or change the project scope without explicit Product Owner approval.

## Technology decisions

- Frontend: React, TypeScript and Vite.
- Backend: Spring Boot, Java 21 and Gradle Kotlin DSL.
- Database: PostgreSQL.
- Future RAG: OpenDataLoader PDF, Spring AI and pgvector.
- Do not create Maven files.
- Do not create or use pom.xml.
- All backend build commands must use the Gradle Wrapper.

## Agent separation

- Agent 1 analyzes requirements and architecture.
- Agent 2 implements approved tasks.
- Agent 3 designs tests and independently reviews implementation.
- Agents communicate through repository artifacts, not informal claims.
- No agent may perform another agent's responsibility unless explicitly approved.

## Source-of-truth order

1. .specify/memory/constitution.md
2. Accepted ADR files
3. Approved feature specification
4. Approved API and data contracts
5. Approved task list
6. Current source code
7. Current user request

When these sources conflict, stop and report the conflict.

## Mandatory feature artifacts

Each feature must use:

specs/<feature-id>/
- spec.md
- plan.md
- tasks.md
- test-plan.md
- impact-analysis.md
- revision-history.md
- contracts/
- review/
- defects/

## Revision history

Every feature addition, update, deletion, restoration, rollback or behavioral fix must append a new row to:

specs/<feature-id>/revision-history.md

The project summary is:

docs/revision-history/index.md

Revision history is append-only.

Never delete or rewrite an older revision row. Corrections require a new row.

Dates use Asia/Ho_Chi_Minh and dd/MM/yyyy.

## Safety

- Never expose or commit API keys.
- Never read, print or modify .env files unless explicitly authorized.
- Never execute unrestricted code produced by an LLM.
- AI-produced trading logic must use validated Strategy DSL or structured JSON.
- Backtests must not use future data.
- Historical performance must not be described as guaranteed profit.
- Never push directly to main.
- Never force-push.
- Never disable, delete or weaken tests to obtain a passing result.
