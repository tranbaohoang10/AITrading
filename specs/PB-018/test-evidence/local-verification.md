# PB-018 local verification — 01/09/2026

All data sent to the real provider was generated for this smoke. No user document,
credential value or provider response body is stored in this evidence.

| Check | Result |
| --- | --- |
| `py -3 scripts/test_backend.py` | PASS; 270 tests, 0 failures/errors/skips; boot JAR and dependency inventory PASS; disposable PostgreSQL stopped and password removed |
| `npm test -- --run` | PASS; 28 files, 221 tests |
| `npm run lint`; `npm run build` | PASS |
| Python engine regression | PASS; 44 tests |
| Verification-tool regression | PASS; 6 tests |
| `npm audit --audit-level=high` | PASS; 0 vulnerabilities |
| OSV resolved Java inventory | PASS; 121 coordinates, 0 findings; see `dependency-audit.json` |
| Real Gemini RAG smoke | PASS; 2 real turns, exact server citation hash, owner/CSRF/account isolation, idempotent upload and actual API down/up; see `gemini35-rag-smoke.json` |

The first integration runs correctly exposed two defects before this final PASS:
document routes were absent from the authenticated allowlist, and the generic body
wrapper pre-consumed multipart requests. Both causes were fixed and the complete
suite rerun. DELETE uses a bounded JSON version precondition consistent with the
existing private-write filter. No check was disabled or weakened.
