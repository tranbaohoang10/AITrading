# PB-048 — Test cases

| ID | Coverage | Expected | Status |
| --- | --- | --- | --- |
| CAT-01 | Normalize provider rows | Valid canonical model | PASS |
| CAT-02 | Same ticker/different exchange | Distinct instruments | PASS |
| CAT-03 | FX aliases | EURUSD and EUR/USD find the pair | PASS |
| CAT-04 | Spot/futures/ETF semantics | Identities remain distinct | PASS |
| CAT-05 | Search/filter/pagination | Bounded deterministic pages | PASS |
| CAT-06 | Timeout/429/5xx/invalid data | Provider isolated | PASS |
| CAT-07 | Missing optional key | Provider disabled without failure | PASS |
| CAT-08 | Last-known-good | Previous snapshot remains queryable | PASS |
| CAT-09 | Transactional upsert | No partial replacement | PASS |
| CAT-10 | Secret handling | No key in URL/response/log/source | PASS |
| CAT-11 | Selector states | Loading/error/empty/results truthful | PASS |
| CAT-12 | Regression | Existing market tests/build pass | PASS |

Detailed executable and browser evidence is recorded in `evidence.md`.
