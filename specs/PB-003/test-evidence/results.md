# PB-003 final local verification — Refs #6

Date30/08/2026, Java21.0.3/Gradle9.7.1/PostgreSQL17.11/Node24.8.0.

| Check | Actual result |
| --- | --- |
| python scripts/test_backend.py (without --write-locks) | Exit0, clean/test/bootJar/dependencyInventory;22 tests =14 auth +8 foundation,0 failures/errors/skips |
| python -m unittest discover -s scripts -p test_verification_tools.py -v | Exit0,6 tests |
| frontend npm run lint / npm run build / npm test | Exit0,40 tests =13 auth contracts +27 regression; original10 bodies unchanged |
| npm audit --audit-level=high |0 reported vulnerabilities |
| OSV full Java inventory |118 compile/runtime/test coordinates, no findings; dependency-audit.json |
| Dependency licenses |6 new coordinates recorded; Session POM discrepancy retained and actual JAR/tagged-source Apache2.0 license verified |
| Test-output leakage scan | No synthetic password or Argon2 hash marker in final JUnit reports; no credentials copied into evidence |
| Real browser | Two-user auth/account/rename/password/logout, mobile390x844, retry after unavailable API, persisted profile/session across API restart; browser-results.md and screenshots |
| Owned resources | All browser-test APIs/DBs stopped through harness; latest integration cluster also verified stopped; temporary password files removed; original PostgreSQL service Running |
| Publication / CI | Pending until exact SHA and completed/success Actions are recorded in Issue#6 |

Test failures were fixed in production/configuration without weakened expected
results: numeric-to-text coercion and transaction rollback500 during actual DB
outage. Session cleanup/version checks deny stale principals; throttle counters
remain atomic. Password hashing uses maintained Argon2id, not custom cryptography.
Foundation migration test now expects V2 because this feature adds a migration;
V1 content/checksum and original frontend test bodies are unchanged.

Auth fixtures use synthetic data in owned databases only. Expiry/window/raced
session state is deliberately set in those fixtures to test negative paths without
waiting30 minutes; real HTTP authorization is still executed. API process restart
and actual PostgreSQL outage/recovery were separately executed, not mocked.

Local HTTP only on loopback. Secure cookie behavior is tested through the actual
Spring Session filter with a secure servlet request, not a public TLS deployment.
No mail verification/reset, MFA or external IdP is implemented or claimed. No
production readiness claim. Remaining trading/AI/chat content is still demo data
until its feature is delivered. Vulnerability scans are time-specific advisories,
not exhaustive security certification.

## Resume verification — 31/08/2026

Re-ran the current staged implementation before publication: isolated PostgreSQL
cluster pg-test-0frytzq5; Java21 locked clean/test/bootJar/dependencyInventory exit0,
22 JUnit tests with zero failures/errors/skips. Cluster shutdown verified and its
temporary password removed. Frontend lint/build and all40 tests passed; npm audit0.
Six verifier tests passed; fresh OSV118-coordinate scan returned no findings.
No product source changed during this re-verification. GitHub CI remains required
after commit/push; prior local/browser evidence above is retained.

## First published CI failure and recovery-test correction

Commit8015f21 pushed normally; Actions33348966758 passed frontend but failed one
of22 backend cases on Ubuntu/PostgreSQL16. Downloaded JUnit evidence pinpoints the
post-restart /me assertion: expected200, actual503; the preceding outage503 check
passed. This is not recorded as a successful delivery.

The original assertion conflated pg_ctl server startup with client-pool recovery.
The locked [HikariCP7.0.2 source](https://github.com/brettwooldridge/HikariCP/blob/HikariCP-7.0.2/src/main/java/com/zaxxer/hikari/pool/HikariPool.java)
uses a500ms alive-check bypass and asynchronous connection replacement. A transient
503 immediately after rapid Linux restart is consistent with stale pooled
connections; local Windows restart timing did not expose it. Do not alter private
Hikari system properties or automatically replay unsafe application mutations.

The recovery test now polls only safe GET /me for at most15s using the existing
Awaitility dependency. Every response must be200 or sanitized503;401/500 fail
immediately. Success still requires the identical authenticated user's profile;
permanent unavailability times out as failure. No auth/security assertion or test
was removed. Rerun local and actual CI before claiming the correction successful.

Correction local rerun31/08/2026: Java21/owned pg-test-eieztlv4 locked clean build
and all22 JUnit tests PASS, zero failures/errors/skips, safe cluster shutdown and
password removal verified. No dependency or frontend change in the correction.
