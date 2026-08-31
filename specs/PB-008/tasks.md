# PB-008 tasks — Issue #12

- [x] Read requirements/current source/docs; create Issue before code; CNPM/test design.
- [x] Fixed provider/config/HTTP bounds/strict response boundary and stub tests.
- [x] V6 durable owned turns, context/idempotency/cancel/lease/version safety, real DB tests.
- [x] Explicit chat Ask AI/status/retry/cancel UI and asynchronous security tests.
- [x] Browser/current provider configuration check, regression/build/audit evidence.
- [x] Real provider smoke: Gemini3.5Flash PASS; earlier key-absent state historical.
- [x] Scoped main commit/push/exactSHA/CI; Issue12 completed after DoD.

## 31/08/2026 provider-neutral amendment (current)

- [x] Update Issue12/AC/use case/class/sequence/data/UI/security requirements before code.
- [x] Select one neutral provider at startup; keep OpenAI optional, add official Gemini without dependencies.
- [x] Preserve owner/session/CSRF/context/timeout/rate/output/no-tools boundaries; V13 keeps historical OpenAI provenance.
- [x] Add separate provider-neutral test Markdown, provider switching/wire/malformed/error/secret and HTTP/PG/race/migration/frontend cases.
- [x] Actual disabled-Gemini HTTP/PG restart and desktop/mobile browser checks with synthetic data only.
- [x] Final local regression/security/scope evidence and key-presence assessment:209 backend/209 frontend/44 Python PASS; Gemini key absent, stop.
- [x] Actual synthetic Gemini3.5Flash smoke; secure key available, two-turn restart PASS.
- [x] Complete DoD: Vietnamese Refs #12 commit, normal main push, exact SHA/CI and completed Issue closure.

No automatic independent-feature continuation while stopped for this amendment's
missing Gemini key. Resume newly READY features only after PB008 DONE.

31/08/2026 later resume: key is present, but real2.5Flash smoke FAILS with
provider404/new-user model unavailability. Real smoke/publication tasks remain
unchecked. Need a supported model decision before changing the specified2.5Flash
configuration; no secret values or permission-control changes.

31/08/2026 new PO decision supersedes that model-decision blocker:
- [x] Default Gemini3.5Flash in configuration only, explicit model override retained.
- [x] Update adapter wire contract, model/UI tests and two-turn synthetic smoke.
- [x] Rerun full applicable local tests for this model revision.
- [x] Real Gemini3.5Flash structured output/context isolation/persistence/restart PASS.
- [x] Published after full DoD; approved3.5Flash resolves earlier2.5 rejection.


31/08/2026 — PB-008 DONE, Issue #12 CLOSED / COMPLETED after full AC/DoD.
Feature a38c83d1a4a9a3524d4fa70df78c6a00d2c6ac42, UTF-8 evidence correction
b148333104a496e633ef67cd607b1351600426c4: both normal main pushes and exact
GitHub SHA verified. CI33408544142 and33408952000 both jobs SUCCESS; feature
artifact independently confirms211/0/0/0 JUnit and118 dependencies without findings.
Local209frontend/44Python and real Gemini3.5Flash synthetic two-turn structured/
context isolation/persistence/actual restart PASS. Secret/log/scope checks PASS.
Earlier2.5Flash model rejection and intermediate fixture timeout remain historical.
Owned smoke API/PG stopped, temporary DB password removed. No protected mvp-ui,
stack, dependency, governance, CI or security weakening. Next READY by priority/ID:
PB-009; PB-014/PB-018 also newly READY. Existing DONE work is not repeated.
