# PB-003 test cases — Refs #6

Shared preconditions: isolated synthetic PostgreSQL; Java21 API; two test users;
fresh session cookie jar per actor. Browser checks use loopback Vite proxy only.
No third-party account, real password or user DB is targeted. Actual results below
must be filled from execution; these are test designs, not claims of success.

| ID | AC | Objective | Data/Input | Steps | Expected result | Actual / status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AUTH-01 | 01 | Register/persist | mixed-case email, valid Unicode name/password | register; query own fixture DB; restart/read | normalized one row; Argon2id parameters/salt; no plaintext | NOT RUN | JUnit planned |
| AUTH-02 | 01,05 | Validation boundaries | null/empty/bad email; names0/1/80/81; password11/12/128/129; controls/unknown fields | POST each case | exact boundary acceptance/rejection; no trim/truncate password; no role assignment | NOT RUN | JUnit |
| AUTH-03 | 01,05 | Duplicate/race | same normalized email, parallel requests | register twice/concurrently | identical202 acknowledgement; exactly one row | NOT RUN | HTTP+DB |
| AUTH-04 | 02 | Login and restore | correct/wrong/unknown credentials | csrf; login; me; new request/session | generic401 for wrong/unknown; own profile for correct; persistence | NOT RUN | HTTP+DB/browser |
| AUTH-05 | 02,05 | CSRF and fixation | missing/forged/other-session/old token; prelogin cookie | POST login/register/logout/profile/password; replay before/after login |403 invalid; cookie rotated; old CSRF rejected; fresh token works | NOT RUN | HTTP |
| AUTH-06 | 03 | Ownership/mass assignment | user A/B ids/roles/owner fields, forged token | me/update; forged path/body/cookie | own profile only; reject unknown security fields; user B unchanged | NOT RUN | HTTP+DB |
| AUTH-07 | 03,06 | Account UI/name update | valid/invalid name, network failure | open account; edit; save/reload | actual persisted name; accessible errors/retry; no duplicate submit | NOT RUN | browser/Vitest |
| AUTH-08 | 04 | Password change and revoke | old/wrong/new password, two sessions | change; replay both cookies; login old/new | wrong denied; new hash/version; old sessions/password denied | NOT RUN | HTTP+DB |
| AUTH-09 | 04 | Credential race | two changes or login based on old version | concurrent requests/version-controlled stale principal | no lost password update; old-version session unauthorized | NOT RUN | integration |
| AUTH-10 | 02,04 | Logout/expiry/forgery | cookie stale/forged/expired | logout; replay; expire owned DB session |401; cookie invalidated; no hash/password in response/storage | NOT RUN | HTTP+DB |
| AUTH-11 | 05 | Throttling/races | IP/account counters, spoofed forwarding headers, concurrent attempts | reach limits; retry/new window |429 Retry-After; spoof does not bypass; exact bounded counts; expiry recovers | NOT RUN | integration |
| AUTH-12 | 05 | Request/DB safety | oversized/chunked/malformed JSON/form; hostile origin/SQL/XSS; stopped DB | submit; verify schema/errors/body/headers | safe400/403/413/503; no injection/secret/error detail; DB failure denies | NOT RUN | HTTP+DB |
| AUTH-13 | 06 | Auth browser lifecycle | new/duplicate account, wrong/correct credentials | register/login/reload/account/password/logout desktop/mobile | real successful journey; correct errors/focus; no localStorage credential | NOT RUN | browser screenshots |
| AUTH-14 | 07 | Regression/security/delivery | all locked deps and existing tests | fresh build/tests/audit/diff/CI | all pass, no skipped required checks, verified SHA | NOT RUN | Commands/Actions |

Uploads/RAG/SSRF and trading execution are absent surfaces here, assessed again in
their features. Session/JDBC serialization accepts only server-generated objects;
verify client JSON cannot request arbitrary types. Email verification/reset and
admin roles are explicit exclusions, not tests silently marked PASS.

## Execution results

AUTH-01–12: see backend-auth-tests.json for actual test names/counts and the final
verification record; tests use real HTTP/PostgreSQL, with explicit fixture mutation
only to simulate expiry, exhausted windows and a raced stale-principal session.
Ownership uses two independent HTTP cookie jars. No security expectation was weakened.

AUTH-07/13: browser-results.md records actual registration/login/profile/change/
logout, two users, responsive layout and persistent session across API restart.
13 frontend auth tests pass alongside the original27; API mocks are labelled as
contract tests. Original10 inherited test bodies are unchanged.

AUTH-14: publication/CI remains pending until Issue#6 records the exact SHA and
actual completed/success Actions result. Local PASS does not stand in for CI.

Defects found and fixed during execution: numeric JSON→String coercion accepted
an invalid displayName (202 instead of400); configure explicit Textual coercion
failure. DB outage during session rollback raised TransactionException (500 instead
of503); handle/redact transaction failures and retain generic diagnostics. Earlier
compile/API-lock setup errors were repaired, not reclassified as successful tests.

### Current case status after final local run

| Cases | Actual result | Status | Evidence |
| --- | --- | --- | --- |
| AUTH-01–03 | Valid/invalid boundaries, normalized unique emails, distinct Argon2id salt/parameters, duplicate acknowledgement and four concurrent registrations verified | PASS | backend-auth-tests.json |
| AUTH-04–06 | Real login/profile, cookie/CSRF rotation, invalid claims and two-user ownership/mass assignment verified; profile/session persisted across actual API restart | PASS | backend-auth-tests.json; browser-results.md |
| AUTH-07–10 | Own name update, password-current check/version revocation, stale principal, logout/expiry/forgery verified; React rendering safely treats hostile name as text | PASS | backend-auth-tests.json; frontend-tests.json; screenshots |
| AUTH-11–12 | Atomic concurrent limits, spoofed forwarding header, old window, capped anonymous CSRF sessions, strict/oversized/malformed/foreign-origin requests and actual authenticated DB outage verified | PASS | backend-auth-tests.json |
| AUTH-13 | Alpha/Beta browser journeys and mobile Account; API restart profile/session test | PASS | browser-results.md |
| AUTH-14 local checks |22 backend +40 frontend +6 verifier tests, locked build/lint/types,118-package OSV scan and npm audit passed | PASS (local) | test-evidence/results.md |
| AUTH-14 publication | Exact new GitHub SHA/CI required before closing Issue#6 | PENDING | Issue#6 |

JSON evidence files are under test-evidence/. The initial NOT RUN rows record the
test design before implementation; this execution table is the current result.
