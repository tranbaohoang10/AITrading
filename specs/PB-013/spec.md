# PB-013 — Private Trading Journal and performance calendar

## Mục tiêu
Replace the authenticated Trading Journal placeholder with owned persistent manual
trade records, reasons/notes, monthly/daily realized P&L, custom date ranges and
the linked owned chart beside the journal. Do not implement AI scoring (PB-014).

## Phạm vi
Add Flyway V8 journal_entry and bounded write-idempotency metadata, authenticated
CRUD/summary APIs, responsive journal UI and optional owned dataset association.
Reuse auth/session/CSRF, existing market charts and shell. No new package/stack,
payment, broker orders, automatic backtest import, FX conversion or AI provider.

## Use Case
UC-JOURNAL-01 record/update/delete an owned manual trade and reason/notes.
UC-JOURNAL-02 inspect daily/current/other-month and custom-range realized results.
UC-JOURNAL-03 inspect a saved journal entry beside its linked owned candle chart.

## Use Case Description
An authenticated researcher opens Journal, chooses settlement currency and report
timezone, creates a manual OPEN or CLOSED linear trade, explicitly saves, and can
reopen/edit it with optimistic version checking. Fields include symbol/timeframe,
side LONG/SHORT, quantity, entry/exit prices and UTC times, entry/exit fees stated
in settlement currency, entry reason and notes. Optional dataset link must belong
to that account and match symbol/timeframe; it never places orders or imports
trades silently. Deletion requires explicit confirmation. Unsaved/uncertain edits
remain visible and cannot be overwritten by a late read or another account.

## Acceptance Criteria
- JOURNAL-01: persistent owned CRUD, OPEN/CLOSED field invariants, stale-version409,
  same-request replay without duplicate creation/write and bounded records/history.
- JOURNAL-02: exact realized gross=(exit-entry)*quantity*(LONG:+1,SHORT:-1),
  net=gross-entryFee-exitFee, recognized on exit time; OPEN positions excluded from
  realized totals until close. Quantity already expresses exposure; no invented
  leverage/margin/funding/contract multiplier or unrealized mark. Report currency
  is mandatory and amounts from different currencies are never summed together.
- JOURNAL-03: current month, previous/next month and explicit custom date range;
  daily calendar and totals consistent with trade detail; bounded <=366-day range,
  inclusive first date/exclusive following date, explicit IANA timezone and DST/
  month/year/leap-day behavior. UTC timestamps retained independently of grouping.
- JOURNAL-04: required bounded entry reason (quality assessed later), optional
  multiline notes, inert text, exact decimal inputs and useful empty/error/loading/
  saving/conflict/uncertain states. Drafts survive view changes; identity remount
  and server-account verification prevent cross-user result mixing.
- JOURNAL-05: selected entry optionally displays its owned dataset chart beside
  the journal on desktop and a usable stacked/toggled chart on small screens.
  Source deletion leaves the journal and monetary values intact with an explicit
  unavailable-chart state; no unrelated current-market data substituted.
- JOURNAL-06: meaningful functional/security tests and real browser/API/PG restart
  coverage; full regression/build/audits, exact main SHA and actual CI PASS before
  Issue completed. All evidence mapped to separate Markdown test cases.

## UI Requirements
Professional neutral calendar/list/detail layout within existing navigation.
Clearly label manual records and settlement unit. Color only actual P&L signs,
show zero/no trades explicitly and preserve exact text values. Month/date/currency/
timezone controls, entry form with OPEN/CLOSED distinctions, selection/draft guard,
save/retry/conflict and delete confirmation. No demo trade/calendar profits.

## Data / ERD Impact
New journal_entry belongs to app_user (cascade account deletion), versioned mutable
current trade data with optional dataset ID provenance. journal_write stores only
bounded request identity/hash/applied version for deduplication and cascades when
entry is deleted; no hidden retained private note bodies. Existing migrations
remain unchanged. Up to500 entries/account and100 accepted writes/entry; read
pages20(default)/50(max), notes/reason byte bounds and existing 16KiB body limit.

## Security Requirements
Owner/current-credential checks on all list/get/create/update/delete/report/chart
boundaries; no caller owner/P&L/role fields. Parameterized SQL, strict closed DTOs,
decimal/time/size validation, CSRF/rate limits, safe text and redacted failures.
Atomic user/entry locking and version checks prevent lost updates and duplicate
requests. No external URLs/files/scripts, secrets or untrusted HTML in UI/export.

## Test Requirements
Detailed Markdown ID/AC/objective/preconditions/input/steps/expected/actual/status/
evidence. Hand long/short/fees/zero/loss/OPEN→CLOSED accounting, currencies, decimal
boundaries, months/leap day/DST, invalid date/state/quantity/fees, paged ordering,
ownership/CSRF/auth/revocation/injection/XSS, duplicates/concurrency/stale saves,
DB rollback, deleted chart source, network/reload/restart and responsive browser.

## Definition of Done
All six AC groups implemented and evidence-backed; no mock outcomes, relevant
tests/security/build PASS, Vietnamese Refs commit/main normal push, exact GitHub
SHA and real CI verified. Close completed only then and continue next READY task.

## Dependencies
PB-003/#6 and PB-006/#9 DONE. Current selection follows delivery of PB-012/#14.
PB-008 real AI remains blocked; journal CRUD/reporting has no provider dependency.
