---
name: "stack-and-scope-lock"
description: "Preserve the fixed stack while choosing necessary dependencies autonomously."
compatibility: "AI Trading Platform"
metadata:
  project: "ai-trading-platform"
  owner: "product-owner"
---

# Stack and Scope Lock — Autonomous Prototype

Fixed stack: React + TypeScript + Vite; Spring Boot + Java 21; Gradle Kotlin DSL;
PostgreSQL + Flyway; Python when needed for backtest/AI.
Future RAG components remain OpenDataLoader PDF, Spring AI and pgvector.

- No Maven or pom.xml. Use the Gradle Wrapper for backend commands.
- Do not autonomously change the fixed technology stack.
- Necessary dependencies may be installed without an owner approval gate.
  Document need, version, license, vulnerabilities, compatibility and tests;
  preserve reproducible lockfiles. Avoid speculative dependencies.
- Keep core Spring Boot business, authorization and audit responsibilities in
  Spring Boot; Python must not bypass them.
- REST remains the default MVP service protocol. Extra infrastructure needs an
  actual requirement and documented trade-off, not hypothetical future use.
- Derive task paths and contracts from the current Issue and requirements;
  no Agent 1/2/3 handoff is needed.
- Create/test/run needed new migrations in safe project/test scope. Preserve
  applied migrations; data-loss risk outside the repository is a hard blocker.
