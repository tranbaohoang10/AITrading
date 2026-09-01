# PB-014 — AI/NLP journal evaluation (Issue #22)

## Use Case and acceptance

An authenticated owner explicitly evaluates the reason from one saved journal
version. The server freezes an owner/version/hash snapshot, calls `AiProvider`
with bounded untrusted data, validates a structured four-part rubric and persists
the lifecycle. Specificity, evidence, risk and invalidation each score 0–25; the
trusted backend computes 0–100. Evidence must be an exact substring of the saved
reason. Insufficient content asks questions without fabricating a score.

The result never edits the journal, executes code/tools, opens URLs, places orders,
starts backtests or promises profit. Expected-account, session, CSRF, ownership,
rate/concurrency/timeout, output bounds, restart/replay/race and secret isolation
remain mandatory. UI sends saved data only, blocks dirty drafts, renders inert
text and shows a research/not-advice/no-guarantee disclaimer.

## Scope and model decision

Use the configured provider-neutral LLM because the task requires multilingual,
contextual structured feedback and the prototype already has bounded Gemini/OpenAI
adapters. A local BERT classifier can be cheaper and deterministic after training,
but no labelled rubric dataset, calibration evidence or maintained inference
runtime exists. Training/fine-tuning BERT is out of scope; the abstraction permits
a future provider without coupling journal business logic to one model.

Issue: https://github.com/tranbaohoang10/AITrading/issues/22
