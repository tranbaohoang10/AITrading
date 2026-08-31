# PB-024 — Audit and operational diagnostics

31/08/2026. Issue [#19](https://github.com/tranbaohoang10/AITrading/issues/19).
Dependencies PB-002/PB-003 DONE. Prototype operator + authenticated account user.

## Use cases and descriptions

UC-AUDIT-01: user opens Account, explicitly loads activity, reads newest own events,
loads older pages or refreshes. Preconditions: current session and expected account.
No other owner's events, anonymous attempts, SQL or private content is exposed.
Empty/loading/failure/expired session states are explicit. No edit/delete action.

UC-AUDIT-02: operator correlates a safe error's server request UUID with persisted
HTTP outcomes and job transitions. No client correlation value is trusted. Health
is public but only UP or a redacted UNAVAILABLE + request ID. Runbook uses local
authorized SQL; no public admin endpoint, external telemetry or credentials.

UC-AUDIT-03: scheduler removes at most 5000 events older than 30 days per minute.
Rows cannot be updated; fresh rows cannot be deleted. Account deletion is an
explicit privacy exception: FK cascade removes that account's audit rows. Anonymous
events expire normally. DBA/superuser tampering is outside the prototype guarantee.

## Acceptance criteria

AC1: server UUID + allowlisted category/operation/method/status + timestamp and
validated actor only. Audit auth and resource mutations, plus denied/error reads.
Never store body, raw path/query, names, email, IP, headers, credentials, prompts,
DSL, trade values or arbitrary error strings. Successful reads/health/CSRF bootstrap
are not audit events; this is a scoped operational trail, not complete access history.

AC2: every new backtest state transition is audited atomically with job owner/ID,
stable initiating request UUID and fixed error code. Replay/no-state-change creates
no duplicate transition. Existing jobs get migration-generated correlation IDs;
historical transitions are not fabricated. Deletion is audited while owner exists.

AC3: immutable rows, retention/privacy exceptions above; batch and API bounds.
AC4: owner-only keyset API (1..50, canonical positive cursor), credential/current
account/rate gates, safe Account UI and stale response isolation.
AC5: HTTP audit write failure emits fixed redacted warning, preserves HTTP outcome;
health checks audit storage and reports 503 if unavailable. Job audit failure rolls
back transition; no silent loss of job events. No claim of exactly-once HTTP audit
under crashes; no remote log collector or guaranteed durability during DB outage.
AC6: actual HTTP/PostgreSQL, failure/restart/concurrency/redaction/retention tests;
frontend/browser responsive, regression/build/lint/security evidence and exact CI.

## Scope / Definition of Done

No change to backtest algorithm, AI/runtime blockers, security ownership contracts,
stack/dependencies, historical migrations or protected mvp-ui documents. No payment,
broker/order, admin dashboard, notification implementation or external messaging.
All AC mapped to evidence; no failed/skipped required verification labeled PASS.
Inspect complete/staged diff and diff --check, publish Vietnamese Refs #19 commit
fast-forward main, verify GitHub SHA and CI, update/close Issue only after DoD.
