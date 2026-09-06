# Test cases

| ID | Scenario | Expected/evidence |
|---|---|---|
| B-01 | Mở Journal và chuyển Overview/Trades/AI Review | PASS — `Journal.test.tsx` tab assertions |
| B-02 | Lọc ngày, timezone, settlement unit | PASS — existing report filter test |
| B-03 | Dirty draft rồi chọn record/refresh | PASS — draft guard test |
| B-04 | Mất response save rồi retry | PASS — exact intent/idempotency test |
| B-05 | XSS trong reason/notes | PASS — inert text test |
| B-06 | AI review khi draft dirty hoặc provider unavailable | PASS — saved-only guard; provider unavailable is shown honestly |
| B-07 | Owner mismatch, conflict, CSRF/Origin | PASS — backend journal/security regression suite |
