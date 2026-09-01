# Master Product Backlog — Autonomous Prototype

Created 30/08/2026, before product code changes. Owner: Product Owner; execution: Codex.
Source: full AUTONOMOUS PRODUCT BUILD request (sections A–Q), current Constitution,
docs/product-requirements.md and inspection of main / feature/mvp-ui.

## Baseline and decisions

- main starts at 295131b: governance only, no tracked application or tests.
- feature/mvp-ui at 0029c82 contains reusable React/TypeScript/Vite/Tailwind shell,
  local mock interactions and 10 component tests. It has no API, persistence,
  authentication, real backtest engine or AI provider. Old approval is not current
  verification. No browser visual evidence existed in that review.
- Reuse source selectively with provenance, not a whole-branch merge that would
  reintroduce governance. Keep old branch and all old specs/review history intact.
  Do not change or include the two protected re-review files in new commits.
- PostgreSQL/Flyway and Spring Boot Java 21 form the authenticated system of record;
  React is the client; Python evaluates the canonical validated DSL for backtests/AI.
- Initial prototype is a usable private research workspace, not a broker execution
  product. No credit/payment or live-money trading. Do not label fixtures as real
  market data or canned output as AI. Optional external integrations are explicitly
  separated below; required product behavior must not silently become a mock.

## State and selection rules

READY means dependencies DONE and Issue can be created; PLANNED means dependency
work remains; IN_PROGRESS includes required verification/publication; DONE requires
verified GitHub delivery and closed completed Issue. BLOCKED requires evidence.
DEFERRED_OPTIONAL means assessed and excluded from this prototype for stated reasons,
not implemented or tested. Reassess if an explicit requirement changes.
Priority P0 precedes P1, then P2; within priority use ascending ID among READY items.
Create each item's real GitHub Issue before its code; `not created` is not an Issue ID.
Each feature owns specs/<id>/{spec,design,tasks,test-cases,revision-history}.md
with test-evidence as needed. Every AC must map to meaningful execution evidence.

## Ordered backlog

