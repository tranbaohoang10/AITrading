# Prototype audit operations

PB-024 / Issue #19, 31/08/2026. Local authorized operators only. No public admin
endpoint, remote logging destination or permission changes are introduced.

## Correlation and coverage

Requests reaching the application filter receive a server-generated X-Request-ID. Safe API errors include the
same requestId. Client X-Request-ID is ignored. Audited HTTP: auth/resource writes
and denied/error requests; successful reads, health and CSRF bootstrap are omitted.
Only validated principals are attributed. Failed login/register without a current
principal and CSRF denials before principal validation are anonymous; usernames,
IP addresses and attempted credentials are never recorded. Anonymous events are
operator-only. Account activity is owner-only and hides expired rows immediately.
Transport/container rejections before the filter are outside this application's
audit coverage; inspect authorized ingress diagnostics without enabling raw-body logs.

Rows contain timestamp, ID, request UUID, optional owner UUID, fixed category,
operation/method/status, and job UUID/error enum for job transitions. No raw route,
query, headers, body, email, names, prompts, files, strategy/trade details or keys.
Job transition rows share the originating HTTP UUID, not a client idempotency key.
Internal service creation generates a UUID. Pre-V11 jobs receive a migration UUID;
no historical transition is invented. Deleted job events remain until retention;
deleting an account cascades its audit rows as a privacy exception.

On an authorized local database connection use parameterized queries, for example:

```sql
SELECT id, occurred_at, category, operation, method, http_status, resource_id, error_code
FROM trading.audit_event WHERE request_id = :server_request_uuid ORDER BY id;

SELECT count(*) AS expired_rows, min(occurred_at) AS oldest
FROM trading.audit_event WHERE occurred_at < clock_timestamp() - interval '30 days';
```

Do not paste database credentials, user content or unrestricted query results into
Issues, chat or logs. Use synthetic data for diagnostic tests. No new service token.

## Failure and retention policy

HTTP outcome auditing runs after business processing in a separate JDBC operation.
If it fails, response/business commit remain unchanged, and a fixed
`audit_write_unavailable requestId=<server UUID>` warning is emitted with no exception
payload. A crash in this gap can lose an event. This is **not** a transactional
outbox or forensic guarantee. Never blindly replay a mutation based on log failure.

Backtest job audit triggers run in the same transaction as each state transition
or job deletion. Insert failure rolls back both. Existing leases/recovery handle
interrupted work; repair audit availability before expecting worker progress.
No-state-change updates and idempotent replay do not create duplicate job events.

GET /api/health checks a bounded audit-table read and database connectivity. It
returns only UP or503 UNAVAILABLE/request UUID. This is not a write-permission,
retention-freshness, worker, provider or external-target health certificate.
Watch `audit_write_unavailable` and `audit_retention_unavailable` warnings and free
disk space. Correct the underlying database/permission/capacity problem; do not
disable triggers, tests or security checks to make health green.

Retention attempts at most5000 expired rows per minute per instance using row
locks/SKIP LOCKED and the existing query timeout. UPDATE is forbidden; fresh DELETE
is forbidden except parent account cascade. Expired rows are excluded from the
API even if cleanup lags. Metadata can remain physically longer during outage or
backlog; operator must monitor retention lag/backups and deployment storage policy.
Existing client rate limits do not prevent distributed storage flooding. Configure
authorized ingress limits and capacity alerts for a deployed service. No newer
events are silently evicted just to cap disk. This prototype does not make legal
retention/compliance claims and does not resist a malicious database superuser.

## User API and UI

GET /api/audit?limit=25&before=<positive bigint> requires current session and exact
X-Workspace-User. Limit1..50; keyset descending ID, no owner selector. Empty list is
normal. No audit mutation API. Account activity loads explicitly, replacing one
page at a time; refresh sees newer/late-committed records. Sequence allocation is
not transaction commit order; pagination is not a consistent full-history export.
Account deletion and retention intentionally shorten history.
