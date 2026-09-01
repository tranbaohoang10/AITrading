# PB-009 test cases — Issue #21 — 31/08/2026

All actual statuses initially NOT RUN. Owned disposable PostgreSQL, synthetic
accounts, local HTTP adapters and no real keys in automated tests. Separate real
Gemini smoke is explicitly synthetic-only. Evidence goes under test-evidence.

| Case / AC | Inputs and steps | Expected |
| --- | --- | --- |
| G01 /01,02 | Both adapters, structured proposal/clarification, measurable trend/RSI/price-action/pivot/volume/custom/hybrid fixtures | Same neutral protocol, full validator, no model-specific business; missing rules clarify |
| G02 /01,05 | malformed/duplicate/unknown JSON, unsupported DSL, bad refs/future lag/risk, oversized/malformed UTF8, tool/thought/key echo | fixed failure; no READY/history mutation, no raw error or secret |
| G03 /01,04 | timeout/429/401/403/5xx/disconnect/refusal, ordinary chat and proposal concurrency | unchanged bounds and shared rate/concurrency, no redirect/fallback/retry |
| G04 /03 | A/B resource combinations, expected account/session/CSRF/origin/revocation, unknown owner/model fields |401/403/404/400; no cross-owner provider call or context |
| G05 /03,04 |20message/16000char boundary, latest user/expected versions, same-owner/other-owner decoys | exact context range/hash, safe stale rejection, immutable request fingerprint |
| G06 /04,05 | duplicate starts/different intent, pending/100attempt quota, cancellation/deletion/credential/source/strategy race | no duplicate call, expired40s lease terminal, stale output discarded |
| G07 /06 | READY accept, duplicate/concurrent accept, stale revision, invalid/clarification/rejected accept, transaction failure | exactly one revalidated immutable revision or safe rejection; no backtest/export |
| G08 /06 | Reject twice, cancel twice, terminal mutation, latest/reload/restart | consistent durable lifecycle and original provenance, no hidden provider replay |
| G09 /07 | source/strategy switch, dirty draft, account epoch, failed capability/HTTP, uncertain request | correct disabled/error/recovery state; no stale display or editor overwrite |
| G10 /07 | desktop/tablet/mobile real UI, scripted-looking preview, confirmation/cancel/reject | inert text, bounded layout, explicit acceptance and reload only |
| G11 /08 | full backend/frontend/Python, migration validation, audits, scope/secret checks | all applicable PASS, no old migrations/dependencies/security weakened |
| G12 /08 | actual Gemini with fully specified synthetic rules, preview validate, accept/reject, owner denial and actual restart | real provider proposal and persistent accepted revision proven; never stub substitute |

Output wording is nondeterministic; schema, semantic DSL and lifecycle invariants
are asserted. Automated fixture answers are never reported as actual Gemini.

## Result — 01/09/2026

G01–G12 PASS. Backend 235, frontend 213 and Python 44 tests PASS; Vite build,
ESLint, npm audit and OSV 118-coordinate audit PASS. Real Gemini produced two
synthetic proposals through the production boundary; accept/reject, trusted DSL
validation, owner isolation, exact context hash and actual API restart PASS.
Browser desktop/mobile proposal preview and confirmation PASS. Detailed evidence:
`test-evidence/results.md`, `gemini35-generation-smoke.json`, `browser-ui.json`
and `dependency-audit.json`. Publication/CI status is recorded separately.
