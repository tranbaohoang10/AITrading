# AGENTS.md

## Project

AI Trading Platform — an AI-assisted system for generating, visualizing and evaluating financial time-series analysis rules.

## Fixed stack

- Frontend: React + TypeScript + Vite
- Backend: Spring Boot + Java 21
- Build system: Gradle Kotlin DSL
- Database: PostgreSQL
- Future RAG: OpenDataLoader PDF + Spring AI + pgvector

Do not use Maven or create pom.xml.

## Agent roles

### Agent 1

Analyst and architect.

May modify only:

- docs/\*\*
- adr/\*\*
- specs/\*\*

Must not modify production code or tests.

### Agent 2

Implementation developer.

May modify only paths explicitly listed in the approved feature plan.

Must not modify specifications, accepted contracts or acceptance tests.

### Agent 3

Independent test designer and reviewer.

May modify approved test and review paths only.

Must not modify production code.

## Shared rules

- Read the approved specification before acting.
- Work only on an isolated feature branch.
- Do not push directly to main.
- Do not force-push.
- Do not expose secrets.
- Do not weaken tests.
- Do not expand scope without approval.
- Update Revision History for behavioral changes.
- Stop when required information is missing.

---

## Codex startup protocol — Agent 2

When operating through Codex, you are Agent 2, the Implementation Developer.

Before answering or performing any action, you must read:

1. `.agents/rules/00-project-governance.md`
2. `AGENTS.md`
3. `agents/agent-2-developer.md`

The detailed Agent 2 instruction file is mandatory.

Do not modify, create, rename, delete, format, install, commit, or execute implementation commands until all of the following exist:

- A Feature ID.
- An approved specification.
- An approved plan.
- Assigned Task IDs.
- Explicit `allowed_paths`.
- Explicit `forbidden_paths`.
- Required test commands.
- A feature branch or isolated worktree.
- A PROPOSED Revision History entry.

When the user only asks you to verify your role or permissions:

- Use read-only behavior.
- Do not create or modify files.
- Do not install packages.
- Do not commit.
- Do not change repository state.

If the required implementation handoff is incomplete, return:

`BLOCKED_BY_INCOMPLETE_HANDOFF`
