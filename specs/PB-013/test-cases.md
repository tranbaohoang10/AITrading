# PB-013 — Trading Journal test cases

31/08/2026 · Refs #15. Synthetic local accounts/data only. Initial status is
NOT RUN; replace actual/status with measured evidence, never inferred PASS.

## JRN-T01 — Owned durable CRUD

- AC: JOURNAL-01,04. Objective: save/reopen/edit/delete real private records.
- Preconditions: migrated disposable PostgreSQL, two authenticated users A/B.
- Input: OPEN LONG TEST_USD, quantity2, entry100, entry fee1, UTC time, reason and notes.
- Steps: create; read/list; edit to CLOSED exit110 fee2; reload; stale edit/delete;
  correct delete; inspect ledger/account cascade and reopen missing ID.
- Expected: version1→2, exact text retained, gross20/net17; stale409; delete204,
  missing404; no orphan data, B unchanged.
- Actual: PASS: real HTTP create OPEN, close/editv2, exact text/read/list, stale409, delete204/404 and ledger/account cascade. Browser v1→v2 persisted after JVM restart.
- Status: PASS. Evidence: [execution record](test-evidence/results.md),
  [backend results](test-evidence/backend-summary.json), source test case names.

## JRN-T02 — Exact accounting and currency isolation

- AC: JOURNAL-02. Objective: verify independently calculated monetary values.
- Preconditions: A has LONG/SHORT/open/closed records in one report period.
- Input: quantity0.3 entry0.1 exit0.2 fee0.001+0.002 (gross0.03/net0.027),
  SHORT100→90 quantity2 fees3 (net17), loss, fee-only loss, zero, max inputs,
  second settlement unit and OPEN record with entry fee.
- Steps: save each; read detail, paged list, daily and total reports per currency.
- Expected: exact decimal strings; losses/zero/win counters correct; OPEN excluded
  from realized fees/P&L until CLOSED; no rounding or cross-unit sum.
- Actual: PASS: hand long/short17, decimal0.027, loss−23, fee-only−3, zero, max999999999999999999990000; USD total−8.973 and separateUSDT17; OPEN excluded.
- Status: PASS. Evidence: [execution record](test-evidence/results.md),
  [backend results](test-evidence/backend-summary.json), source test case names.

## JRN-T03 — Dates, DST, range and pagination

- AC: JOURNAL-03. Objective: local-day reporting with identical list predicates.
- Preconditions: fixtures at UTC/local midnight, leap day and DST boundaries.
- Input: Asia/Ho_Chi_Minh, America/New_York spring/fall transitions, year/month
  changes,1/366/367-day ranges, same activity timestamps, malformed cursors.
- Steps: query inclusive dates; compare list with daily totals; page with limit1;
  switch month/custom range/timezone in UI and select a day.
- Expected: no missed/double-counted boundaries; zero days included; invalid400;
  no duplicate pagination within unchanged report, units/zone/range explicit.
- Actual: PASS: actual PG spring23h/fall25h, UTC/HCM midnight, leap/year boundaries,366days, stable equal-time pagination and filter-bound cursor rejection. Browser custom01–03/01 total17.
- Status: PASS. Evidence: [execution record](test-evidence/results.md),
  [backend results](test-evidence/backend-summary.json), source test case names.

## JRN-T04 — Validation and resource bounds

- AC: JOURNAL-01,04,06. Objective: reject ambiguous or excessive input atomically.
- Preconditions: authenticated A; baseline record/count captured.
- Input: null/missing/unknown fields, numeric instead of string, NaN/exponent,
  negative/zero/excessive/9-decimal amounts, invalid state/exit combination,
  future/sub-millisecond/reversed dates, Unicode/control/reason/notes byte limits,
  declared/chunked16KiB+1 bodies,500-entry and100-write limits.
- Steps: send boundary valid and invalid requests; inspect data/ledger counts;
  race last quota slots; replay accepted requests at limit.
- Expected: exact boundaries accepted; invalid400/oversize413/quota409;
  no partial writes, no quota overrun, valid replay still resolves.
- Actual: PASS: bounded DTO/string/amount/time/Unicode/body tests; no partial rows; concurrent500entry admission and100write ceiling/replay verified.
- Status: PASS. Evidence: [execution record](test-evidence/results.md),
  [backend results](test-evidence/backend-summary.json), source test case names.

## JRN-T05 — Ownership, session and web security

- AC: JOURNAL-01,04,05,06. Objective: enforce server-side isolation and safe text.
- Preconditions: A/B authenticated, anonymous client, owned/foreign dataset.
- Input: foreign/missing entry IDs and dataset IDs, mismatched market, forged
  owner/P&L fields, SQL/script/path/URL-like reason, invalid CSRF/Origin, revoked user.
- Steps: read/edit/delete/report all paths; try association and malformed bodies;
  inspect API redaction and inert DOM; switch session in another tab before late read.
- Also send valid B cookie/CSRF with A/missing/wrong X-Workspace-User during create,
  edit and delete: expect401 and no new/changed B records. This is not an owner selector.
