# PB-002 verification — Refs #5

Date: 30/08/2026 (Asia/Ho_Chi_Minh). Local Windows, Java 21.0.3,
Gradle 9.7.1, PostgreSQL 17.11. All tests target a newly initialized, owned
cluster under ignored tmp/ with synthetic random credentials, not the existing
postgresql-x64-17 service. The existing service remained Running.

| Command / evidence | Result |
| --- | --- |
| Wrapper JAR SHA-256 vs official Gradle checksum | 7a9ce74cff467ca1bf60a4fcd9f05185acceda4d0f382434d393e17864262c5d matches |
| Wrapper distribution SHA-256 pinned in properties | acd53f1edaf02f1a8ff99879f8a34b302661a057d9b063ae9e35b552f804d20a |
| python -m unittest discover -s scripts -p test_verification_tools.py -v | Exit 0, 6 tests; incomplete/error/paginated OSV response and shutdown fault injection |
| JAVA_HOME=Java21; python scripts/test_backend.py | Exit 0, fresh cluster, locked resolution without --write-locks; clean/test/bootJar/dependencyInventory executed |
| JUnit real HTTP/PostgreSQL | 8 tests, 0 failure/error/skipped; names in backend-tests.json |
| Owned database cleanup | pg_ctl stop succeeded; status confirms stopped; temporary password file removed |
| npm run lint; npm run build; npm test (frontend) | All exit 0; 27 tests pass, unchanged frontend source |
| npm audit --audit-level=high | Exit 0; 0 reported vulnerabilities |
| python scripts/check_dependencies.py backend/build/reports/dependencies.txt specs/PB-002/test-evidence/dependency-audit.json | Exit 0; 112 resolved compile/runtime/test coordinates; no OSV findings |
| Actual GitHub Actions / remote SHA | Pending publication; results must be recorded in Issue #5 after push |

Real integration covers initial/repeated Flyway migration, UTC connections,
minimal readiness, anonymous/private denial, no generated default account,
CSRF methods, security headers, forged bearer/request ID, hostile CORS origin,
rejected malformed paths, SQL-like query and actual DB stop/restart recovery.
One separate mock exception checks sensitive error-detail suppression; it is not
used as a substitute for the real DB outage test.

Failures corrected before this run: an unsupported Optional assertion prevented
test compilation; assertion rewritten with unchanged expectation. Windows pg_ctl
restart failed because control output and PostgreSQL output shared one locked log;
separate log files fixed the test lifecycle. Neither expected HTTP status nor
security configuration was weakened. Cleanup now fails the build if shutdown
cannot be verified, including partial-start failure.

No claim of production readiness, authenticated business behavior, AI or backtest
implementation. Docker Compose is optional setup only; its runtime was not tested
because the Docker daemon was unavailable. Native PostgreSQL integration was
tested directly. CI uses PostgreSQL 16 on Ubuntu and remains unverified until its
actual run succeeds. Vulnerability scans are time-specific public-advisory checks,
not proof that all flaws or OS/JDK binary vulnerabilities are absent.

## Published verification

Implementation commit90e3fbc and fix6bb886f are on GitHub main. CI run
[33319918002](https://github.com/tranbaohoang10/AITrading/actions/runs/33319918002)
completed/success at exact SHA6bb886f998120e9d20918be9a1c6ca750d75cd7f.
Both jobs succeeded; downloaded JUnit artifact confirms8 tests,0 failures/errors/skips.
Ubuntu PostgreSQL16 startup/restart/cleanup, locked build,6 verifier tests,
frontend regressions/audit and OSV112 packages passed. Initial run33319826155 failed
at pg_ctl startup; configuring Unix sockets inside the owned runner directory fixed
it. No tests/checks were removed. Final staged diff --check exit0; selected credential
patterns zero matches; protected mvp-ui/governance paths absent from the patch.
Issue#5 updated and CLOSED/completed with delivery evidence. PB-002 DoD achieved.
