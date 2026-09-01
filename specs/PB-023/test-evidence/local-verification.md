# PB-023 local verification — 01/09/2026

All application/security inputs were synthetic. The adversarial smoke used an
owned disposable PostgreSQL cluster and loopback API only; it contacted no external
target. Temporary database credentials were removed after verified shutdown.

| Check | Result |
| --- | --- |
| `py -3 scripts/smoke_security.py --owned <owned-temp> --report specs/PB-023/test-evidence/adversarial-smoke.json` | PASS; two owners, actual HTTP/DB, hostile inputs, rate isolation and actual API restart |
| `py -3 scripts/test_backend.py` | PASS; Gradle clean/test/bootJar/inventory, 270 tests, 30 suites, 0 failed/error/skipped |
| `npm test -- --run` | PASS; 222 tests in 28 files |
| `npm run lint` / `npm run build` | PASS / PASS |
| `py -3 -m unittest discover -s python/tests -v` | PASS; 44 tests |
| `py -3 scripts/test_verification_tools.py -v` | PASS; 6 tests |
| `npm audit --audit-level=low` | PASS; 0 vulnerabilities |
| `py -3 scripts/check_dependencies.py backend/build/reports/dependencies.txt specs/PB-023/test-evidence/dependency-audit.json` | PASS; 121 resolved Java dependencies, 0 OSV findings |
| Presence-only/exact-secret/signature scan | PASS; key present, 712 files, 0 exact match, 0 credential-signature file; value never printed |
| `git diff --check` | PASS |

The first backend run failed 1 of 270 tests because a proposed explicit local
`secure=false` property overrode servlet HTTPS detection. The property was removed,
the deployment instruction now uses Spring Boot's standard environment override,
and the unchanged HTTPS Secure-cookie test passed in the clean full rerun. This
failed intermediate run is retained here as evidence that the regression was found
and fixed rather than hidden.

No unresolved high or critical finding remains. See `security-review.md` and
`threat-matrix.md` for dispositions and applicability limits.
