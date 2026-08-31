# PB-027 revision history

- 31/08/2026 — P0 follow-up discovered in PB-013: old resource requests use the
  browser's current shared cookie with no expected workspace account. PB-013 has
  protected journal writes only. Issue16 created after PB-013 completed, before
  follow-up code. Preserve DONE business behavior while closing this boundary.

- 31/08/2026 — Reproduced baseline expected401/actual200 and stale logout204.
  Guard before logout, explicit per-workspace API identity, exact uncertain retry
  preservation; final141backend/166frontend and audits PASS. Browser two-tab
  write rejection and B session preservation verified. Publication/CI pending.
