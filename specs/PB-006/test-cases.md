# PB-006 test plan — Issue #9

31/08/2026, before implementation. Current statuses NOT RUN. Unit setup synthetic
CSV and fixed UTC clock; HTTP setup owned temporary PG/Java21 with separate users
A/B; frontend state tests use contract mocks; real browser uses actual local API/DB.

| ID / AC | Objective/input and steps | Expected result | Actual/status |
| --- | --- | --- | --- |
| DATA-01 /01,02 | Import simple, quoted, BOM/CRLF/space variants; compare exact decimals/hashes | Same canonical data identity, differing raw identity; exact prices/time and count | NOT RUN |
| DATA-02 /01 | Header/empty/blank/columns/quote/formula/Unicode/numeric type attack variants | Fixed line/code rejection, no partial rows or payload echo | NOT RUN |
| DATA-03 /01 |0/1/5000/5001rows, byte bounds, price0/max/too-high/8-vs9decimals,volume0/negative,high-low | Exact accepted/rejected boundaries and relationships | NOT RUN |
| DATA-04 /01,02 | UTC alignment/leap dates/order/duplicates/future/partial bars/gaps | Reject invalid dates/order/future; count gaps without filling | NOT RUN |
| DATA-05 /02,03 | A import/list/select/page/reload/restart; B same raw fixture | Own durable immutable dataset, stable bounded pages/metadata; separate IDs | NOT RUN |
| DATA-06 /03,05 | B reads/pages/deletes A; missing/malformed IDs; owner/role/type injection; revoked session | Uniform404 or400/401; no private metadata/candles or unauthorized changes | NOT RUN |
| DATA-07 /03 | Parallel identical/different payload same requestId; quota49 then concurrent new imports | One idempotent dataset, conflict409 for changed intent; max50atomic | NOT RUN |
| DATA-08 /03 | Failed batch/invalid parse; delete fingerprint conflict/cancel/confirm; concurrent reads | Full transaction rollback, protected other dataset, correct404/409 after delete | NOT RUN |
| DATA-09 /05 | No/wrongCSRF/hostileOrigin, import2MiB+1/chunked, unrelated endpoint limit, atomic throttle/XFF |403/413/429; no limit bypass, other users/window independent | NOT RUN |
| DATA-10 /04 | Import file/paste/sample, loading/empty/errors, uncertain retry, context switch/late response | Correct UI distinction, stable request ID, no mixed metadata/candles/users | NOT RUN |
| DATA-11 /04 | Real browser import/reload/inspect/paging/window/delete/isolation at desktop/tablet/mobile | Real candle/OHLC/volume, correct viewport/padding/keyboard, no fake indicators/overflow | NOT RUN |
| DATA-12 /05,06 | Full regression/build/lint/types/audits/secret scope and actualCI | All relevant PASS before publication and Issue closure | NOT RUN |

No real provider/engine execution/live account test in scope. Failures recorded and
fixed, never changed expected result to hide a defect. Actual results/evidence and
individual automation names appended after execution, not claimed in advance.

## Executed results — 31/08/2026

DATA-01–11 PASS; detailed per-case actual outcomes, automation names, synthetic
inputs, browser screenshots, defects and corrections: [results](test-evidence/results.md).
DATA-12 local checks PASS:74 backend/71 frontend/6 verifier/6 canonical, lint/types/
build,118 Java packages and npm audit0 findings. GitHub delivery/CI still pending.
Initial NOT RUN table above is the pre-implementation baseline; this dated result
and its evidence supersede it without erasing history.
