# PB-008 test cases — Issue #12, 31/08/2026

| Case | AC | Expected evidence |
| --- | --- | --- |
| AI-T01 | 01 | Disabled/missing/invalid config safe, no key/model request injection, fixed endpoint/no redirect |
| AI-T02 | 02 | Real owner start/read/cancel, anonymous/BOLA/revoked/CSRF/Origin deny; no other context sent |
| AI-T03 | 02 | Exact latest user+version,20-message/16000-char window, whole-message truncation, hash/range provenance |
| AI-T04 | 03 | Actual HTTP stub structured answer/clarification, plain persistence, safe Unicode/assumptions; all malformed/duplicate/refusal/incomplete/tool/oversize cases fail |
| AI-T05 | 04 | Same request replay exactly once, changed intent409, parallel requests/pending quota,100 attempts and message quota |
| AI-T06 | 04 | Whole-body hang/timeout, HTTP401/429/500/redirect/disconnect, size cancellation and max4 calls; no raw secret/body leak |
| AI-T07 | 04 | Cancel/edit/delete/password revocation during call prevents append; rollback on DB failure, lease expiry after restart, explicit retry |
| AI-T08 | 05 | Save distinct Ask, config unavailable, pending/error/refusal/check status/cancel, uncertain request identity/draft protection, late response isolation |
| AI-T09 | 05 | Inert hostile text and responsive/browser actual unavailable state; no fake successful AI |
| AI-T10 | 06 | Real configured-provider synthetic smoke, structured/persisted response and context isolation; BLOCKED if key missing |
| AI-T11 | 06 | Full backend/frontend/Python/verifier/build/lint/security/dependency regression, diff/scope/protected files and CI/exact SHA |

No third-party security attack; provider smoke only authorized synthetic requests.
No secret in screenshots/logs/Issues/commits. Do not mark AI-T10 PASS using mocks.
