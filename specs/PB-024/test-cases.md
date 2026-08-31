# PB-024 test cases

31/08/2026. Issue #19. All cases initially NOT RUN; record actual evidence separately.

| ID | AC | Scenario and required result |
| --- | --- | --- |
| A01 | 1 | Auth login/logout/password and resource mutation correlate server UUID; forged header discarded; no raw input in rows/logs |
| A02 | 1,4 | Anonymous, wrong owner/stale expected account, missing CSRF, invalid request and rate denial record safe metadata; cannot read another owner's timeline |
| A03 | 2 | Real backtest queued/running/succeeded/failed/cancelled/expired/delete transitions atomic; replay/same-state no duplicate; fixed job correlation |
| A04 | 3 | Fresh event UPDATE/DELETE denied; expired batch purges only eligible rows; account cascade works; concurrent purge has no duplicates/deadlock |
| A05 | 4 | API bounded cursor/limit, empty/multiple pages, invalid numeric/overflow/injection, authenticated credentials revoked |
| A06 | 5 | Forced audit HTTP insert failure preserves committed response and logs only fixed warning; health probe failure returns503 safe request UUID |
| A07 | 2,5 | Forced job audit failure rolls back transition, retry after recovery succeeds once |
| A08 | 6 | Owned actual API/Postgres restart preserves rows/session and correlation; synthetic data only |
| U01 | 4 | UI loading/empty/error/refresh/next page; escaped text and invalid response rejected |
| U02 | 4 | Late promise after account change/unmount cannot expose previous account data;401 clears auth |
| U03 | 6 | Actual browser Account activity desktop/tablet/mobile, two-user isolation, horizontal fit; no mocked browser API |
| R01 | 6 | Full backend/frontend/Python + build/lint/verifier/fixtures and dependency/security checks; historical protected files unchanged |

Security: broken access control/IDOR/BOLA, auth bypass, session/account confusion,
CSRF, injection, XSS/log injection, sensitive-data leakage, mass assignment, rate
limits/resource bounds, concurrency and audit tampering covered above. SSRF/path
traversal/upload/AI prompt execution N/A: no URL/files/LLM input accepted by new API;
existing regressions remain mandatory. No new password hashing or crypto. Replay
of read is harmless; mutations retain existing idempotency/session rules. No tests
against third-party services, no production data, no protection disabled for PASS.
