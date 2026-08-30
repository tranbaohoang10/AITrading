# Codex-only Prototype Workflow

This is the active delivery guide for the PROTOTYPE/DRAFT, under Constitution
2.0.0. Codex performs all stages; Product Owner authority and task limits remain.

## 1. Ordered workflow

1. **Product Owner requirement:** capture the requested outcome and exclusions.
2. **Codex analysis:** inspect working tree, existing behavior, constraints,
   dependencies, ambiguity and risks. Resolve material questions with the owner.
3. **Create GitHub Issue:** one distinct Issue per new product feature, with
   requirements, scope, initial ACs and links to the eventual artifacts. Record
   its actual URL/number. Check for an existing Issue for this same feature before
   creating a duplicate. If GitHub is unavailable, report the blocker and do not
   fabricate a number or proceed with an untracked new feature implementation.
4. **Create feature branch:** ASCII `feat/<issue-number>-<feature-name>` from the
   agreed base. Protect existing work; inspect branch/base/remote before changes.
5. **CNPM design:** complete the software-engineering artifacts below, including
   risks, allowed paths, compatibility, test scope and commands before coding.
6. **Implementation:** make scoped changes and update design when facts change.
   Material scope changes need Product Owner approval.
7. **Test MD:** complete the separate test-case Markdown document. Drafting test
   cases earlier during design is encouraged; this stage makes coverage explicit.
8. **Automated tests:** execute relevant acceptance/unit/integration/contract and
   regression checks plus lint, types and build.
9. **Security tests:** execute applicable security scenarios and dependency/
   secret checks; document evidence, limitations and unresolved findings.
10. **Commit:** inspect diff and staged files; include only this task's changes.
11. **Push:** push only the feature branch when permitted by the current request.
12. **Pull Request:** describe why, what, Issue reference, tests, security,
   limitations, compatibility and screenshots when relevant. Await owner review.

A request limited to governance/docs, or explicitly forbidding commits or pushes,
stops at that limit. No new product feature starts automatically. This guide
does not itself authorize deployments, live trading or external messages.

## 2. Required feature artifacts

Use `specs/<feature-id>/`. Each file identifies the feature and real GitHub Issue.

| Artifact | Required contents |
| --- | --- |
| `spec.md` | Goal, actors, scope/exclusions, Use Cases, detailed Use Case Descriptions, stable AC IDs, UI requirements when relevant, Security requirements, Definition of Done |
| `design.md` | Sequence Diagram, relevant Class Diagram, Data/ERD impact, boundaries, interfaces, trust boundaries, design trade-offs and compatibility |
| `plan.md` | Task IDs linked to ACs, dependencies, exact allowed/forbidden paths, test paths, implementation steps and commands |
| `test-cases.md` | Separate Markdown test cases; coverage matrix, expected results, actual results, evidence and unresolved defects |
| `revision-history.md` | Append-only analysis, design, implementation and testing history |
| `test-evidence/` | Relevant command outputs and supporting verification artifacts, sanitized of secrets |

A feature may retain existing `tasks.md`, `test-plan.md`, `data-model.md` and
`contracts/`; link rather than duplicate authoritative content. Existing
`specs/mvp-ui/**` remains intact. New requirements apply to new features and
newly requested changes; do not rewrite past records to pretend they used this mode.

Use Case Description includes UC ID, name, primary/secondary actors, trigger,
preconditions, main success flow, alternatives, error flows, postconditions and
linked ACs. ACs must describe measurable results, including rejection behavior.

The Sequence Diagram covers main interactions and significant failure paths.
The Class Diagram shows relevant classes, interfaces, types/components and
responsibilities; do not invent persistence classes for a UI-only feature.
Data/ERD impact is always assessed. If no persistent data changes, state N/A and
why; otherwise show entities, relationships, constraints, ownership, migrations,
retention and rollback impact. UI requirements include loading/empty/error states,
responsive behavior, accessibility and sensitive-data display.

## 3. Test-case Markdown contract

Every case contains:

- Test ID, linked UC/AC/security requirement and category.
- Preconditions, actor/permissions, environment and synthetic test data.
- Steps and observable expected results, including side effects.
- Automation file/command or explicit manual procedure.
- Actual result, evidence and PASS / FAIL / BLOCKED / NOT RUN.
- Defect reference or justified N/A where relevant.

