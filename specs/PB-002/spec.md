# PB-002 — Backend and PostgreSQL foundation

Issue: https://github.com/tranbaohoang10/AITrading/issues/5 (created before source).

## Mục tiêu

Provide a reproducible Java 21 Spring Boot API with Gradle Kotlin DSL Wrapper,
PostgreSQL/Flyway migrations and secure defaults that later authenticated business
features can build on. No replacement stack, in-memory DB substitution or fake DB
health. Real database integration must be tested before DONE.

## Phạm vi

backend/**, compose.yaml, scripts for local safe setup/testing, .github/workflows
for actual regression CI, .gitignore additions for build/test artifacts, README,
docs/{architecture,execution-state,product-backlog,revision-history/index}.md,
specs/PB-002/**. PB-001 remains unchanged except truthful delivery/backlog updates.
Do not touch old mvp-ui artifacts, protected governance or any existing stash.

## Use Case

UC-FOUNDATION-01: Developer starts a local research API with a disposable test
database and verifies readiness/security without exposing credentials or data.

## Use Case Description

Actor: developer/operator. Trigger: documented startup command. Preconditions:
Java21 and local Docker or dedicated disposable PostgreSQL; dependency internet
access. Flow: start named project DB → set environment credentials → Wrapper starts
API → Flyway migrates/validates → GET /api/health tests database and returns a
minimal state. Other endpoints default-deny. Restart preserves schema history.
Alternatives: invalid config/DB unavailable fails clearly without private error
detail in HTTP responses; invalid/anonymous requests produce JSON denial with a
generated request ID. Postcondition: runnable boundary, no user/trading data yet.

## Acceptance Criteria

- AC-FOUNDATION-01: Spring Boot supported stable release, Java21 compiler/runtime,
  Gradle Kotlin DSL Wrapper with verified jar/distribution checksums; no pom.xml.
- AC-FOUNDATION-02: Actual PostgreSQL + Flyway, append-only baseline migration;
  clean DB migration and repeated startup/validation pass; isolated test namespace.
- AC-FOUNDATION-03: GET /api/health reflects actual DB availability, contains no
  credentials/SQL/version detail; unknown/private endpoints default-deny with JSON.
- AC-FOUNDATION-04: No default generated user/password/login form; no wildcard CORS;
  CSRF not disabled; secure headers and generated correlation ID; error/logging
  avoids request content/token/SQL/password disclosure. No auth implementation yet.
- AC-FOUNDATION-05: Wrapper tests/build pass against real PostgreSQL, including
  denied methods/paths, error format, headers, malformed input, DB errors and
  idempotent migration. Frontend regression unaffected. Dependency risk assessed.
- AC-FOUNDATION-06: Document reproducible local/test commands, credentials via env
  (no tracked .env/password), architecture/trust boundaries and recovery. CI runs
  actual frontend/backend tests with a disposable DB; verify required run result.

## UI Requirements

No new UI. Existing demo frontend still does not call this foundation API; auth and
connected features follow. Health is machine-readable, not a fabricated dashboard.

## Data / ERD Impact

New PostgreSQL application schema and Flyway history; no user or financial tables
until their owning features. Migration is additive and tested on disposable data;
never reset an existing user database. Local compose storage is named for this
project; tests initialize their own disposable PostgreSQL cluster under ignored
tmp/ using installed PostgreSQL binaries, never the existing database service.

## Security Requirements

Default deny, loopback local binding, parameterized SQL health probe, bounded
connection/query timeout, no secret defaults in repository. Fixed error codes and
generated correlation IDs prevent echo/log injection. Do not disable CSRF or tests.
Dependency checks inspect maintained stable versions/license/advisories; no secrets
needed for public build registries. No broker/provider/external-account operations.

## Test Requirements

Separate test-cases.md with real PostgreSQL migration/restart/health/error tests,
anonymous method/path denial, security headers, request-ID spoofing and sanitized
failure responses. JDK21 Wrapper build/tests; frontend lint/build/tests/audit.
Record Docker/toolchain setup and CI results, not only compilation evidence.

## Definition of Done

All AC-FOUNDATION-01–06 verified; meaningful automated/local integration/security
tests pass, no unresolved critical/high dependency issue; setup/CNPM/test evidence
complete; diff/scope/secrets reviewed; Vietnamese commit with Refs, normal push to
main, exact remote SHA and CI verified; Issue explicitly closed completed.

## Dependencies

No product dependency; follows delivered PB-001. Use installed Java21 explicitly.
Docker is optional for local compose. Native PostgreSQL17 binaries are installed;
use them for isolated integration tests without touching the running user service.
Future PB-003 owns authentication/session/users, PB-024 owns full audit events.
