# PB-018 test cases

- TXT/PDF happy path, Unicode/multilingual retrieval, immutable version and restart.
- MIME/extension/magic mismatch, malformed/encrypted/empty/oversized PDF, invalid
  UTF-8, page/text/chunk/file/name/title/question/quota boundaries.
- Idempotent replay vs changed payload, stale version, concurrent upload/delete.
- Owner/IDOR, expected-account, CSRF/session, traversal, SSRF absence, XSS/injection,
  indirect prompt instructions, exact citation/hash/current-version isolation.
- No-match insufficient without provider; refusal/timeout/429/5xx/malformed output;
  secret/private data does not enter logs or another owner context.
- UI upload/list/question/citations loading/error/empty, inert rendering, responsive
  desktop/mobile, accessibility and all regressions.
