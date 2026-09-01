# PB-009 — Natural-language strategy generation

31/08/2026, authorized autonomous backlog run. Dependencies PB-007/#10 and
PB-008/#12 DONE. Reuse existing Strategy DSL1.0.0 validator, owned immutable
strategy revisions, persistent conversations and provider-neutral Gemini/optional
OpenAI boundary. No DONE feature rebuild, new dependency or stack substitution.

## Use case / description
UC-GEN-01: a signed-in researcher selects an owned strategy and conversation,
saves a natural-language research request and explicitly requests a DSL proposal.
Server freezes only that conversation's bounded context and the current strategy
revision, then calls the selected real AI provider outside the DB transaction.
Structured output is either clarification or a DSL proposal. Trusted schema and
semantic validation must pass before READY. Show explanation/assumptions and DSL
preview; never overwrite the editor or save a strategy automatically.
UC-GEN-02: user explicitly accepts a READY proposal, creating one immutable
VALIDATED revision through the existing strategy service, or rejects it. Backtest
and Pine/MQL export remain separate explicit operations.
UC-GEN-03: reopen/status/retry same request recovers durable state without repeating
the provider call. New request after failure is explicit. Cancellation, expiry,
provider errors, stale strategy/conversation and revoked sessions fail safely.

## Acceptance criteria
- GEN01: selected AiProvider supports structured strategy proposal/clarification;
  no business dependency on Gemini/OpenAI/model, no canned generation. Existing
  chat answer schema/limits remain unchanged. Use bounded trusted DSL schema as
  provider guidance; all returned DSL is separately validated by DslValidator.
- GEN02: method-neutral measurable rules; unknown/ambiguous concepts request
  clarification, never silently invent missing risk/execution assumptions or
  substitute a strategy family. Labels do not create executable behavior.
- GEN03: every operation authenticates current credentials and expected account,
  owns both strategy and conversation. Source must be latest saved user message,
  expected conversation version and strategy revision checked. Context at most20
  messages/16000 characters, hashes/ranges/provenance frozen and persisted.
- GEN04: additive V14 durable generation attempts, bounded100 attempts/strategy,
  one pending/strategy, idempotent request identity and immutable input fingerprint.
  Fixed20s provider timeout/256KiB response, bounded8192 proposal tokens, four
  concurrent external calls shared with ordinary AI chat; account rate limits
  shared with chat starts. Expired40s leases never replay a provider call.
- GEN05: provider/validation failure produces fixed diagnostics, no READY or saved
  strategy. Cancellation, deletion, revocation or concurrent context/revision edit
  during generation discards stale output. No transaction spans external calls.
- GEN06: only explicit acceptance of READY creates one VALIDATED revision using
  trusted canonical DSL/hash, current ownership and optimistic revision checks.
  Repeated accept returns the same revision. Reject/clarification/failure never
  mutate strategy history. No auto execution/backtest/export or editor overwrite.
- GEN07: real responsive UI alongside persistent chat/strategy workspace shows
  availability, frozen request, pending/status/cancel, clarification/errors,
  validated preview, accept confirmation/reject and durable recovery. Preserve
  drafts; ignore late responses after selection/identity change. Gemini warning
  requires synthetic-only prototype data. Render all text inertly.
- GEN08: functional/validation/boundary/negative/integration/race/restart/auth/
  regression/security tests, both provider wire contracts, multiple measurable
  strategy families, provider malformed/429/5xx/timeout/refusal, ownership and
  secret leakage. Real Gemini synthetic proposal + explicit acceptance + restart
  smoke separately required; never replace that evidence with a stub.

## CNPM / data / security
Before code create spec/design/tasks/separate test Markdown/revision history;
sequence/class diagrams and V14 ERD impact. Preserve V1–V13 and all prior history.
Security: BOLA/IDOR, CSRF/origin/session/revocation, mass assignment, prompt/JSON/
SQL injection, no tools/code/eval, no external URLs/schema fetch, bounded requests/
responses/context/rates/concurrency, XSS, replay, stale writes, secret/error/log
exposure and unchanged dependency audits. All adversarial tests use owned test
systems; external Gemini smoke uses only synthetic accounts/data.

## Definition of Done
GEN01–08 mapped to executable evidence; full relevant local build/lint/tests and
security/audits PASS, real synthetic provider smoke PASS, reviewed diff/scope/no
secrets, Vietnamese commit + Refs #21, normal main push, exact GitHub SHA
and CI/artifact verification. Only then close completed and select next READY.
Do not force push/rewrite history, weaken tests/security or commit secrets/.env.

Out of scope: new DSL primitives or trading methods, prompt-image/document/RAG,
journal AI, broker/live trading, credit/payment, strategy profitability claims.

Issue: https://github.com/tranbaohoang10/AITrading/issues/21
