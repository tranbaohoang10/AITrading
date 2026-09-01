# PB-019 local verification — 01/09/2026

All image/provider inputs were synthetic. Real Gemini received one locally generated
320×180 chart only. The owned API and disposable PostgreSQL were stopped after an
observed restart, and the temporary credential file was removed.

| Check | Result |
| --- | --- |
| `py -3 scripts/test_backend.py` | PASS; 31 suites, 288 tests, 0 failed/error/skipped; V1–V17 and bootJar/inventory |
| `npm test -- --run` | PASS; 226 tests in 30 files |
| `npm run lint` / `npm run build` | PASS / PASS |
| `py -3 -m unittest discover -s python/tests -v` | PASS; 44 tests |
| `py -3 scripts/test_verification_tools.py -v` | PASS; 6 tests |
| `npm audit --audit-level=low` | PASS; 0 vulnerabilities |
| OSV resolved Java scan | PASS; 121 dependencies, 0 findings |
| Real `gemini-3.5-flash` synthetic image smoke | PASS; strict structure, canonical PNG, owner/account/CSRF, replay, persistence and actual restart |
| Presence-only/exact-secret/signature/log scan | PASS; key present; 689 non-ignored repository files; 0 exact matches, 0 signature files, no exact key in smoke log |
| `git diff --check` | PASS |

The first backend run completed 288 tests with one failure because the migration
contract still expected V16. The assertion was updated to V17 with an explicit new
table check; the clean full rerun passed unchanged feature/security tests.
