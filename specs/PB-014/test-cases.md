# PB-014 test cases

- Happy path: four ordered 0–25 criteria, exact evidence, backend-computed total.
- Validation/boundary: invalid UUID/version, score -1/26, wrong/missing criteria,
  oversized/control text, unknown JSON fields and ungrounded evidence fail closed.
- Missing/weak/multilingual reason: honest insufficient questions or grounded
  feedback in the source language; no profitability inference from P&L.
- Provider: Gemini/OpenAI switching, structured contract, refusal, malformed,
  timeout, 429/5xx and response limit; no fake score or secret leakage.
- Security: owner/IDOR, expected-account, CSRF/session/revocation, injection/XSS,
  no tool/URL/code execution, bounded context/rate/shared concurrency.
- Durability: idempotent replay, one pending, quota, cancel, stale journal update,
  simultaneous calls, database/API restart and deletion cascade.
- UI: loading/ready/insufficient/failed/stale, dirty draft blocked, inert rendering,
  accessible status and desktop/mobile overflow; full regression.
