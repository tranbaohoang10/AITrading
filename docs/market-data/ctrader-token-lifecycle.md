# cTrader token lifecycle

## Runtime behavior

The backend keeps the cTrader access token and refresh token together in one
immutable in-memory state. Before opening a cTrader session it refreshes when
the configured access-token expiry is within 24 hours. If expiry metadata is
absent or malformed, it uses a conservative 30-day bootstrap estimate and
refreshes only after cTrader reports that the access token has expired. A
cTrader auth-expired response triggers one refresh for the failed access token
and retries the affected operation once.

A successful refresh must contain `accessToken`, `refreshToken` and a positive
`expiresIn`. The manager replaces both tokens in one synchronized state update;
the old refresh token is never used after that update. Refresh requests use the
fixed official token endpoint with a bounded response, and tokens are not
written to logs, responses, source files or commits.

## Configuration

The process reads these server-only values from environment-backed Spring
configuration:

- `CTRADER_CLIENT_ID`
- `CTRADER_CLIENT_SECRET`
- `CTRADER_ACCESS_TOKEN`
- `CTRADER_REFRESH_TOKEN`
- `CTRADER_ACCOUNT_ID`
- `CTRADER_ENVIRONMENT` (`demo` or `live`)
- Optional `CTRADER_ACCESS_TOKEN_EXPIRES_AT` as an ISO-8601 instant

The production client uses the fixed official cTrader token endpoint; it is not
runtime-configurable. A package-private endpoint injection exists only for
bounded local unit tests.

## Restart limitation

Persistent secure credential storage is **not implemented**. Refreshed tokens
currently survive only for the lifetime of the running application process.
After restart, the application reloads the values supplied by the environment.
Therefore automatic refresh is **not claimed to survive restart**: operators
must securely replace both `CTRADER_ACCESS_TOKEN` and `CTRADER_REFRESH_TOKEN`
with the latest rotated pair before restarting, or provide a future approved
encrypted secret-store integration. Never put rotated credentials in this
repository, `.env` files, logs or issue comments.
