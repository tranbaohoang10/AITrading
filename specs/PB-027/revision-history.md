# PB-027 revision history

- 31/08/2026 — P0 follow-up discovered in PB-013: old resource requests use the
  browser's current shared cookie with no expected workspace account. PB-013 has
  protected journal writes only. Issue16 created after PB-013 completed, before
  follow-up code. Preserve DONE business behavior while closing this boundary.

- 31/08/2026 — Reproduced baseline expected401/actual200 and stale logout204.
  Guard before logout, explicit per-workspace API identity, exact uncertain retry
  preservation; final141backend/166frontend and audits PASS. Browser two-tab
  write rejection and B session preservation verified. Publication/CI pending.

## 31/08/2026 — PB-027 delivered; PB-015 selected

PB-027 commit7e741be780a94ce0279ecaa198a6460c1a73181b verified on local/main,
origin/main and GitHub after normal push. CI33376664265 SUCCESS; actual frontend
166PASS log and backend141/0/0/0 + OSV118 artifact verified. Issue16 CLOSED /
COMPLETED, comment5476292888. Tree clean after delivery. No protected old mvp-ui
re-review file included. All owned API/PG stopped and password files removed.

PB-015 Issue17 created before code. Implement versioned owned Pine v6 research
export, with custom closed-bar simulator to retain DSL stop-first/cost semantics;
never label native Strategy Tester or live orders equivalent. Actual TradingView
Pine Editor opens anonymously, but Add to chart on its default script opens Sign
in; no target compilation/runtime result available. PO notified to sign in using
a test account if available, no credential collection or bypass. Continue local
work and independent READY items; keep target validation unverified if absent.
PB-008 remains OPEN/BLOCKED#12 for actual project AI credentials/smoke.
