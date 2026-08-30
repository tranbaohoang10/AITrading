# AUTONOMOUS CODEX MODE — Delivery Workflow

Active prototype guide under Constitution 3.0.0; [Issue #3](https://github.com/tranbaohoang10/AITrading/issues/3).
This replaces the earlier branch/PR/approval-gated prototype workflow.

## 1. Ordered delivery

1. Read the product backlog and select the next feature within the current run.
2. Create a distinct GitHub Issue before code; describe it fully using section 2.
   Check for the same existing feature Issue to avoid duplicates; never invent IDs.
3. Work directly on main. Inspect status/origin/history and protect unrelated work.
4. Create/update CNPM design and define ACs, task paths, risk and verification.
5. Implement the selected scope; install necessary compatible dependencies or run
   safe migrations when needed. Record rationale; keep the fixed stack.
6. Complete a separate feature test Markdown (designing cases before code is fine).
7. Run automated functional tests.
8. Run integration and regression tests.
9. Run applicable security tests, dependency/secret checks and affected
   build/lint/type-check.
10. Diagnose → fix → rerun until all required checks PASS or a real hard blocker.
11. Inspect full/staged diff and commit on main with Vietnamese text and Refs.
12. Push normally to origin/main, verify the exact commit on GitHub and existing
    required checks. Never force or rewrite history.
13. Update evidence and close the Issue completed only when its DoD is met.
14. Continue the next backlog feature within the run, without approval pauses.

No branch, PR, Agent 1/2/3 or Product Owner approval gate is required.
The current task stops after governance Issue #3: no product feature next.
External access controls remain binding. Do not disable repository protections
or CI to complete a push.

## 2. Issue and CNPM contract

Every Issue includes goal, scope, Use Case, Acceptance Criteria, UI requirements
if applicable, Data/ERD impact, Security requirements, Test requirements and DoD.
Each feature has its own real Issue and its own test Markdown, including small UI
changes. Link the Issue in the feature artifacts.

For significant business functions use:
- spec.md: Use Cases; Use Case Descriptions with actors, triggers, pre/postconditions,
  happy/alternate/error flows; stable ACs; UI/security requirements; exclusions; DoD.
- design.md: Sequence Diagram; relevant Class Diagram; Data/ERD impact; interfaces,
  ownership/trust boundaries, compatibility and migration/recovery analysis.
- plan.md or tasks.md: ordered Task IDs, paths, AC mapping and exact checks.
- test-cases.md: separate cases, coverage, actual results and evidence.
- revision-history.md and test-evidence/: append-only history and sanitized evidence.

Place product artifacts under specs/<feature-id>/. Governance-only work may use
docs/governance/; Issue #3 uses autonomous-migration.md and autonomous-test-cases.md.
Tiny UI changes without a business use case do not require separate UML.
No schema change means Data/ERD impact N/A with reason, not invented tables.
No UI impact means documented N/A. Design must not claim future features exist.

## 3. Test contract

Every feature's test Markdown records case ID, linked AC/UC/security requirement,
category, actors/permissions, preconditions, synthetic data, steps, expected and
actual results, automation command/file or manual procedure, evidence and defects.
Statuses are PASS, FAIL, BLOCKED, NOT RUN or justified N/A.
Unavailable required tooling/checks are NOT RUN/BLOCKED, not N/A.

Assess all reasonable applicable scenarios:
happy path; validation; null/empty; boundary; edge cases; incorrect format;
duplicate data; invalid state; authentication; authorization; missing permissions;
database failure; API failure; AI provider failure; timeout; network interruption;
concurrency; race conditions; duplicate requests; integration; regression; security.

Use meaningful assertions based on requirements, not current implementation.
Preserve regression coverage; legitimate test updates need requirement rationale.
Do not delete/disable/weaken tests to hide failures. Separate real integrations
from mocks and visual checks from DOM tests. Run build/lint/type-check for affected
code. Documentation-only changes can mark runtime checks N/A with precise reasons.

## 4. Security-first checklist

Assess every area and implement/test controls at the actual trust boundary:

| Area | Verification focus |
| --- | --- |
| Broken access control / IDOR/BOLA | Wrong-user/role/tenant and unauthorized read/write/delete/export; enforce ownership server-side |
| Authentication bypass / privilege escalation | Anonymous/expired/forged identity, altered roles and claims; no trust in client controls |
| SQL/injection attacks | Parameterization, strict validation and bounded DSL operations; no arbitrary execution |
| XSS | Stored/reflected/DOM inputs cannot inject executable HTML/script |
| CSRF | Protect cookie-auth state changes and reject invalid tokens/origins where relevant |
| SSRF | Validate schemes/hosts, redirects and private/internal destination access |
| Path traversal | Canonical paths stay inside allowed storage; reject encoded traversal |
| Unsafe file upload | Validate size/type/content, filenames, authorization and storage; archive/resource limits |
| Mass assignment | Whitelist writable fields; reject owner/role/security field injection |
| Token/session abuse / replay | Safe cookie/transport, expiry/revocation, fixation, token signature/issuer/audience and replay defenses |
| Brute force / rate limiting | Login/reset/API abuse, enumeration, concurrent bypass and resource exhaustion |
| Sensitive data exposure / secret leakage | Protect response bodies, errors, source, logs, artifacts and browser storage |
| Dependency vulnerability | Necessary maintained packages, manifests/lockfiles/advisories; record findings and fixes |
| Security misconfiguration | Safe defaults, environment isolation, least privilege, debug/CORS/error settings |
| Race conditions | Idempotency, duplicate requests, atomicity/transactions and concurrent ownership updates |
| Audit/logging | Relevant security events traceable without leaking secrets or private content |

Passwords use modern adaptive hashing, preferably Argon2id when appropriate,
unique salts, documented work/memory cost, maintained libraries and safe verification.
No plaintext, reversible encryption, MD5 or plain SHA-256 password storage.
Test rejection paths and ensure hashes/passwords never leak into responses/logs.
Use synthetic accounts/data and authorized local/test systems.

## 5. Self-repair and hard blockers

A code, test or build failure starts diagnosis and repair, then rerun. Repeat until
PASS or a genuine HARD BLOCKER; never call a skipped failure DONE.
Typical hard blockers: external credential cannot be created, third-party service
unavailable, contradictory business requirements cannot be inferred safely, or
data loss outside the repository. Attempt safe local remedies first, report the
exact blocker/evidence and leave the Issue open. A missing local dependency,
inferable choice or incomplete local document is normally self-service work.

## 6. Commit, rollback and DoD

```text
<type>(scope): mô tả thay đổi bằng tiếng Việt

Refs #<issue-number>
```

Types: feat, fix, test, docs, refactor, chore, security.
Every feature commit includes Refs. No Closes/Fixes or other auto-closing keywords.
Commit/push directly on main, without a mandatory branch or PR.
Never force push, rewrite history, amend/rebase existing commits or discard
unrelated work. Rollback uses new compensating/revert commits with Issue references.
Fetch and reconcile concurrent origin updates without force; rerun relevant checks.

DoD:
- Issue and applicable CNPM/test artifacts complete; ACs met.
- Required functional/integration/regression/security and affected build/lint/
  type-check pass, with evidence and justified N/A items.
- No unresolved critical/high defects, secret exposure, test tampering or
  unexplained out-of-scope changes.
- History preserved and documentation matches delivered behavior.
- Exact pushed commit verified on GitHub; existing required CI checks pass.
- Issue updated with evidence and explicitly closed completed.

No owner approval token or PR is a DoD requirement. Actual repository protections
and tool access controls are not bypassable. Final report lists Issue/state,
commit SHA, branch, changed files, push result and final working tree status.
