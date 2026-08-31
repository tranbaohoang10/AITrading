# PB-003 browser execution — Refs #6

30/08/2026, in-app Chromium browser; actual Vite127.0.0.1:5173 proxy to
Spring Boot127.0.0.1:8080 and owned PostgreSQL17 test clusters. No API mocking,
cookie injection or private browser storage inspection used for these journeys.
API contract mocks in Vitest are separate and are not integration evidence.

| Scenario | Actual result | Status |
| --- | --- | --- |
| API absent then available | Workspace unavailable + Retry connection, then sign-in form after real server starts; no demo-user fallback | PASS |
| Register Alpha | Registration acknowledgement; form returns to sign in | PASS |
| Wrong password | Generic authentication failure, no workspace | PASS |
| Correct password | Actual workspace shown; Account reports alpha.browser@example.test / Researcher Alpha | PASS |
| Rename and reload | Alpha updated saved and retained after full page navigation/reload and session restore | PASS |
| Password change | Returns to sign in; old password rejected; new password opens same profile | PASS |
| Mobile390x844 | Account via navigation drawer; fields/actions fit with vertical scrolling, no horizontal overflow; focus returns from drawer | PASS |
| Sign out | Sign-in form shown after real server invalidation | PASS |
| Second user Beta | Register/sign-in on same browser after logout; Account shows beta.browser@example.test / Researcher Beta, no Alpha profile | PASS |
| API process restart | Separate owned cluster; authenticated Restart Researcher survived API PID18604→20996, page reload fetched same profile without re-login | PASS |

Screenshots: account-desktop.png (normal1280x720), sign-in-mobile.png
(generic wrong-password state), account-mobile.png, beta-account-mobile.png and
account-after-api-restart.png. Viewport override reset after responsive testing.
Synthetic test accounts/passwords only, no real identity data or secrets.
Old browser-test clusters were stopped through their own harness; existing user
PostgreSQL service remained running. Restart capability changes only the owned API,
not Windows services or user data. Screenshots contain no credential plaintext.

Authentication is real; chart/chat/script/backtest parts are still clearly marked
mock/demo until later features. This evidence does not claim those integrations.
Final email-format and CSRF-session-throttle additions after the browser journeys
are covered by the subsequent full backend regression; they do not change these UI
flows. CI and final published SHA are recorded in Issue#6 after publishing.
