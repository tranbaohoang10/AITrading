# PB-002 revision history — append-only

| Date | Performer | State | Evidence |
| --- | --- | --- | --- |
| 30/08/2026 | Codex | PROPOSED | Issue #5 before source; Java21/Spring Boot/PostgreSQL/Flyway, real isolated DB verification |
| 30/08/2026 | Codex | IMPLEMENTING | Official Initializr 4.1.1; verified Gradle9.7.1 hashes; isolated native PostgreSQL test harness because Docker daemon unavailable; existing service untouched |
| 30/08/2026 | Codex | IMPLEMENTED / TESTED LOCALLY | Locked clean build, 8 real HTTP/DB tests, 6 verifier fault tests, 27 frontend regressions; OSV 112 packages and npm audit no findings; CI/publication pending in Issue #5 |
| 30/08/2026 | Codex | CI FAILURE / FIXING | Commit 90e3fbc pushed; Actions 33319826155 frontend passed, backend failed at pg_ctl start before Gradle. Unix socket directory was inherited from Debian package default, outside runner ownership; explicitly keep it under the owned test directory and expose bounded fresh-init startup diagnostics on failure. CI must rerun; Issue stays open |
