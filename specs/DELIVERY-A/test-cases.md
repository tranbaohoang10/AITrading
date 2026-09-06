# Library test cases — Refs #42

Synthetic owner A and foreign owner B; disposable PostgreSQL only. Actual status is recorded below. Browser evidence uses the same synthetic owners and no production data.

| Case | AC | Procedure and expected result | Evidence/status |
| --- | --- | --- | --- |
| A-01 | A1,A2 | Empty/loading/error then TXT/PDF catalog; title/filename/type search returns actual bounded metadata | PASS — UI and API tests; browser 1440/1024/390 |
| A-02 | A2,A7 | Owned detail/old/current preview; foreign/missing UUID denied, stale credentials and expected-account rejected | PASS — backend owner tests and browser isolation |
| A-03 | A3 | TXT/PDF upload, invalid bounds/MIME/name, next version, duplicate/concurrent request, conflict | PASS — existing and new `DocumentApiTests`; browser v2 |
| A-04 | A3 | Lose upload response, edit controls frozen, retry exact intent no duplicate | PASS — `Library.test.tsx` frozen-intent test |
| A-05 | A4 | Cancel then confirm delete; lost response reconciled; retained citation snapshot wording | PASS — `Library.test.tsx` and browser delete/reload |
| A-06 | A5 | Selected source excludes other docs, current version only; global query unchanged; exact citations/insufficient/provider failure | PASS for routing/citations/insufficient; provider answer BLOCKED by unconfigured AI |
| A-07 | A6 | Existing image results loaded without invented thumbnails; honest empty/error | PASS — image tab and browser empty evidence |
| A-08 | A7 | XSS text inert, no raw HTML; bounded params/body, auth/CSRF/Origin/limiter; stale selection response ignored | PASS — API/UI/security suites |
| A-09 | A1,A7 | Real 1440/1024/390 browser upload/search/preview/v2/RAG/delete/images/reload/isolation; keyboard/dialog focus/Escape | PASS — `browser-results.json`, zero page errors and zero horizontal overflow |
| A-10 | A8 | Frontend test/lint/build/audit; wrapper backend tests/build/dependency audit; secret/diff review and remote SHA/CI | PASS locally; commit/push/CI pending |

SQL injection/path traversal/unsafe upload, BOLA/auth/session/CSRF, replay/races, provider failure and output exposure apply. Broker/financial calculations and new password implementation N/A: untouched. No new SSRF surface; URLs are not accepted. Do not infer visual success from DOM tests.
