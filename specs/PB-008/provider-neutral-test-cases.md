# PB-008 provider-neutral test cases

31/08/2026, Issue12. Initial actual result/status for all cases: NOT RUN.
Common preconditions: owned disposable PG/harness, Java21/JDK HTTP, synthetic
accounts/data, no real credentials in local contract tests. Actual results and
commands will be recorded in test-evidence/provider-neutral-results.md.

| ID / AC | Objective / input | Steps | Expected result / evidence |
| --- | --- | --- | --- |
| GP01 /07 | Provider switching, missing/invalid keys/model/selector, both keys present | Start selection configurations; inspect class/capability; exercise disabled answer | Only selected provider; no fallback, safe null invalid selector; no key in capability; factory tests |
| GP02 /08 | Gemini HTTP request, user/assistant context, model path | Owned loopback captures request/header; return synthetic JSON | Exact route, header key only, separated instructions/roles, closed schema, no tools/cache/URL inputs; request bounds |
| GP03 /08 | Valid answer/clarification, refusal, MAX_TOKENS, malformed/duplicate/extra JSON, nontext/tool/thought/multi-candidate, invalid UTF8/oversize | Return each fixture; parse/answer | Only bounded valid structured answers saved; fixed failures, no private snippets or key echo |
| GP04 /08 | Timeout including body stall,429/5xx/401/403/redirect/wrongMIME/disconnect, interruption | Actual local HTTP exchanges and cancellation | Existing deadlines/byte limits, no retry or redirect, fixed cause-free diagnostics |
| GP05 /02,04,09 | Gemini owner/binding/CSRF/version, context bounds/races/revocation/quota | Run real HTTP+PG integration against Gemini loopback as well as existing OpenAI suite | Same denials/quotas and atomic lifecycle; no cross-user context or duplicate assistant |
| GP06 /09 | Existing OpenAI history and Gemini turns across selection/restart; pending leases | Preserve old rows; switch adapter; replay; new attempt; restart owned API | Provenance retained, no old request resubmitted; sessions/history durable; expired pending fails without fake success |
| GP07 /10 | Frontend Gemini/openai/null/invalid provider, key-like malformed JSON, stale account, error/refusal/pending | Contract parser tests and actual component interactions; preserve prior regressions | Correct label/warning, safe failure text, no untrusted selector, no stale or fake reply |
| GP08 /11 | Full local regression/build/lint/security/dependency/secret/scope | Run full backend/frontend/Python, verifiers and audits; inspect diff/migrations/protected files | All applicable tests PASS, no weakened check, fixed stack/dependencies unchanged |
| GP09 /11 | Actual configured Gemini (default3.5Flash) synthetic-only smoke | Only if server key exists: create new synthetic accounts, call actual provider, inspect structured persisted response/context/owner/restart | Real smoke evidence, never substitute loopback output; absent key stays NOT RUN/BLOCKED and stop before commit/push |

No third-party adversarial test, no real private user data, no credential values
in reports. Happy/error/security/race assertions remain separate from model output
quality; non-deterministic wording is not required to equal a canned answer.

31/08/2026 model amendment: GP01 additionally proves absent/empty Gemini model
defaults to3.5Flash, explicit2.5 model override remains honored, OpenAI still needs
an explicit model. GP02 checks store=false and model-independent thinking settings.
GP03 validates/discards optional base64 thoughtSignature metadata; malformed,
oversized metadata and secret-bearing answer still fail. GP09 now requires two
real synthetic turns, independently computed persisted context hashes, same-owner
and other-owner decoy exclusion, idempotent replay and actual API restart.

31/08/2026 execution: GP01–08 PASS with scope/limits in
[test-evidence/provider-neutral-results.md](test-evidence/provider-neutral-results.md).
GP09 NOT RUN/BLOCKED: GEMINI_API_KEY absent Process/User/Machine after local PASS.
No commit/push/Issue closure or next feature. No real provider output was fabricated.

31/08/2026 later resume: GP09 attempted FAILED/BLOCKED. Key now present in Windows
User; real app/full REST/minimal REST generation gets404 NOT_FOUND. Minimal error
classification:2.5Flash unavailable to new users; Models List200 advertises it.
No assistant or successful restart evidence; see gemini-real-smoke-attempt.json
and the latest provider-neutral-results.md entry. Local GP01–08 unchanged/PASS.


31/08/2026 — Gemini3.5Flash real synthetic smoke PASS (two actual provider turns).
Structured answers validated by the production adapter and persisted at sequences
2/4; independently computed context hashes/counts1/3 match. Same-owner and other-
owner decoys excluded, owner/binding/CSRF denied, replay creates no duplicate.
Actual API12520→14444 restart retained sessions, exact messages and durable turns.
Owned DB contains two SUCCEEDED Gemini3.5Flash attempts and exactly two assistants;
no failed attempt, fake answer or raw provider output in evidence. Key equality
checks found no key in API/harness/smoke logs or stored messages. Both synthetic
accounts signed out. Evidence: test-evidence/gemini35-real-smoke.json and
test-evidence/gemini35-checks.json (211backend/209frontend/44Python, audits PASS).
PB008 is IN_PROGRESS pending publication, exact GitHub SHA and actual CI; do not
infer DONE from local smoke. Previous2.5Flash404 evidence remains historical.
