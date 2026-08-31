# PB-008 tasks â€” Issue #12

- [x] Read requirements/current source/docs; create Issue before code; CNPM/test design.
- [x] Fixed provider/config/HTTP bounds/strict response boundary and stub tests.
- [x] V6 durable owned turns, context/idempotency/cancel/lease/version safety, real DB tests.
- [x] Explicit chat Ask AI/status/retry/cancel UI and asynchronous security tests.
- [x] Browser/current provider configuration check, regression/build/audit evidence.
- [ ] Real provider smoke with project server key (currently absent, no fake PASS).
- [ ] Scoped main commit/push/exactSHA/CI; close only if all DoD met.

## 31/08/2026 provider-neutral amendment (current)

- [x] Update Issue12/AC/use case/class/sequence/data/UI/security requirements before code.
- [x] Select one neutral provider at startup; keep OpenAI optional, add official Gemini without dependencies.
- [x] Preserve owner/session/CSRF/context/timeout/rate/output/no-tools boundaries; V13 keeps historical OpenAI provenance.
- [x] Add separate provider-neutral test Markdown, provider switching/wire/malformed/error/secret and HTTP/PG/race/migration/frontend cases.
- [x] Actual disabled-Gemini HTTP/PG restart and desktop/mobile browser checks with synthetic data only.
- [x] Final local regression/security/scope evidence and key-presence assessment:209 backend/209 frontend/44 Python PASS; Gemini key absent, stop.
- [ ] Actual synthetic Gemini smoke; absent GEMINI_API_KEY means STOP uncommitted/unpushed.
- [ ] Only after complete DoD: Vietnamese Refs #12 commit, normal main push, exact SHA/CI and completed Issue closure.

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
- [ ] Publish only after full DoD; stop on actual model/access rejection.
