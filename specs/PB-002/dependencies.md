# PB-002 dependency decisions — Refs #5

The fixed stack is unchanged. Use Boot's stable dependency management and
Gradle lockfile; do not mix arbitrary versions. Java21 compatibility is confirmed
by actual compilation/runtime tests as well as the
[official Boot requirements](https://docs.spring.io/spring-boot/system-requirements.html).

| Dependency | Version | Purpose / choice | License evidence |
| --- | --- | --- | --- |
| Spring Boot webmvc/jdbc/security/validation/flyway starters | 4.1.1 | Required HTTP, validation, explicit SQL, security and migration integration; no ORM or alternate backend | Apache-2.0, published POM |
| Spring Security | 7.1.1 | Maintained server-side default deny and CSRF framework; future authentication stays here | Apache-2.0, POM |
| Flyway community core + PostgreSQL support | 12.4.0 | Fixed-stack versioned additive migrations | Apache-2.0 inherited from flyway-parent POM; [upstream](https://github.com/flyway/flyway) |
| PostgreSQL JDBC | 42.7.13 | Actual database driver, no H2 substitution | BSD-2-Clause, POM |
| Boot test starters / JUnit | 4.1.1 / 6.0.3 | Framework integration, HTTP/SQL assertions and controlled error injection | Boot Apache-2.0; JUnit EPL-2.0, POM |
| Gradle Wrapper + dependency-management plugin | 9.7.1 / 1.1.7 | Reproducible Kotlin DSL build and Boot dependency alignment | Apache-2.0; official Wrapper checksum verified |
| Python standard library | Installed 3.12 locally, runner Python3 | Disposable DB lifecycle and public OSV queries; no extra Python package | No new dependency |
| PostgreSQL binaries | 17.11 local; 16 CI | Real disposable integration; 17.11 optional Compose | PostgreSQL License; no production data accessed |

test-evidence/dependency-licenses.json records all 112 resolved Java coordinates
and declared/inherited POM licenses. Two POMs absent from local Gradle metadata
were retrieved directly from Maven Central. No unresolved license entry remains.
Transitives include Apache/MIT/BSD, EPL/EDL, LGPL-2.1-only and GPL2 with Classpath
Exception declarations; preserve upstream notices and applicable redistribution
obligations when distributing binaries. This inventory is not a legal opinion.
No library code or notices were removed/relicensed by this task.

test-evidence/dependency-audit.json records OSV coverage of compile/runtime/test
packages, with no findings on this run. Pagination is followed; incomplete,
malformed or failed API responses fail the check. Public Maven coordinates only
are sent, never source or credentials. npm audit reports zero findings for the
unchanged frontend lockfile. Locks/checksums plus a fresh locked build verify
resolution; CVE/advisory checks must be repeated for future changes.

The four CI actions are pinned to verified upstream release commit SHAs in the
workflow. Wrapper JAR/distribution hashes are checked against
[Gradle release checksums](https://gradle.org/release-checksums/).
