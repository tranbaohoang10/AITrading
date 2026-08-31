# PB-008 revision history

- 31/08/2026: Issue #12 created before code, official Responses/Structured Outputs/
  data controls read, server-key presence check negative. Product Owner notified
  without requesting key in chat. Design/test plan distinguishes local verification
  from required real-provider smoke and allows independent backlog progress.
- 31/08/2026: Implemented fixed provider boundary, V6 owned durable attempts,
  explicit UI and local HTTP/PG/component/adversarial tests. Actual browser
  unconfigured state/responsive draft/restart verified. Corrected missing exact
  capability allowlist; retained assertions. Real provider key still absent;
  no AI smoke PASS or Issue completion claimed.
- 31/08/2026: Product Owner replaces mandatory OpenAI access with neutral startup
  provider selection and Gemini Developer API; Issue12 updated before amendment
  code. Added provider-neutral.md/test cases, shared JDK transport/strict protocol,
  optional OpenAI, Gemini adapter, V13 preserving prior migrations/provenance,
  provider/API/migration/frontend tests and synthetic-only privacy disclosure.
  No new dependency, stack/governance change or DONE feature reimplementation.
  Current evidence and stop-before-publication rule are recorded separately in
  test-evidence/provider-neutral-results.md; original evidence/history retained.
- 31/08/2026: Final local209backend/209frontend/44Python, migration/browser/restart,
  audits and scope checks PASS. One failed intermediate market503 retained with
  clean isolated rerun. GEMINI_API_KEY absent by presence-only checks after PASS;
  real smoke BLOCKED, Issue12 OPEN, no commit/push/next feature per current PO.
- 31/08/2026: PO configured Windows User Gemini key; presence-only confirmed.
  Real synthetic smoke failed with AI_PROVIDER_REJECTED; official full/minimal
  REST404 confirms2.5Flash unavailable to new users despite Models List200.
  Zero assistant messages; logs/DB key equality checks negative, owned API/PG
  stopped. Evidence appended, Issue12 still OPEN, no commit/push/next feature.


31/08/2026 — PO approves Gemini default gemini-3.5-flash; PB-008 resumes IN_PROGRESS.
Previous 2.5 Flash failure evidence retained. Model override stays server-configurable;
no provider-specific business logic, new dependency or fallback. Local regression
and real synthetic structured/persistence/isolation smoke pending for this revision.
Issue #12 approval receipt: https://github.com/tranbaohoang10/AITrading/issues/12#issuecomment-5480218688


31/08/2026 — Gemini3.5Flash real synthetic smoke PASS (two actual provider turns).
Structured answers validated by the production adapter and persisted at sequences
2/4; independently computed context hashes/counts1/3 match. Same-owner and other-
owner decoys excluded, owner/binding/CSRF denied, replay creates no duplicate.
Actual API12520→14444 restart retained sessions, exact messages and durable turns.
Owned DB contains two SUCCEEDED Gemini3.5Flash attempts and exactly two assistants;
no failed attempt, fake answer or raw provider output in evidence. Key equality
checks found no key in API/harness/smoke logs or stored messages. Both synthetic
accounts signed out. Evidence: test-evidence/gemini35-real-smoke.json and
test-evidence/gemini35-checks.json (211backend/209frontend/44Python, audits PASS).
PB008 is IN_PROGRESS pending publication, exact GitHub SHA and actual CI; do not
infer DONE from local smoke. Previous2.5Flash404 evidence remains historical.
