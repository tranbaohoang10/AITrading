# PB-016 test cases — Refs #18

31/08/2026. Synthetic local/test data only. Initial results NOT RUN.

| ID / AC | Objective / preconditions | Data / steps | Expected | Actual / status / evidence |
| --- | --- | --- | --- | --- |
| T01 /01,02 | Owned immutable export; users A/B, validated revision | A create/read/retry; B same/absent ID; newer draft then retry | Same artifact/hash, B404, draft excluded | Local PASS; HTTP/PG tests and restart-smoke.json; final regression pending |
| T02 /01 | Session/CSRF/account boundaries | Missing/wrong account/token/origin, expired/revoked session, delayed request | 401/403, no artifact or other-account mutation | Local PASS; API tests and browser A/B evidence |
| T03 /02,03 | Source and input rejection | DRAFT, malformed body/ID, corrupted canonical/hash, unsupported limits | Fixed safe diagnostics, no partial artifact | Local PASS; generator/API tests and browser-draft.md |
| T04 /02 | Quota/concurrency/restart | Parallel creates/same and different revisions at cap; DB failure; restart/replay/delete | One artifact per version, bounded quota, rollback, exact persistence/cascade | Local PASS; API tests and restart-smoke.json |
| T05 /03 | Injection/source determinism | Malicious labels/name; repeated same canonical source; max/min target bounds | Inert/rejected strings, stable source/hash, bounded output/no dangerous APIs | Local source/API PASS; not target execution |
| T06 /04,06 | Official target causal semantics | Shared Python synthetic fixtures incl all indicators, warmup, pivots, nullable rules/cross | Official compile; actual target values/events within stated tolerance | PASS: official compile8/8 and eight actual portable MT5 traces verified; `official-runtime.md` |
| T07 /04,06 | Fill/accounting edge cases | Next-open, long/short, fees, both barriers, gap, target cap, nonpositive equity, simultaneous signals/end | Correct event identity/timing/reasons and hand-derived accounting | PASS: all event/accounting comparisons PASS; actual NUMERIC_RANGE abort produced no END |
| T08 /03,04 | CSV/path defenses | Empty/null/oversized/traversal/device filename, malformed header/number/time, missing/duplicate/gap/invalid OHLCV, bounds | Fail closed, no external access/order/partial result presented as valid | PASS: actual target negatives including `future.csv` → `ERROR: CSV_INVALID row 2`; no result/order |
| T09 /05 | UI source integrity/stale behavior | Saved/draft/none, bad hash, account/revision switch, delayed response, retry/network error | Honest empty/error, stale hidden, draft preserved, exact immutable source | Local PASS:10MQL UI/API tests, actual draft and A/B browser |
| T10 /05 | Copy/download/responsive browser | Desktop/tablet/mobile, keyboard, denied clipboard/download | Safe inert text/ASCII filename, accessible controls, fallback without losing source | Local PASS with limits: actual1600/900/390/copy/download action; file bytes not inspected; unit Blob/filename/failure checks |
| T11 /07 | Regression/security/delivery | Full applicable suites/lint/build/audits, diff/scope check, normal push/CI/SHA | No disabled tests, scoped commit, exact published SHA and actual CI PASS | IN_PROGRESS: final163backend/186frontend/44Python/audits; final smoke/publication pending |
