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

- docs/**
- adr/**
- specs/**

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
