# PB-009 local and real-provider evidence — 01/09/2026

- Backend owned PostgreSQL harness: PASS, 235 tests; bootJar and dependency
  inventory PASS; final disposable cluster stopped and password file removed.
- Frontend: PASS, 25 files / 213 tests; TypeScript/Vite build and ESLint PASS.
- Python: PASS, 44 tests; scripts and Python sources compile.
- Dependency security: npm audit high PASS with 0 vulnerabilities; OSV audit
  PASS for 118 resolved Java compile/runtime/test coordinates with 0 findings.
- Provider contracts: Gemini and optional OpenAI use the same typed result union.
  Malformed, secret echo, timeout, 429/5xx, refusal and shared four-call bound
  fail closed in automated tests. No new dependency or provider fallback.
- API/DB/security: ownership of strategy plus conversation, expected account,
  session/CSRF, version/source binding, context hash, replay, cancellation,
  stale output, one pending attempt, DB constraints and explicit idempotent
  acceptance PASS. Provider output never appends chat or starts exports/backtests.
- Real Gemini: PASS with `gemini-3.5-flash`, two actual synthetic proposals.
  One was accepted into validated revision 2 and survived an actual API restart;
  one was rejected with strategy revision remaining 1. Owner denial, exact frozen
  context hash, replay and no chat assistant/automatic execution PASS. See
  `gemini35-generation-smoke.json`. No provider output or key is stored in evidence.
- Browser: real local API/PG plus Vite PASS. READY preview rendered inertly;
  accept required a confirmation and cancellation saved nothing. Mobile 390x844
  retained proposal/preview with document width = scroll width = 390. See
  `browser-ui.json`. All local processes stopped afterward.

An initial real attempt returned `AI_INVALID_RESPONSE` because the model combined
a proposal with questions. The application correctly stored FAILED and no revision.
The provider-neutral response schema was tightened to an official JSON Schema
`anyOf` union for mutually exclusive proposal/clarification shapes. Contract tests,
full regressions and subsequent real smoke then passed; no output was fabricated.

Publication: feature commit 9c1a2111b6f255802489866b44fc6878421aad3c is
verified on GitHub main. Actions run33462951447 SUCCESS; downloaded artifact has
235 tests,0 failures,0 errors,0 skipped and dependency audit0 findings. Issue21
was closed completed after AC/DoD PASS.

Limitations: external output wording remains nondeterministic and is never treated
as proof of profitability.
