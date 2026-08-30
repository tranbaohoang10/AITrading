# PB-002 revision history — append-only

| Date | Performer | State | Evidence |
| --- | --- | --- | --- |
| 30/08/2026 | Codex | PROPOSED | Issue #5 before source; Java21/Spring Boot/PostgreSQL/Flyway, real isolated DB verification |
| 30/08/2026 | Codex | IMPLEMENTING | Official Initializr 4.1.1; verified Gradle9.7.1 hashes; isolated native PostgreSQL test harness because Docker daemon unavailable; existing service untouched |
| 30/08/2026 | Codex | IMPLEMENTED / TESTED LOCALLY | Locked clean build, 8 real HTTP/DB tests, 6 verifier fault tests, 27 frontend regressions; OSV 112 packages and npm audit no findings; CI/publication pending in Issue #5 |
