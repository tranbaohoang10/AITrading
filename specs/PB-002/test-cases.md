# PB-002 Test Cases — Refs #5

Local environment: owned PostgreSQL cluster with synthetic random credentials;
Java21; HTTP on random loopback port. Never target the running user DB service.

| Test Case ID | AC | Objective | Preconditions | Data / Input | Steps | Expected Result | Actual Result | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FOUNDATION-T01 | 01 | Verify stack/toolchain | Official scaffold | Java21/Gradle9.7.1/Spring4.1.1 | Verify wrapper checksum; run --version and compile | Matching hashes; Java21 compiler/runtime; no Maven | Pending | NOT RUN | Wrapper output |
| FOUNDATION-T02 | 02 | Clean/repeat migrations | Fresh owned cluster | Flyway V1 | Start app; validate; migrate again | PostgreSQL actual; V1 valid; 0 repeated migrations | Pending | NOT RUN | JUnit |
| FOUNDATION-T03 | 03,04 | Minimal readiness and headers | Healthy DB | GET /api/health | HTTP request; inspect body/headers | UP only; no details; request UUID; nosniff/DENY/CSP/no-store | Pending | NOT RUN | JUnit |
| FOUNDATION-T04 | 04 | Default deny / no login | Anonymous | private/login/actuator/nonexistent paths | GET each path; default user lookup | 401 JSON; no HTML/redirect/user or request echo | Pending | NOT RUN | JUnit |
| FOUNDATION-T05 | 04 | CSRF/method controls | No token | POST/PUT/PATCH/DELETE/HEAD/OPTIONS | Send each method | Unsafe 403; private HEAD/OPTIONS denied | Pending | NOT RUN | JUnit |
| FOUNDATION-T06 | 04 | Reject forged claims and CORS | Anonymous | Bearer fake, malicious origin/request ID | GET private path | Denied; generated ID; no wildcard/origin reflection | Pending | NOT RUN | JUnit |
| FOUNDATION-T07 | 03,04 | Malformed paths and injection | Healthy schema | Double slash; semicolon; SQL-like query | Send paths/query; validate schema | Invalid paths 400; query cannot execute SQL; schema intact | Pending | NOT RUN | JUnit |
| FOUNDATION-T08 | 03 | Suppress error details | Mock exception only for secret detail test | Synthetic sensitive detail | Controller health failure | 503 minimal code/id, no internal detail | Pending | NOT RUN | JUnit |
| FOUNDATION-T09 | 02,03,05 | Real outage/restart | Owned pg_ctl cluster | Stop/start actual PostgreSQL | Stop only owned DB; health; restart; health/migrate | 503 while down; UP after restart; no remigration/data loss | Pending | NOT RUN | Real HTTP+DB |
| FOUNDATION-T10 | 05,06 | Reproducible delivery | Locked deps, CI | Fresh cluster/build | Harness + frontend regressions + dependency checks + CI | All pass, no unresolved high/critical vulnerability | Pending | NOT RUN | Commands/Actions |
| FOUNDATION-T11 | 06 | Scope/secrets and docs | Current diff | Source/docs/compose | Verify env-only credentials and git scope; inspect setup | No real secret/default password; unchanged old work; usable commands | Pending | NOT RUN | Git/static |
| FOUNDATION-T12 | 05,06 | Verification must fail closed | Python stdlib, no network/DB target | Incomplete/malformed OSV results, later-page advisory, cycle/timeout, failed cleanup | Run test_verification_tools.py | No false PASS for incomplete scan or running/unknown cluster; later-page finding retained | 6 tests pass | PASS | test-evidence/results.md |

## Executed results — 30/08/2026

The Pending/NOT RUN entries above preserve the pre-execution case definitions.
The following execution record is the current status and supersedes those entries:

| Cases | Actual Result | Status | Evidence |
| --- | --- | --- | --- |
| T01 | Official wrapper hashes match; locked Java21 compile/test/bootJar succeeds | PASS | results.md, wrapper properties |
| T02–T09 | 8 JUnit tests cover all listed behaviors with real HTTP/PostgreSQL, plus one sanitized exception test; 0 failures/errors/skips | PASS | test-evidence/backend-tests.json; results.md |
| T10 local portion | Fresh locked build, 27 frontend regression tests/lint/build, OSV 112 packages/no findings and npm audit zero | PASS (local) | test-evidence/results.md, dependency-audit.json |
| T10 CI portion | Must inspect actual Ubuntu Actions run after push; not inferred from Windows run | PENDING PUBLICATION | Issue #5 |
| T11 | Env-only credentials, loopback owned DB, no existing service mutation; final staged scope and secret scan required before commit | IN PROGRESS | Final results in Issue #5 |
| T12 | Partial/error/malformed/paginated/timeout scan and unknown/failed cleanup fault injection | PASS | test_verification_tools.py, results.md |

Evidence paths in this table are relative to this feature directory unless named
under scripts/. Full-stack auth/provider/product integration is not claimed.

User ownership/IDOR/JWT signatures, user password attacks, uploads/RAG/provider/
broker races are N/A until those features exist; forged identity must still fail
closed here. CSRF is tested, not disabled. DB outage is real, not inferred from mocks.
