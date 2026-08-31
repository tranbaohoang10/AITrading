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
| PB-008 | Quant / AI assistant provider boundary | PB-004, PB-005 | P1 | BLOCKED | [#12](https://github.com/tranbaohoang10/AITrading/issues/12) | Implemented/local105backend+105frontend PASS; actual unavailable-provider browser/restart. Required real-provider smoke blocked: no project server key; not DONE, Issue remains open | Server-side keys, provider timeout/retry, prompt/data isolation, bounded quotas, no arbitrary tools | Actual local HTTP+PG contract/race tests; real configured-provider smoke still required |
| PB-009 | Natural-language strategy generation | PB-007, PB-008 | P1 | PLANNED | not created | Prompt → structured DSL draft → validation → explicit user acceptance/version; explain missing/ambiguous rules | AI output never executable code; ownership, injection and resource controls | Multiple strategy families and hybrid prompts; invalid provider DSL, acceptance/rejection, no auto-backtest |
| PB-010 | Deterministic Python backtest engine | PB-005, PB-006 | P0 | DONE | [#11](https://github.com/tranbaohoang10/AITrading/issues/11) | Delivered2a3cf20; CI33359737530 PASS; Issue11 completed;35Python/84backend/88frontend; offline causal engine and run card, jobs remain PB-011 | Bounds/timeouts, no look-ahead/eval, fail unsupported multi-symbol/timeframe combos explicitly | Hand-computed trades, prefix invariance, missing/duplicate candles, same-candle exits, long/short and costs |
| PB-011 | Owned backtest jobs and API integration | PB-003, PB-007, PB-010 | P1 | IN_PROGRESS | [#13](https://github.com/tranbaohoang10/AITrading/issues/13) | Version+dataset snapshot execution; state/progress/failure; bounded worker; restart-safe persisted results; cancel/retry/idempotency | Ownership, subprocess fixed args, no shell injection, resource budgets/races | Actual Java↔Python↔DB integration; cancellation/timeouts/duplicate requests/cross-user |
| PB-012 | Backtest results and chart visualization | PB-001, PB-006, PB-011 | P1 | PLANNED | not created | Real equity/drawdown/metrics/trades; date/strategy provenance; overlay signals; no demo metrics presented as calculated | Safe rendering/export, owner-scoped retrieval | Reconcile metrics with trades, zero-trade/loss-only cases, browser desktop/mobile |
| PB-013 | Trading journal and daily/monthly performance | PB-003, PB-006 | P1 | PLANNED | not created | Trade entries/reasons/notes, daily P&L, current/other months/custom range, chart association, timezone and calculation definitions | Owner CRUD, input bounds, financial precision, stale updates | CRUD, date boundaries, fees/long/short, month/year/leap-day, race/ownership, browser |
| PB-014 | AI/NLP journal evaluation | PB-008, PB-013 | P1 | PLANNED | not created | Evidence-grounded reason-quality rubric/score and natural-language feedback; documented model choice incl BERT trade-off; disclaimer | Journal remains private, prompt injection, score bounds, no guaranteed advice | Rubric fixtures, missing reasons, multilingual/provider failure, privacy |
| PB-015 | Pine Script export from DSL | PB-007, PB-010 | P1 | PLANNED | not created | Versioned generator with source/hash metadata, bounded supported DSL semantics; explicit unsupported rejection | No arbitrary templates/code injection; owner export | Snapshot and semantic trace checks plus target validation; unsupported risk rules |
| PB-016 | MQL5 export from DSL | PB-007, PB-010 | P1 | PLANNED | not created | Versioned MQL5 generator from same DSL; safe/demo defaults; broker constraints explicit | No enabled live execution by default; escaped labels, risk controls | Compile/target checks when available, event semantics, broker parameter boundaries |
| PB-017 | Cross-target event consistency | PB-010, PB-015, PB-016 | P1 | PLANNED | not created | Compare warm-up/signal/confirmation/execution/exit traces, not profit only; record unavoidable platform differences | Reject unexplained divergence, no misleading certification | Shared OHLCV fixture, Python/Pine/MQL5 traces; report absent external runtimes as unverified |
| PB-018 | Private trading-document library and RAG | PB-003, PB-008 | P1 | PLANNED | not created | Safe upload/parse/index/retrieve; citations source/version; owner-only knowledge context; document-as-data | Malicious PDF, traversal/SSRF/resource bombs, indirect prompt injection, retrieval BOLA | Synthetic PDFs/text, wrong user, invalid MIME/size, failed extraction, citation integrity |
| PB-019 | Chart/image analysis | PB-006, PB-008, PB-018 | P2 | PLANNED | not created | Separate visible evidence/inference/confidence/missing data; OCR/image input bounded; strategy draft only on user request/review | Image type/size, metadata, prompt injection; no inferred profitable signals | Synthetic chart fixtures, unclear/truncated images, vision-provider errors; explicit limitations |
| PB-020 | Broker/exchange connection and paper orders | PB-003, PB-011, PB-024 | P2 | DEFERRED_OPTIONAL | not created | Assessment: CSV research covers prototype; add only when a specific authorized broker is selected; read-only/paper/demo default | External account secrets/order/withdrawal risk; live-money prohibited | Future sandbox integration/risk/idempotency required; no mock called broker integration |
| PB-021 | External market-data connector | PB-006, PB-024 | P2 | DEFERRED_OPTIONAL | not created | Assessment: owned CSV provides real datasets without paid API dependency; revisit provider/license when selected | Provider keys, licensing, SSRF/rate limits | Future provider contract/outage/gap tests; CSV remains in scope |
| PB-022 | Notifications | PB-011 | P2 | PLANNED | not created | In-app backtest completion/error notifications; owner-only unread/read state; no unsolicited external messages | Ownership, event duplication, no sensitive content leakage | Exactly-once user-visible event behavior, failure/restart/read state |
| PB-023 | Security hardening and adversarial regression | PB-003, PB-004, PB-007, PB-011, PB-013, PB-018 | P0 | PLANNED | not created | Full applicable threat matrix, dependency/secret scan, headers/CORS/CSRF/session/rate limits, no unresolved high/critical | All user-requested attack classes assessed with evidence or reasoned N/A | Automated two-user malicious-input tests plus real local integrations; never attack third parties |
| PB-024 | Audit and operational diagnostics | PB-002, PB-003 | P1 | PLANNED | not created | Auth/resource/job events traceable via request IDs; retention/redaction; safe health/error reporting | No tokens/passwords/private prompts in logs; append-only events and ownership | Sensitive-field leakage tests, correlation, audit persistence and failures |
| PB-025 | System integration and failure recovery | PB-004, PB-009, PB-012, PB-014, PB-017, PB-018, PB-019, PB-022, PB-023, PB-024 | P1 | PLANNED | not created | End-to-end account→chat→DSL→backtest→journal→export/RAG; restarts/errors recover without mixing users | Trust boundaries and data-loss safeguards across real services | Browser+API+DB+Python journeys, provider unavailable, migrations, concurrency |
| PB-026 | Prototype readiness and thesis artifact assembly | PB-025 | P1 | PLANNED | not created | Final regression; honest capability matrix; runnable setup; nine CNPM deliverable groups assembled; no unverified completion | Re-audit all exclusions, credentials/logs, safety claims | Fresh checkout setup, accessibility/responsive/regression/security and requirement-by-requirement audit |

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
