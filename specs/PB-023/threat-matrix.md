# PB-023 threat matrix

| Threat | Boundary / planned evidence | Status |
| --- | --- | --- |
| Broken access control, IDOR/BOLA | Two-owner actual API checks plus owner predicates on chat, strategy, dataset, job, journal, audit, notifications and documents | PASS |
| Authentication bypass / privilege escalation | Anonymous/forged Bearer denied; credential version, fixation and revocation regression; no privileged role exists | PASS |
| CSRF / CORS / clickjacking | Missing CSRF and hostile Origin denied; no CORS read grant; DENY, CSP, CORP and privacy/capability headers asserted | PASS |
| SQL/JSON/command injection | Prepared JDBC parameters; duplicate JSON/body bounds; hostile SQL/shell text persisted inert; fixed ProcessBuilder argv and clean environment | PASS |
| XSS / formula injection | React text rendering has no unsafe HTML/eval/storage sink; hostile markup remains exact inert data; CSV escaping regression retained | PASS |
| SSRF / redirects | Provider endpoints are fixed server configuration, redirects disabled, no request URL ingestion; external targets absent in smoke | PASS |
| Path traversal / uploads | No request-derived filesystem path; CSV and TXT/PDF MIME/magic/name/size/page bounds already covered | PASS |
| Mass assignment | Strict unknown-field Jackson configuration and feature DTO regression reject unexpected properties | PASS |
| Session/token/replay | HttpOnly SameSite session, configurable Secure flag, CSRF, expected account, request UUID/version hashes, restart persistence | PASS |
| Brute force / rate / resource exhaustion | Atomic database rate buckets, provider/process semaphores, timeouts and byte/count quotas; owner-independent rate smoke | PASS |
| Sensitive data / secrets / logs | Server environment only; bounded fixed errors/audit allowlist; exact-secret and credential-literal scans record counts only | PASS |
| Dependency / configuration | Locked npm/Gradle, wrapper verification, npm audit and OSV resolved-dependency scan; deployment cookie guidance | PASS |
| Race conditions | Transaction locks/version preconditions, stale-context and concurrent worker/delete/replay regression | PASS |
| Upload active content | PDF text extraction only; encrypted/oversized/mismatch rejected; no OCR, embedded-file or script execution | PASS |
| Live order/payment abuse | No credit/payment or broker/live-order implementation | N/A — absent by product scope |
