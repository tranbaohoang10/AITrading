# PB-022 — In-app backtest notifications

31/08/2026. Issue [#20](https://github.com/tranbaohoang10/AITrading/issues/20).
Dependency PB-011 DONE. PB-024 delivered401f969/CI33393395877/Issue19 completed.

## Use case / description

UC-NOTIFY-01: authenticated researcher opens Backtest and explicitly checks the
notification inbox. Server returns recent completion/failure/cancellation metadata
and unread count. User refreshes/loads older pages, marks a single event read or
opens its job with the existing owned-result workflow. Empty/loading/error states
are distinct. Deleted jobs may no longer open; their notifications remain until
retention. No private strategy/trade content copied into notifications.

This prototype is a durable inbox checked on demand, not realtime push. No email,
web-push, external messaging, background notification permission or new polling.
Existing completed jobs before V12 are not backfilled with invented notifications.
New terminal transitions after V12, including previously queued jobs, are covered.

## Acceptance criteria

AC1: exactly one persisted row per job when QUEUED/RUNNING becomes
SUCCEEDED/FAILED/CANCELLED. Transactional trigger + unique job ID; no-op/replay
cannot duplicate. Notification failure rolls back transition; existing leases and
explicit retry recover. This is row uniqueness, not exactly-once network delivery.
AC2: owner FK/cascade, logical job UUID survives job deletion, bounded fixed enum
metadata, created/read timestamps, no title/prompt/DSL/trades/secrets.30day retention,
5000expired rows per minute; expired rows hidden even if purge lags. No audit rows
repurposed or read state mixed into immutable audit history.
AC3: owned keyset GET /api/backtests/notifications limit1..50 and unread count in
one repeatable-read snapshot; current credentials/expected-account enforced.
POST /api/backtests/notifications/{id}/read accepts{} only, requires CSRF and is
idempotent with stable readAt. Unknown/foreign/expired ID404. Existing backtest
read300/mutate30 per15minutes/account budgets apply. No owner selector/admin API.
AC4: real Backtest inbox with explicit check/refresh/older/read/open-job controls;
bounded validated response, escaped metadata, no localStorage, no previous account
or obsolete page leaks, no auto retry mutation on transport uncertainty.
AC5: actual HTTP/PostgreSQL/Python, failure/race/duplicate/privacy/restart tests,
frontend/browser responsive/isolation and full regression/build/lint/security PASS.

## Definition of Done

CNPM/test MD before code; evidence for AC1–5. No new dependency or stack change,
no modifications to applied migrations/engine/other DONE behavior. Review exact
diff/staged scope and secrets, fast-forward main, verify GitHub SHA/actual CI,
update/close Issue20 only when PASS. Preserve protected mvp-ui history. Continue
READY backlog, otherwise report real external blockers without claiming all DONE.
