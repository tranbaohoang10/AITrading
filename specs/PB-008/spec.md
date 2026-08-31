# PB-008 — Quant / AI provider boundary

31/08/2026. Issue [#12](https://github.com/tranbaohoang10/AITrading/issues/12)
created before code. Dependencies PB-004/PB-005 DONE. No credit/payment/live trading.

UC-AI-01: researcher saves a message in an owned conversation, then explicitly
asks the configured provider to answer the latest saved user message. Server
resolves bounded context, records request provenance, obtains structured JSON,
validates and persists one assistant reply. Reopening retains real saved history.
Alternatives: unavailable configuration/refusal/invalid output/provider failure,
timeout/cancellation/expired request or conflicting edit never become fake success.

| AC | Required behavior |
| --- | --- |
| AI-01 | Server-only key/model, fixed HTTPS endpoint, no redirect/caller config/tools; safe capability state |
| AI-02 | Owner/current-credential checks on start/status/cancel; latest user sequence+expected version; bounded correct private context/hash |
| AI-03 | Strict answer/clarification+assumptions JSON and bounded inert persisted text; refusal/incomplete/error separate; no automatic DSL/code execution |
| AI-04 | HTTP bytes/connect/whole-response timeout, rate/concurrency/attempt quotas, durable idempotency/cancel/expiry, atomic stale-context recheck+append |
| AI-05 | Save distinct from Ask AI; pending/error/disabled/retry/cancel states, preserve drafts/context and ignore late identity responses; responsive inert UI |
| AI-06 | Actual local HTTP/PG, adversarial/race/restart and UI tests, full regressions/audits; separate real configured-provider smoke |

Security: no key/token/private context in errors/logs, no request-supplied owner,
role/model/endpoint/tools; access checks remain backend authoritative. Provider
data is untrusted, validated before persistence; no eval/tool/URL fetch/RAG here.
Data impact additive V6 for bounded attempt/provenance history, existing V1–V5
unchanged. Use sequence/class/ERD and separate test Markdown in this feature.

DoD: AC evidence including real provider smoke, local and actual CI PASS, scoped
Vietnamese Refs #12 commit, normal main push and exact GitHub SHA. Close only when
all met. Missing credentials do not justify canned AI or a false PASS; keep Issue
open/BLOCKED, continue independent READY work after completing safe local scope.
31/08/2026 presence-only environment check found no configured provider key;
Product Owner notified asynchronously without requesting secrets in chat.
