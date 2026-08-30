# PB-002 tasks — Refs #5

| Task | AC | Paths | Evidence |
| --- | --- | --- | --- |
| T01 | 01 | backend build/wrapper | Official versions/license/checksums; Java21 gradlew --version |
| T02 | 02,03 | backend resources/migration/api | Actual isolated PostgreSQL migrate/health/outage/restart tests |
| T03 | 04,05 | backend security/filter/tests | Default deny, no auto user, headers/CSRF/CORS/forged request ID/malformed paths |
| T04 | 05,06 | scripts/test_backend.py, CI, compose | Safe owned-cluster lifecycle, Wrapper build/locks/audit, frontend regressions |
| T05 | all | specs/docs/backlog/README | Record results and actual CI; commit Refs #5, push/verify/close |

Canonical local command from root: set JAVA_HOME to Java21, then
python scripts/test_backend.py --write-locks (first lock generation only).
Subsequent verification omits --write-locks. Harness runs the Gradle Wrapper;
it must not silently substitute a mock/in-memory database.