| ID | Feature / objective | Dependencies | Priority | Status | GitHub Issue | Main acceptance criteria | Security impact | Testing impact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PB-001 | Reuse and verify frontend foundation / trading shell | — | P0 | DONE | [#4](https://github.com/tranbaohoang10/AITrading/issues/4) | Verified GitHub main 9fb1530; Issue completed; 27 tests/lint/build/audit/browser checks; details specs/PB-001 | Text injection, clipboard errors, dependency audit, no external calls or secret storage | Original 10 tests preserved; boundary/negative tests; real browser desktop/tablet/mobile |
| PB-002 | Backend and database foundation | — | P0 | DONE | [#5](https://github.com/tranbaohoang10/AITrading/issues/5) | Verified GitHub6bb886f and Actions33319918002 success; Issue completed; Java21/PostgreSQL/Flyway | Deny private endpoints by default, bounded inputs, no debug/data leaks, configuration secrets | 8 HTTP/DB +6 verifier +27 frontend tests, locked build/audits, real Windows/Ubuntu DB |
| PB-003 | Authentication and user management | PB-001, PB-002 | P0 | DONE | [#6](https://github.com/tranbaohoang10/AITrading/issues/6) | Delivered099d6a5; CI33349231331 success; Issue completed; Argon2id/persistent sessions/account/password | CSRF, fixation/revocation, brute force/enumeration, hash secrecy, concurrent uniqueness |22 backend,40 frontend,6 verifier tests; two-user browser/restart; audits |
| PB-004 | Persistent conversations and messages | PB-003 | P0 | DONE | [#7](https://github.com/tranbaohoang10/AITrading/issues/7) | Deliveredcc99d4d; CI33350972824 success; Issue completed; owned durable conversations/messages/context/paging | Owner predicates on every operation, XSS, mass assignment, idempotent writes |33 backend,57 frontend,6 verifier tests; two-user/browser/restart/responsive; audits |
| PB-005 | Versioned neutral Strategy DSL | PB-002 | P0 | DONE | [#8](https://github.com/tranbaohoang10/AITrading/issues/8) | Delivered28a68e0; CI33352803357 success; Issue completed; schema1.0.0/typed semantic validation/canonical SHA256, no runtime claim | No eval/scripts, bounded authenticated API/tree/numbers, typed DAG and risk |56 backend,57 frontend,6 verifier,6 independent canonical fixtures; audits |
| PB-006 | Market data import and chart datasets | PB-003 | P0 | DONE | [#9](https://github.com/tranbaohoang10/AITrading/issues/9) | Delivered7c7c198; CI33355769629 PASS; Issue9 completed; owned OHLCV/real chart,74backend/71frontend + browser/restart/isolation | File size/type/path, isolation, invalid values, duplicate candles, no arbitrary URL fetch | Import errors, gaps/order/precision, pagination/rendering, other-user denial |
| PB-007 | Strategy storage, editing and My Script workspace | PB-001, PB-003, PB-005 | P0 | DONE | [#10](https://github.com/tranbaohoang10/AITrading/issues/10) | Delivered6de03ea; CI33358050136 PASS; Issue10 completed; owned immutable DRAFT/VALIDATED revisions,84backend/88frontend + browser/restart/conflict/isolation | Ownership, version concurrency, code-view escaping | CRUD, stale version, invalid edits, reload, mobile workspace |
| PB-008 | Provider-neutral Quant / AI assistant: Gemini, optional OpenAI | PB-004, PB-005 | P1 | DONE | [#12](https://github.com/tranbaohoang10/AITrading/issues/12) | Default3.5Flash configurable;211backend/209frontend/44Python PASS, Java118/npm0. Real Gemini two-turn synthetic structured/context/isolation/replay/JVMrestart smoke PASS. Delivered a38c83d/b148333, exactSHA and CI33408544142/33408952000 SUCCESS; Issue12 completed | Server-only keys, owner/account/session/CSRF, bounded context/output/rates/timeouts, no tools/URL override, synthetic-only free-tier smoke | Both provider contracts, HTTP+PG/races/migration/frontend/security PASS; real smoke evidence gemini35-real-smoke.json; DoD/Issue completed |
| PB-009 | Natural-language strategy generation | PB-007, PB-008 | P1 | DONE | [#21](https://github.com/tranbaohoang10/AITrading/issues/21) | Prompt → structured DSL draft → validation → explicit user acceptance/version; explain missing/ambiguous rules | AI output never executable code; ownership, injection and resource controls | Multiple strategy families and hybrid prompts; invalid provider DSL, acceptance/rejection, no auto-backtest |
| PB-010 | Deterministic Python backtest engine | PB-005, PB-006 | P0 | DONE | [#11](https://github.com/tranbaohoang10/AITrading/issues/11) | Delivered2a3cf20; CI33359737530 PASS; Issue11 completed;35Python/84backend/88frontend; offline causal engine and run card, jobs remain PB-011 | Bounds/timeouts, no look-ahead/eval, fail unsupported multi-symbol/timeframe combos explicitly | Hand-computed trades, prefix invariance, missing/duplicate candles, same-candle exits, long/short and costs |
| PB-011 | Owned backtest jobs and API integration | PB-003, PB-007, PB-010 | P1 | DONE | [#13](https://github.com/tranbaohoang10/AITrading/issues/13) | Delivered bfebd5f/bcdeaff; CI33365234612/33365494850 PASS; Issue completed;122 backend/40 Python; snapshot jobs and actual restart | Ownership, subprocess fixed args, no shell injection, resource budgets/races | Actual Java↔Python↔DB integration; cancellation/timeouts/duplicate requests/cross-user |
| PB-012 | Backtest results and chart visualization | PB-001, PB-006, PB-011 | P1 | DONE | [#14](https://github.com/tranbaohoang10/AITrading/issues/14) | Delivered493b737; CI33368826001 PASS; Issue completed;131frontend/123backend/40Python and browser/restart/source deletion | Safe rendering/export, owner-scoped retrieval | Reconcile metrics with trades, zero-trade/loss-only cases, browser desktop/mobile |
| PB-013 | Trading journal and daily/monthly performance | PB-003, PB-006 | P1 | DONE | [#15](https://github.com/tranbaohoang10/AITrading/issues/15) | Delivered ae59734; CI33373695604 PASS; Issue completed;137backend/149frontend; exact P&L, browser/restart/source deletion/cross-session write isolation | Owner CRUD, input bounds, financial precision, stale updates | CRUD, date boundaries, fees/long/short, month/year/leap-day, race/ownership, browser |
| PB-014 | AI/NLP journal evaluation | PB-008, PB-013 | P1 | DONE | [#22](https://github.com/tranbaohoang10/AITrading/issues/22) | Delivered edfdc48; CI33465379086 SUCCESS; Issue22 completed; provider-neutral grounded rubric, V15 owned lifecycle, real Gemini synthetic/restart/isolation | Journal remains private, prompt injection, score bounds, no guaranteed advice | 253 CI backend,216 frontend,44 Python; missing/invalid/provider/privacy/replay/stale cases |
| PB-015 | Pine Script export from DSL | PB-007, PB-010 | P1 | BLOCKED | [#17](https://github.com/tranbaohoang10/AITrading/issues/17) | Experimental research export implemented; local152backend/176frontend/42Python PASS. Official Pine compilation/events require authorized TradingView sign-in; not DONE | No arbitrary templates/code injection; owner export | Eight synthetic target fixtures prepared, not executed in Pine; actual target verification remains required |
| PB-016 | MQL5 export from DSL | PB-007, PB-010 | P1 | BLOCKED | [#18](https://github.com/tranbaohoang10/AITrading/issues/18) | Research CSV export implemented;163backend/186frontend/44Python and official compile8/8 PASS. Runtime initialization/app-control access unresolved; not DONE | No orders/network/DLL; sandbox/device-name/finite-state guards; owner artifact/account binding | Local API/browser/restart PASS; actual MQL events/CSV negatives remain NOT RUN |
| PB-017 | Cross-target event consistency | PB-010, PB-015, PB-016 | P1 | PLANNED | not created | Compare warm-up/signal/confirmation/execution/exit traces, not profit only; record unavoidable platform differences | Reject unexplained divergence, no misleading certification | Shared OHLCV fixture, Python/Pine/MQL5 traces; report absent external runtimes as unverified |
| PB-018 | Private trading-document library and RAG | PB-003, PB-008 | P1 | DONE | [#23](https://github.com/tranbaohoang10/AITrading/issues/23) | Delivered18c0def; CI33469897224 SUCCESS; owned TXT/PDF versions, bounded retrieval, durable RAG provenance and real Gemini citations | MIME/magic/path/bomb limits, owner/CSRF/account/rate/stale races, untrusted document boundary | CI270 backend/221 frontend,44 Python; real synthetic Gemini/restart/exact citation; npm0/OSV121-0 |
| PB-019 | Chart/image analysis | PB-006, PB-008, PB-018 | P2 | IN_PROGRESS | [#25](https://github.com/tranbaohoang10/AITrading/issues/25) | Separate visible evidence/inference/confidence/missing data; OCR/image input bounded; strategy draft only on user request/review | Image type/size, metadata, prompt injection; no inferred profitable signals | Synthetic chart fixtures, unclear/truncated images, vision-provider errors; explicit limitations |
| PB-020 | Broker/exchange connection and paper orders | PB-003, PB-011, PB-024 | P2 | DEFERRED_OPTIONAL | not created | Assessment: CSV research covers prototype; add only when a specific authorized broker is selected; read-only/paper/demo default | External account secrets/order/withdrawal risk; live-money prohibited | Future sandbox integration/risk/idempotency required; no mock called broker integration |
| PB-021 | External market-data connector | PB-006, PB-024 | P2 | DEFERRED_OPTIONAL | not created | Assessment: owned CSV provides real datasets without paid API dependency; revisit provider/license when selected | Provider keys, licensing, SSRF/rate limits | Future provider contract/outage/gap tests; CSV remains in scope |
| PB-022 | Notifications | PB-011 | P2 | DONE | [#20](https://github.com/tranbaohoang10/AITrading/issues/20) | Delivered85cb6bc; CI33397113925 SUCCESS; Issue20 completed;183backend/201frontend/44Python, actual browser/restart/read/races/retention/owner isolation | Ownership, event duplication, no sensitive content leakage | One persisted event per terminal job; failure/restart/read state |
| PB-023 | Security hardening and adversarial regression | PB-003, PB-004, PB-007, PB-011, PB-013, PB-018 | P0 | DONE | [#24](https://github.com/tranbaohoang10/AITrading/issues/24) | Delivered c3faddd; CI33471678011 SUCCESS; threat matrix complete, no unresolved high/critical, actual two-owner adversarial/restart smoke | Headers, owner/account/session/CSRF, hostile inputs, limits, secrets and dependencies verified |270 backend/222 frontend/44 Python/6 verifier; npm0, OSV121-0; external targets untouched |
| PB-024 | Audit and operational diagnostics | PB-002, PB-003 | P1 | DONE | [#19](https://github.com/tranbaohoang10/AITrading/issues/19) | Auth/resource/job events traceable via request IDs; retention/redaction; safe health/error reporting | No tokens/passwords/private prompts in logs; append-only events and ownership | Sensitive-field leakage tests, correlation, audit persistence and failures |
| PB-025 | System integration and failure recovery | PB-004, PB-009, PB-012, PB-014, PB-017, PB-018, PB-019, PB-022, PB-023, PB-024 | P1 | PLANNED | not created | End-to-end account→chat→DSL→backtest→journal→export/RAG; restarts/errors recover without mixing users | Trust boundaries and data-loss safeguards across real services | Browser+API+DB+Python journeys, provider unavailable, migrations, concurrency |
| PB-026 | Prototype readiness and thesis artifact assembly | PB-025 | P1 | PLANNED | not created | Final regression; honest capability matrix; runnable setup; nine CNPM deliverable groups assembled; no unverified completion | Re-audit all exclusions, credentials/logs, safety claims | Fresh checkout setup, accessibility/responsive/regression/security and requirement-by-requirement audit |
| PB-027 | Expected-account binding across private workspace APIs | PB-003, PB-004, PB-006, PB-007, PB-011, PB-012, PB-013 | P0 | DONE | [#16](https://github.com/tranbaohoang10/AITrading/issues/16) | Delivered7e741be; CI33376664265 PASS; Issue16 completed;141backend/166frontend, actual two-tab stale writes/logout and restart; expected identity across private APIs | Prevent stale-tab content transfer and wrong-account side effects, preserve CSRF/ownership/revocation | Missing/wrong/matching identity, delayed requests/retries, real two-tab browser and full regression |

## Dependency order and delivery

Initial order: PB-001 → PB-002 → PB-003 → PB-004 → PB-005 → PB-006 → PB-007
→ PB-010 → PB-008 → PB-009 → PB-011 → PB-012 → PB-013 → PB-014
→ PB-015 → PB-016 → PB-017 → PB-018 → PB-023 (as soon as dependencies finish)
→ PB-022 → PB-024 → PB-019 → PB-025 → PB-026.
The READY/priority rule above is authoritative if readiness changes. Per-feature
security is mandatory throughout; PB-023 is extra integrated verification.
Credential-dependent tasks remain open/BLOCKED if required credentials cannot be
created. Continue independent safe work; do not replace real AI by canned answers
or declare external-runtime verification complete based on source inspection.

## Resume protocol

Read this file, docs/execution-state.md, current Issue and feature test evidence;
inspect actual git status/main/origin and running processes. Never restart based
only on an old log/status. Verify each completed Issue's pushed SHA. Select highest
priority READY item, create Issue, design/test/implement, verify, commit/push and
close completed; update backlog in the next traceable checkpoint. Never claim the
whole goal DONE until all required non-optional items and final readiness pass.

## 31/08/2026 — Current delivery and blocker checkpoint

PB02285cb6bc/CI33397113925 verified, Issue20 CLOSED/COMPLETED.14DONE,3BLOCKED,
8PLANNED waiting on dependencies,2DEFERRED_OPTIONAL; no independent READY item.
Required backlog is not complete. Do not redo DONE items or loosen their DoD.

- PB008/#12: project OPENAI_API_KEY still absent in Process/User/Machine in the
  presence-only recheck. Operator configures server key, model and enabled flag
  securely, then resume actual-provider smoke; never paste credentials into Git
  or Issues, reuse Codex credentials, or count stub results as actual AI.
- PB015/#17: current official target still shows anonymous Join for free; prior
  Add-to-chart Sign in blocker remains. Need authorized Pine editor/compiler/runtime
  session; prepared synthetic fixtures are not execution evidence.
- PB016/#18: official compile8/8 PASS already; actual target initialization/OnStart
  and CSV negatives still unverified. Prior app-control approval timed out; no new
  authorization received and no retry/bypass. Need accessible authorized runtime.

PB009/014/018 wait on PB008; PB017 waits on PB015/016; PB019 waits on PB008/018;
PB023 needs PB018; PB025/026 require the integrated chain. Broker/feed optional
items remain explicitly deferred, not a substitute for the blocked required work.

31/08/2026 PO amendment: PB008/Issue12 resumes provider-neutral implementation with Gemini Developer API; OpenAI optional. Historical OpenAI-key blocker is superseded. Current scope/AC/stop-before-commit when Gemini key absent: specs/PB-008/provider-neutral.md. DONE items remain unchanged.

31/08/2026 Gemini local checkpoint:209 backend/209 frontend/44 Python PASS,
plus verifiers/canonical/UI fixtures6each, Java118/npm0. Required real smoke is
BLOCKED solely for missing GEMINI_API_KEY (presence-only Process/User/Machine).
Per current PO instruction stop before commit/push and before any next feature;
Issue12 stays OPEN. Existing DONE statuses and unrelated blockers are unchanged.

31/08/2026 real Gemini resume: key present in Windows User. PB008 still BLOCKED:
actual app and minimal official REST requests return404; provider classifies
2.5Flash unavailable to new users. Models List200 is not proof of generation
access. Need a supported replacement model decision; no publication or next READY
feature until real smoke/DoD PASS. Earlier missing-key status is historical.

31/08/2026: PO-approved Gemini3.5Flash real two-turn smoke PASS; prior2.5 model blocker resolved. PB008 IN_PROGRESS until exactSHA/CI publication and completed Issue12. DONE features unchanged.


31/08/2026 — PB-008 DONE, Issue #12 CLOSED / COMPLETED after full AC/DoD.
Feature a38c83d1a4a9a3524d4fa70df78c6a00d2c6ac42, UTF-8 evidence correction
b148333104a496e633ef67cd607b1351600426c4: both normal main pushes and exact
GitHub SHA verified. CI33408544142 and33408952000 both jobs SUCCESS; feature
artifact independently confirms211/0/0/0 JUnit and118 dependencies without findings.
Local209frontend/44Python and real Gemini3.5Flash synthetic two-turn structured/
context isolation/persistence/actual restart PASS. Secret/log/scope checks PASS.
Earlier2.5Flash model rejection and intermediate fixture timeout remain historical.
Owned smoke API/PG stopped, temporary DB password removed. No protected mvp-ui,
stack, dependency, governance, CI or security weakening. Next READY by priority/ID:
PB-009; PB-014/PB-018 also newly READY. Existing DONE work is not repeated.

31/08/2026: PB009 selected after PB008 DONE; Issue21 created before code. CNPM/test design prepared, implementation pending.

01/09/2026: PB009 DONE; Issue21 CLOSED / COMPLETED. Feature commit
9c1a2111b6f255802489866b44fc6878421aad3c is on origin/main. CI run33462951447
SUCCESS; artifact confirms235 tests with0 failures/errors/skips and dependency
audit0 findings. Real Gemini3.5Flash synthetic proposal/accept/reject, restart,
ownership/context isolation and browser desktop/mobile evidence PASS. Next READY
by priority/ID: PB014, then PB018; existing DONE features are not repeated.

01/09/2026: PB014 selected after PB009 DONE; Issue22 created before code. Provider-neutral grounded rubric, owned V15 lifecycle and UI implementation are IN_PROGRESS.

01/09/2026: PB014 DONE; Issue22 CLOSED / COMPLETED. Feature edfdc48 exact on GitHub main; CI33465379086 SUCCESS with artifact253/0/0/0 and dependency audit0. Next READY by priority/ID is PB018; blocked Pine/MQL runtime work is not relabelled DONE.

01/09/2026: PB018 selected after PB014 DONE; Issue23 created before code. Private TXT/PDF upload, versioned chunks, deterministic retrieval and provider-neutral cited RAG are IN_PROGRESS.
