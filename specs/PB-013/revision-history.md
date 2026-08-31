# PB-013 revision history

- 31/08/2026 — Issue15 created after PB-012 completed. Read actual source/tests;
  journal remains placeholder. Before code: define exact linear trade accounting,
  settlement-unit filtering, exit-time reporting, source linkage and detailed tests.
- 31/08/2026 — Implement V8/JournalService/Controller, authenticated journal UI,
  exact BigDecimal reports, bounded identity/version ledger, source provenance and
  real gapped-chart lookup. No package, engine or applied migration changed.
- 31/08/2026 — Initial136backend/145frontend PASS; browser found native date/time
  entry did not update controlled state under actual browser interaction. Use
  explicit ISO text preserving partial UTC input; added regression (146frontend).
  Browser saved LONG net17/v1→v2, guarded draft, source deletion, responsive chart
  and JVM17504→2784 restart retained same journal5cce86a1-6e55-4ae5-bdeb-35f13f0886f2.
- 31/08/2026 — Review found post-response account checks insufficient for writes
  after another tab changes shared session. Bind unsafe journal requests through
  X-Workspace-User==authenticated principal; add actual HTTP negative test before
  SQL. Full regression and final browser cross-account verification in progress.
- 31/08/2026 — Final137backend/149frontend PASS; final API browser A write succeeds,
  stale A draft under B session is rejected and B remains empty. Added post-write
  identity429 and uncertain-delete foreign404 guards/tests. All owned test API/PG
  stopped with credential cleanup. Publication/CI verification remains next.
