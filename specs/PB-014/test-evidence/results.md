# PB-014 verification — 01/09/2026

- Backend disposable PostgreSQL harness: PASS, 251 tests, V1–V15 migration,
  bootJar and dependency inventory. The first obsolete V14 assertion failed as
  expected after V15 and was updated; a test subclass route-name collision was
  diagnosed and fixed before the clean PASS.
- Frontend: lint PASS, production build PASS, 26 files / 216 tests PASS; npm audit
  reports 0 vulnerabilities. Contract validation checks exact keys, ordered rubric,
  score arithmetic/lifecycle, dirty draft blocking and inert hostile text.
- Python: 44 tests PASS on clean rerun; verification tools 6 PASS. One first-run
  Windows CPU watchdog fixture exceeded its 8-second harness deadline; the isolated
  rerun and subsequent full suite both PASS without product-code change.
- Java dependency OSV audit: 118 resolved coordinates, 0 findings.
- Real Gemini 3.5 Flash production-path smoke: PASS using only a synthetic journal.
  Four ordered criteria, exact saved-reason evidence, backend-computed score,
  idempotent replay, cross-owner denial and persistence through actual API restart
  verified. Notes were excluded from provider context. See
  `gemini35-journal-smoke.json`.
- Presence-only key check PASS. Exact configured key occurred 0 times in 28 task
  files. One generic credential-pattern hit is an existing synthetic security-test
  fixture in `AiTradingApplicationTests.java`, outside the changed V15 assertion;
  no real credential value was printed. `git diff --check` PASS.

The result assesses saved reason quality only. It is not financial advice, a trade
signal or evidence of profitability. External model wording remains nondeterministic;
trusted schema, evidence and score validation remain authoritative.
