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
| CAT-13 | Empty-query curation | Only popular balanced symbols with chart routes appear | PASS |
| CAT-14 | Reference-only isolation | Matched metadata enriches routes; unsupported bulk rows are not persisted or returned | PASS |
| CAT-15 | Typed-search curation | Provider-supported but unapproved symbols remain hidden | PASS |
| CAT-16 | Stale-reference cleanup | Failed reference refresh cannot retain symbols whose approved route was removed | PASS |

Detailed executable and browser evidence is recorded in `evidence.md`.