Assess every category: happy path, validation, boundary, edge case, error,
integration, auth/permission, concurrency, regression and security.
For each, list cases or explain N/A; lack of a tool is NOT RUN/BLOCKED, not N/A.
Include empty/null inputs, min/max/off-by-one boundaries, duplicates, retries,
timeouts, partial failures and concurrent mutations where relevant.
Test outcomes must be derived from requirements, not copied from implementation.

Do not claim a visual review from DOM checks alone. Do not assert runtime
integration was tested when only mocks ran. Do not remove or weaken tests to hide
failures. Record legitimate requirement-driven test changes and regression impact.

## 4. Security checklist

Evaluate all rows for every feature; apply tests at the actual trust boundary.

| Area | Relevant verification |
| --- | --- |
| Broken access control / IDOR/BOLA | Anonymous, wrong-user, wrong-role and cross-tenant access to read/write/delete/export resources; enforce ownership server-side |
| Injection | Untrusted SQL/command/template/DSL inputs cannot change execution; parameterized queries and strict validators |
| XSS | Stored/reflected/DOM payloads render safely; no unsafe HTML injection |
| CSRF | State-changing cookie-auth requests reject missing/invalid protection and untrusted origins as appropriate |
| SSRF | URL fetches reject unauthorized schemes/hosts, internal addresses and redirect bypasses |
| Path traversal | Canonical path remains inside allowed storage; reject encoded traversal and unsafe filenames |
| Upload security | Size/type/content checks, storage isolation, authorization, malicious files, archive expansion limits and safe download handling |
| Session/token attacks | Expiry, revocation, logout, fixation/replay, signature/issuer/audience validation and secure transport/cookies where applicable |
| Brute force / rate limiting | Login/reset/API abuse limits and concurrent bypasses; avoid account enumeration and unbounded resource consumption |
| Privilege escalation | Roles/claims/ownership cannot be reassigned by untrusted input |
| Sensitive-data exposure / secret leakage | Responses, errors, logs, artifacts, source and browser storage do not expose credentials or unauthorized data |
| Dependency vulnerabilities | Review manifests/lockfiles and available advisory scans; record tool/date, findings, remediation or blocked verification |
| Race conditions | Concurrent writes, duplicate requests, idempotency, atomicity and transaction boundaries preserve invariants |

Password storage must use modern adaptive password hashing; prefer Argon2id when
appropriate. Require unique salts, documented work/memory parameters, safe
verification and a rehash/upgrade policy. No plaintext, reversible password
storage, plain MD5/SHA or custom crypto. Test wrong-password rejection and ensure
passwords/hashes do not leak in API responses or logs.
Select parameters with maintained implementation guidance when implementing;
this governance change adds no authentication implementation or dependency.

Use local/test systems and synthetic identities. Do not test attacks against
third-party systems or production accounts without explicit authorization.

## 5. Definition of Done and Issue lifecycle

Before calling a feature complete:

- Required Issue and artifacts exist, and AC/UC/test traceability is complete.
- Scoped implementation meets the ACs; diagrams/design match the delivered work.
- Applicable automated, security and regression checks pass; affected lint,
  type-check and build pass. Manual checks are recorded where needed.
- No unresolved critical/high defect, known scope violation, test tampering or
  secret exposure remains. N/A items have technical reasons; unavailable required
  checks are unresolved, not passes.
- Revision History and evidence describe the actual work and limitations.
- PR is linked to the Issue and required CI is passing. Product Owner approval is
  required before merge; no agent self-approval.
- Close the Issue deliberately only after the feature is fully tested and these
  conditions are met. Commit/PR creation alone is not completion.

Commits:

```text
feat(scope): mô tả bằng tiếng Việt có dấu

Refs #<issue-number>
```

No `Closes #...` in commit messages. Use `Refs #<issue-number>` in PR text too;
avoid all automatic closing keywords so closure cannot bypass testing.
Never push directly to main or force push. Codex may merge into main only with
explicit Product Owner permission for that merge, after the gates above pass.
