# PB-027 — Bind private workspace requests to the displayed account

## Mục tiêu
Close the shared-session identity gap discovered during PB-013 review across the
older authenticated modules, without reimplementing their DONE product features.
Security-first P0 follow-up; journal already binds its unsafe requests.

## Phạm vi
Require a captured expected workspace account on private resource operations and
enforce equality with the actual authenticated principal before reading/writing
private data or invoking providers. Update existing frontend API/provider calls,
backend guard and meaningful regression tests. No schema, stack, dependencies,
business accounting, provider configuration, payment or live trading changes.
Keep bootstrap registration/login/CSRF/current-user discovery usable.

## Use Case
UC-IDENTITY-01 continue a private workspace safely after another tab changes the
shared browser session; deny stale-account reads/writes instead of silently using
the replacement session account.

## Use Case Description
User A opens a workspace and drafts private content. Another tab signs out A and
signs in B. Every subsequent private operation initiated by the old A workspace
must carry A's captured expected identity and fail before access/mutation if the
session is now B. B's workspace continues normally. Account identity is not an
authorization selector: server ownership still derives solely from the principal.
Late in-flight responses cannot update a new identity's UI; reauthentication uses
the existing authentication flow. No mutable global 'current account' header that
could silently rebind an old async operation to a new user.

## Acceptance Criteria
- IDENTITY-01: backend rejects missing/mismatched expected identity on private
  data reads and writes before resource SQL/provider work. Valid same-account
  requests preserve existing ownership/CSRF/body/rate/version/idempotency behavior.
- IDENTITY-02: frontend captures identity from authenticated context per operation
  and carries it through delayed CSRF fetches/retries/pages/provider operations;
  never obtains the expected owner from the replacement session at send time.
- IDENTITY-03: conversations/messages/AI, datasets, strategies/DSL, backtests,
  journal and account profile/password/logout are assessed and protected as
  applicable. Bootstrap/login/register/CSRF/self-discovery remain functional;
  stale logout must not invalidate B's session.
- IDENTITY-04:401/account mismatch clears stale private workspace; late reads,
  retries and post-write verification failures cannot mix accounts, silently
  replay a different intent or claim an unverified mutation completed.
- IDENTITY-05: reproduce the prior unbound boundary using synthetic HTTP/browser
  fixtures, then meaningful multi-user tests, real browser session-switch flow,
  full regression/build/security and exact GitHub SHA/required CI PASS.

## UI Requirements
Reuse current auth/error/uncertain interfaces. No new product screen or dummy
content. Preserve drafts during ordinary same-account transient failures; clear
private identity-bound state on authentication mismatch. Document reload/retry limits.

## Data / ERD Impact
No migration or new entity. Existing owner predicates and transactional guards
remain authoritative; expected account header is only an additional precondition.

## Security Requirements
Prevent stale-tab private-data transfer and wrong-account side effects. Header
must not allow owner forgery. Preserve credential revocation, CSRF/Origin, quotas,
rate limiting, redaction and all existing negative tests. Never read real secrets
or attack third-party systems. Provider smoke remains separate blocked PB-008.

## Test Requirements
Separate detailed Markdown cases for matching/missing/wrong/anonymous/revoked
identity, read/create/edit/delete/provider/account/logout surfaces, delayed token
fetch, account remount, uncertain retry, changed-session races and real browser
two-tab flow. Old tests must keep their expected business/security outcomes;
legitimate authenticated fixtures add the new explicit identity precondition.

## Definition of Done
All IDENTITY ACs verified with real tests and evidence; no weakened old checks,
unrelated files or dependencies. Normal Vietnamese security(scope) Refs commit
on main, push, exact GitHub SHA and required CI PASS, Issue completed explicitly.
Then continue highest-priority READY backlog item.

## Dependencies
PB-003/PB-004/PB-006/PB-007/PB-011/PB-012/PB-013 delivered. This focused fix is
pulled forward from final security review because the concrete shared-session gap
was discovered now; it does not repeat DONE features or wait for AI credentials.