- Expected: foreign404, anonymous/revoked401, CSRF/Origin403, strict fields400;
  no B data, execution, external request or sensitive exception; UI clears mismatch.
- Actual: PASS: real two-user/anonymous/revoked/CSRF/Origin/foreign-source/mass-assignment tests. Valid B session + A/missing workspace header denied401 before create/edit/delete; B row/ledger unchanged. Browser inert reason verified.
- Status: PASS. Evidence: [execution record](test-evidence/results.md),
  [backend results](test-evidence/backend-summary.json), source test case names.

## JRN-T06 — Idempotency, races, rollback and rates

- AC: JOURNAL-01,04,06. Objective: no duplicate writes, lost updates or false success.
- Preconditions: real transactional PostgreSQL and authenticated A/B.
- Input: same UUID/same intent; changed intent; stale expected version; parallel
  writes/read/delete; DB trigger-induced failure; read300/write60 rate boundary.
- Steps: race create/update; replay after later edit and deleted dataset; induce
  ledger failure then retry; race stale delete/edit; exhaust per-user buckets.
- Expected: one accepted version/entry; changed intent409; replay returns current
  entry plus original appliedVersion; rollback no residue; redacted503;429isolated.
- Actual: PASS: duplicate/stale/concurrent read-update-delete, current-entry replay, ledger-trigger rollback503, account500/version100 and atomic per-user rate boundaries.
- Status: PASS. Evidence: [execution record](test-evidence/results.md),
  [backend results](test-evidence/backend-summary.json), source test case names.

## JRN-T07 — Draft, retry and stale frontend state

- AC: JOURNAL-04. Objective: preserve intent through network failures/navigation.
- Preconditions: controlled delayed API responses and real provider context.
- Input: dirty form, first definite400, uncertain timeout then429 retry, late
  selection/range/chart/save responses, stale409, account switch.
- Steps: navigate/refresh/new; cancel/confirm discard; save/retry same payload;
  change selection/range while reads pending; reopen view/mobile pane.
- Expected: explicit dirty guard; no erased draft; uncertain exact UUID frozen;
  no hidden write retry; older/account-mismatched response never replaces current.
- Actual: PASS:14 component tests plus4 journal API tests; dirty/uncertain429/definite400/409, late range/identity, linked chart/deleted source and exact ISO partial/millisecond input. Acknowledged-write identity429 retains UUID; another-account404 never proves deletion. Full149frontend/lint/type/build PASS.
- Status: PASS. Evidence: [execution record](test-evidence/results.md),
  [backend results](test-evidence/backend-summary.json), source test case names.

## JRN-T08 — Linked chart and responsive real browser

- AC: JOURNAL-05,06. Objective: view journal beside correct owned real candles.
- Preconditions: API+PG+frontend, synthetic uploaded matching dataset and two users.
- Input: saved linked record inside/outside candle range; source then deleted.
- Steps: create/edit/reload; view1600/900/390 widths and keyboard controls; inspect
  reason/chart/date controls; delete source; restart owned API and reopen; B isolation.
- Expected: actual saved P&L, independent linked chart, explicit unavailable/no-link
  states, no substituted market; responsive usable controls; persisted after restart.
- Actual: PASS: real browser widths1600/900/390; saved LONG gross20/net17/v1→v2,
  same record/note/session after JVM17504→2784 restart, source deletion preserved
  journal; final JVM24700 accepted A's own write and rejected stale A draft under
  B's session. B remained empty. All owned API/PG stopped, credential files removed.
- Status: PASS. Evidence: [execution record](test-evidence/results.md), desktop/
  tablet/mobile screenshots and sanitized DOM files in test-evidence.

## JRN-T09 — Regression and release

- AC: JOURNAL-06. Objective: prove compatible, bounded, delivered feature.
- Preconditions: all implementation and local cases complete.
- Input: full existing frontend/backend/Python checks, dependency/secret review,
  diff and protected-path checks; normal main commit with Refs15 and delivery Refs14.
- Steps: run full suites/lint/type/build/audits; inspect exact stage; push normally;
  verify remote+GitHub SHA and actual required CI; update and close Issue15 completed.
- Expected: all relevant checks PASS, no unrelated/protected/secret/applied-migration
  changes, evidence captured; next READY selection only after completed delivery.
- Actual: Local137backend/149frontend/40Python/6verifier/6canonical/6UI-fixture
  tests PASS; lint/type/build and Java118/npm audits PASS. Publication pending.
- Status: PASS. Publication: ae59734 verified on GitHub main, CI33373695604 SUCCESS,
  downloaded backend137/OSV118 and frontend149 log verified; Issue15 completed.
  Evidence: [execution record](test-evidence/results.md).

Security applicability: BOLA, CSRF, injection/XSS, mass assignment, replay/races,
rate/storage/body bounds, session revocation, redaction and dependencies apply.
No new upload, external URL fetch, shell/template execution, password/token issuance,
AI provider or trading order boundary; existing negative regressions remain required.
No performance/profit guarantee or assessment of entry-reason quality in PB-013.
