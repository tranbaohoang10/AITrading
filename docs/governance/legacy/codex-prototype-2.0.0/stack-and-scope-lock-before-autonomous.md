---
name: "stack-and-scope-lock"
description: "Preserve the approved React, Spring Boot, Gradle, PostgreSQL, and Python architecture and task boundaries."
compatibility: "AI Trading Platform; Codex and OpenCode agent-skills format"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Stack and Scope Lock

## Approved stack

- Frontend: React + TypeScript + Vite
- Backend: Spring Boot + Java 21
- Build: Gradle Kotlin DSL
- Database: PostgreSQL + Flyway
- AI/Quant: Python service
- RAG: pgvector with approved parsing and embedding components

## Rules

- Maven and `pom.xml` are forbidden.
- A technology or dependency change requires an approved ADR.
- Do not move core Spring Boot business responsibilities into Python without an approved ADR.
- Do not let the Python service bypass Spring Boot authorization, broker safety, or audit boundaries.
- REST is the default MVP service protocol; gRPC, queues, and streaming are introduced only when approved requirements justify them.
- Stay within assigned Task IDs, `allowed_paths`, and accepted contracts.
