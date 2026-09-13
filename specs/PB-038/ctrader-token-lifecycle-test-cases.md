# cTrader token lifecycle — test cases

## Scope

Verify refresh-before-expiry, auth-expired recovery, refresh-token rotation,
secret isolation and the explicit restart limitation for the cTrader adapter.

## Cases

| ID | Scenario | Expected result | Evidence |
| --- | --- | --- | --- |
| CTL-01 | Initial access-token expiry is unknown | A 30-day bootstrap estimate avoids unnecessary rotation; an auth-expired response still refreshes before retry | `CtraderTokenManagerTests.estimatesUnknownExpiryAndRotatesBothTokensAfterAuthExpiry` |
| CTL-02 | Configured expiry is within the 24-hour safety window | Refresh occurs before opening a provider session | `CtraderTokenManagerTests.refreshesBeforeConfiguredExpiryAndDoesNotReuseRotatedRefreshToken` |
| CTL-03 | Refresh succeeds | New access and refresh tokens become one atomic in-memory state; old refresh token is not reused | CTL-01, CTL-02 |
| CTL-04 | Provider returns an auth-expired response | Refresh runs for the failed access token and the affected request can retry once | `CtraderMarketDataClient.open`, `Session.read`, `loadCatalog`, `loadHistory` |
| CTL-05 | Refresh response omits a required field | Refresh fails closed and the previous token pair remains unchanged | `CtraderTokenManagerTests.invalidRefreshResponseLeavesThePreviousTokenPairUntouched` |
| CTL-06 | Concurrent stale auth-expired notifications | A rotated state prevents a second refresh with the old access/refresh pair | `CtraderTokenManagerTests.authExpiredForCurrentTokenRefreshesOnceAndStaleFailureCannotReplaceNewState` |
| CTL-07 | Source/log review | No token values are logged, returned, committed or placed in test output | cTrader source scan; `git diff --check` |
| CTL-08 | Application restart | Refreshed credentials do not persist automatically; latest pair must be securely reprovisioned | `docs/market-data/ctrader-token-lifecycle.md` |

## Automated command

`backend/gradlew.bat test --tests com.aitrading.market.CtraderTokenManagerTests --tests com.aitrading.market.CtraderProtoCodecTests --no-daemon`

The test server uses synthetic tokens only. It does not call a real cTrader
account and does not write credentials to repository files.
