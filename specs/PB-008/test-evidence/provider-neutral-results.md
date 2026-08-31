# PB-008 provider-neutral evidence â€” 31/08/2026

Issue #12; baseline main761f3b47e692be69b4c81aa619cbbf4f03d42e88.
This is the current Gemini amendment; original OpenAI evidence stays historical.
No real-provider result is inferred from a loopback fixture or UI mock.

## Local verification

| Command / evidence | Actual result |
| --- | --- |
| Java21 Wrapper compileTestJava | Exit0; production and contract tests compile |
| `python scripts/test_backend.py`, first run | Exit0;208 tests,0 failures/errors/skips; OpenAI8 + API13, Gemini7 + API15, selection3 |
| Same command after adding V12â†’V13 upgrade test | Exit1;209 tests,1 failure,0 errors/skips. Upgrade test PASS; existing MarketApiTests maximum5000-row import returned503 instead of200 while a separate smoke API was starting |
| Final isolated backend run (`tmp/pb008-neutral-backend-serial.log`) | Exit0;209 tests,0 failures/errors/skips; all original market-data assertions and new V12â†’V13 upgrade PASS; no production/assertion/timeout change |
| `npm run lint` and `npm run build` | Exit0 each; TypeScript/Vite build PASS |
| `npm test -- --reporter=default --reporter=json --outputFile=../tmp/pb008-neutral-frontend.json` | Exit0;24 files,209 tests PASS, including25 AI parser/component cases |
| `python -m unittest discover -s python/tests -v` | Exit0;44 PASS |
| `python -m unittest discover -s scripts -p test_verification_tools.py -v` | Exit0;6 PASS |
| `python scripts/check_dsl_fixtures.py` | Exit0;6 independent canonical fixtures PASS |
| `python scripts/backtest_ui_fixtures.py --check` | Exit0;6 engine/UI fixtures PASS |
| `npm audit --json` | Exit0;0 vulnerabilities |
| `python scripts/check_dependencies.py backend/build/reports/dependencies.txt tmp/pb008-neutral-dependency-audit.json` | Exit0;118 resolved Java artifacts,0 OSV findings |
| `python scripts/smoke_ai.py --owned tmp/pg-test-svz1l_cn --report specs/PB-008/test-evidence/provider-neutral-local-smoke.json` | Exit0;actual HTTP/PG, disabled Gemini, two synthetic owners, expected-account/CSRF denial, no assistant fabrication, persistent session/messages across actual JVM restart |

Actual smoke JVM15044â†’23588, same owned database; the script observed API down/up,
then compared exact persisted messages/session/capabilities. Both synthetic API
accounts signed out. API and owned PG stopped, generated password file removed.
This smoke used `--serve` with AI=false, selector=gemini and both real keys removed
from the child environment. `--serve` builds/serves; it is not a test-suite result.

Actual browser: new synthetic local account, New Chat, save synthetic message,
explicit availability check, disabled Ask AI and Gemini data-use warning; saved
message recovered after page reload. Screenshots inspected at1600Ã—900 and390Ã—844:
`gemini-unconfigured-desktop.png`, `gemini-unconfigured-mobile.png`. No assistant
or API key shown. Browser account signed out and viewport reset. Configured Gemini
success/failure/races are component/contract tests, **not** a real browser AI reply.

## Traceability and security assessment

GP01â€“04: AiProviderConfigurationTests/GeminiProviderTests cover exact startup
selection/default/disabled/invalid configuration, no OpenAI-key fallback, fixed
official destination/model segment and header-only synthetic key, wire roles and
closed schema, whole-body timeout/interruption/byte cap,401/403/429/408/504/5xx/
redirect/wrong MIME/disconnect, strict UTF8/duplicate/unknown JSON, missing/multiple
candidates, refusal/incomplete/thought/tool/non-text output and decoded key echo.
OpenAI's original8 tests still run through the shared trusted transport/protocol.

GP05â€“06: GeminiAiApiTests inherits all13 original HTTP/PostgreSQL tests without
removing assertions, plus provider-history switching and capability/binding tests.
Ownership, credential revocation, CSRF/origin, mass assignment, bounded context/
hashes, quotas, concurrent starts/cancel/stale context and expired leases remain
enforced. Restarted AiService instances prove durable request replay; separately,
the local smoke above proves actual JVM/session/chat restart. AiProviderMigrationTests
creates a separate database only inside the harness-owned cluster, migrates toV12,
inserts historical OpenAI context/attempt, upgrades toV13, validates exact row
preservation and acceptance of Gemini/rejection of arbitrary providers. No applied
migration or existing row is rewritten in production.

GP07: frontend validates Gemini/OpenAI/null versus unknown selectors, preserves
old OpenAI attempt provenance, uses fixed malformed JSON errors with64KiB limit,
renders the synthetic-only warning and keeps drafts/account epochs/disabled-race/
pending/cancel/error states. Gemini429/5xx/timeout/invalid output never invent a reply.
Only authoritative saved messages render, as inert text; script-looking text is not
executed. Model/credentials/provider URL are not caller-controlled API fields.

GP08: full regressions include existing auth/Argon2id/session/brute-force/rate-limit,
ownership/BOLA, CSRF, injection/mass-assignment, XSS, request budgets, concurrency,
audit redaction and fixed subprocess/worker tests. No new upload, file parsing,
RAG, browser token storage, path input, URL fetch, tools or code-execution surface;
upload/path traversal/SSRF mitigations remain unchanged. Local negative tests
target owned test systems only. No dependency, lockfile, stack, auth/governance or
CI setting change. A signature scan is a limited check, not proof of absence of
every possible secret. Free-tier data classification is an operator constraint,
not a claim that software recognizes all private text.

## Repairs and limitations

The initial frontend command was denied writing Vite's temporary config by the
sandbox; normal authorized escalation resolved it. Two new parser tests initially
omitted required expected-account IDs and correctly hit401; their synthetic test
inputs were fixed, with production binding unchanged, then25/25 focused and209/209
full frontend tests PASS. The browser's generic-role locator timed out during
reload verification; a fresh DOM snapshot confirmed the persisted message and
warning without changing application state or code.

The second backend run's single503 is retained above. Starting an extra API during
that run introduced resource contention; this is a hypothesis, not proof of cause.
The smoke API was stopped and the full suite rerun alone:209/209 PASS. The
market-data assertion was not weakened; the failed run remains recorded as failed.

## Publication and remaining prerequisite

GP09 real Gemini2.5Flash smoke: NOT RUN/BLOCKED. After all local verification
passed, presence-only checks found GEMINI_API_KEY absent in Process, User and
Machine environments. No key values were printed or requested. Stop here per PO:
uncommitted/unpushed, Issue12 OPEN, no next feature. Only prerequisite to request
from PO: configure GEMINI_API_KEY securely in the project server environment.
This amendment has no new commit/push/CI result. Baseline CI is not evidence for
uncommitted code. DoD still requires real synthetic Gemini smoke, Vietnamese
Refs #12 commit, normal main push, exact GitHub SHA and CI before Issue closure.

## Scope and preserved work

PRE-EXISTING CHANGES: baseline working tree clean. The two protected mvp-ui
re-review files are absent on main and remain untouched in historical feature/mvp-ui;
their Git blobs remain e03fe3d3fcdc7eef83d83f819ca848c6b8e49b39 and
5fb05f3f5d82640776c77283bacb8e529344c067. They are not part of this task's diff.

CHANGES CREATED BY THIS TASK: provider selection/shared validation/transport,
Gemini adapter, optional OpenAI refactor, V13, provider/API/migration/frontend tests,
safe Gemini UI/parser, isolated test/smoke harness, README/architecture/CNPM/backlog/
execution and PB008 documents/evidence. No new product feature, governance policy,
dependency or applied migration edit. Exact paths are listed below. Structured
counts/audits: provider-neutral-checks.json. git diff --check, empty staged scope,
Markdown links/fences and limited secret-signature/whitespace checks PASS. All
owned test clusters stopped and generated password files removed.

### Exact task paths

- `README.md`
- `backend/src/main/java/com/aitrading/ai/AiHttpTransport.java`
- `backend/src/main/java/com/aitrading/ai/AiProvider.java`
- `backend/src/main/java/com/aitrading/ai/AiProviderConfiguration.java`
- `backend/src/main/java/com/aitrading/ai/AiProviderProtocol.java`
- `backend/src/main/java/com/aitrading/ai/GeminiProvider.java`
- `backend/src/main/java/com/aitrading/ai/OpenAiProvider.java`
- `backend/src/main/resources/db/migration/V13__ai_provider_neutral.sql`
- `backend/src/test/java/com/aitrading/AiTradingApplicationTests.java`
- `backend/src/test/java/com/aitrading/ai/AiApiTests.java`
- `backend/src/test/java/com/aitrading/ai/AiProviderConfigurationTests.java`
- `backend/src/test/java/com/aitrading/ai/AiProviderMigrationTests.java`
- `backend/src/test/java/com/aitrading/ai/GeminiAiApiTests.java`
- `backend/src/test/java/com/aitrading/ai/GeminiProviderTests.java`
- `docs/architecture.md`
- `docs/cnpm-index.md`
- `docs/execution-state.md`
- `docs/product-backlog.md`
- `frontend/src/chat/AiChat.test.tsx`
- `frontend/src/chat/ConversationProvider.tsx`
- `frontend/src/chat/PersistentChat.tsx`
- `frontend/src/chat/aiApi.test.ts`
- `frontend/src/chat/aiApi.ts`
- `scripts/smoke_ai.py`
- `scripts/test_backend.py`
- `specs/PB-008/design.md`
- `specs/PB-008/provider-neutral-test-cases.md`
- `specs/PB-008/provider-neutral.md`
- `specs/PB-008/revision-history.md`
- `specs/PB-008/spec.md`
- `specs/PB-008/tasks.md`
- `specs/PB-008/test-cases.md`
- `specs/PB-008/test-evidence/gemini-unconfigured-desktop.png`
- `specs/PB-008/test-evidence/gemini-unconfigured-mobile.png`
- `specs/PB-008/test-evidence/provider-neutral-checks.json`
- `specs/PB-008/test-evidence/provider-neutral-local-smoke.json`
- `specs/PB-008/test-evidence/provider-neutral-results.md`
- `specs/PB-008/test-evidence/results.md`

31/08/2026 Issue12 updated: https://github.com/tranbaohoang10/AITrading/issues/12#issuecomment-5479932799 ; remains OPEN. No commit/push; final main and GitHub SHA761f3b47e692be69b4c81aa619cbbf4f03d42e88. Working tree:21 modified +17 untracked task paths, index empty.

## 31/08/2026 â€” real Gemini smoke attempted; requested model unavailable

PO confirmed secure key setup and authorized real synthetic smoke. Presence-only:
Process=false,User=true,Machine=false. Passed the Windows User key directly to the
owned API child environment (never a key file/CLI argument); Gemini enabled with
model gemini-2.5-flash. Existing38-file PB008 scope resumed, no DONE work rebuilt.

`python scripts/smoke_ai.py --owned tmp/pg-test-1lrfxa5s --report
specs/PB-008/test-evidence/gemini-real-smoke.json --real-gemini` exited1:
AI_PROVIDER_REJECTED. No successful report file was created. Owned PG confirms one
FAILED Gemini turn and zero assistant messages; synthetic API accounts signed out.
The real-provider restart path was not reached and is not claimed PASS.

Safe diagnostics to the official fixed HTTPS API with the same key:
1. Full structured generateContent request: HTTP404/NOT_FOUND.
2. Models List: HTTP200,53 models, requested2.5Flash advertised for generateContent.
3. Minimal synthetic request, without schema/thinking fields and with store=false:
   HTTP404/NOT_FOUND. Classification of the provider message states the model is
   no longer available to new users. No raw message/body, project ID or key printed.

Thus presence/listing is not evidence of generation access. This is an external
model-availability blocker, not a reason to weaken structured validation, auth,
rate/time bounds or switch to OpenAI. Actual-key equality checks found no key in
owned API/harness/smoke logs or stored message/response content. API26924 and PG
were stopped; generated temporary DB password removed. Sanitized machine-readable
result: gemini-real-smoke-attempt.json. No production/source/test change this resume;
prior local209backend/209frontend/44Python PASS remains valid for unchanged code.

GP09 / AI-06 / AI-11 is now attempted FAILED/BLOCKED, superseding NOT RUN/key-absent
status in earlier entries. Issue12 remains OPEN; no commit, push, CI, closure or
next feature. Keep all dirty PB008 work for resume. The previous configuration
explicitly selected2.5Flash; switching to another model changes that requirement.
Proposed resolution: PO selects/authorizes a currently available Gemini model,
then adapt its documented thinking configuration, update contract/smoke tests,
run real synthetic smoke and complete DoD/publication only after PASS.

Official references inspected31/08/2026:
[API key types](https://ai.google.dev/gemini-api/docs/generate-content/api-key),
[model deprecations](https://ai.google.dev/gemini-api/docs/deprecations),
[Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash).
The pricing table lists a free tier for gemini-3.5-flash, which Models List also
advertised here; generation access/quota for a replacement is not yet verified.
No alternate-model request or key/IAM/billing mutation was performed.

31/08/2026 blocker receipt: Issue12 comment5480129340 updated, remains OPEN. Final main761f3b47e692be69b4c81aa619cbbf4f03d42e88;21 modified +18 untracked, empty index, no commit/push. New path for this resume: specs/PB-008/test-evidence/gemini-real-smoke-attempt.json. Actual-key equality scan across39 task files found no key.

## 31/08/2026 â€” PO-approved Gemini3.5Flash revision

Issue12 comment5480218688 records the approval before implementation. Model
default is confined to AiProviderConfiguration, explicit model override retained,
OpenAI optional with its own explicit model. No business-service or dependency
change. Gemini now requests store=false/includeThoughts=false without imposing a
2.5-specific thinking budget. Optional bounded base64 thoughtSignature is validated
then discarded; closed AiAnswer validation and no-tools boundary remain unchanged.
New cases prove default/override/OpenAI behavior and invalid/oversized metadata/
secret-bearing answers. UI fixtures exercise3.5Flash. Smoke tooling now checks
two synthetic turns, independently hashes exact context, excludes same-owner and
other-owner decoys, checks replay and actual restart persistence.

Local commands31/08/2026:
- `python scripts/test_backend.py`: first211 run exit1, one QueryTimeoutException
  in GeminiAiApiTests setup while DELETE app_user cascaded the preceding2000-message
  quota fixture. All model/protocol tests passed. No assertion/timeout changed.
- Same command, isolated rerun: exit0,211 tests,0 failures/errors/skips; owned
  pg-test-mxo9uwkb stopped and generated password removed. BootJar and inventory PASS.
- `npm run lint`, `npm run build`, `npm test`: exit0 each,209/209 tests,24 files.
- Python unittest44, verification tools6, independent DSL fixtures6 and real engine
  UI fixtures6: exit0 each. `npm audit --json`:0 vulnerabilities.
- `python scripts/check_dependencies.py backend/build/reports/dependencies.txt
  tmp/pb008-gemini35-java-audit.json`: exit0,118 artifacts,0 OSV findings.

Machine-readable current local evidence: gemini35-checks.json. Earlier failed
model and intermediate-test results are preserved; no old CI certifies this dirty
revision. Real3.5Flash smoke/publication remain pending at this checkpoint.


## 31/08/2026 â€” Gemini3.5Flash real smoke PASS

Command: `python scripts/smoke_ai.py --owned tmp/pg-test-hw_1oqqh --report
specs/PB-008/test-evidence/gemini35-real-smoke.json --real-gemini --model gemini-3.5-flash`
Exit0. Two actual external requests, new synthetic accounts/prompts only. The
production strict adapter accepted both structured answers; DB stores exactly two
assistant messages, both attempts SUCCEEDED/provider gemini/model3.5Flash. Context
hashes independently match exact saved context (one then three messages), no
same-owner/other-owner decoy inclusion, owner/binding/CSRF checks denied, replay
unchanged before/after actual API12520â†’14444 restart. Four target messages remain
identical; six messages total include two untouched decoys. Synthetic API accounts
signed out. No key in stored messages or API/harness/smoke logs by exact comparison.
No raw response, message text, account credentials or key included in reports.

GP01â€“09 / AI01â€“11 functional and security evidence now PASS; publication/exactSHA/
CI remains pending. The earlier2.5Flash404 and transient fixture-cleanup failure
are retained, not rewritten as successes. No dependency/stack/security relaxation.


31/08/2026 final scope:41 PB008 paths, no unrelated pre-existing work included.
Protected mvp-ui historical blobs unchanged. Owned smoke API/PG stopped and
generated DB password removed. Full diff and diff --check PASS; actual-key scan
across all41 paths PASS; no .env tracked, no stack/CI/governance/lockfile edits.
Exact publication scope:
- README.md
- backend/src/main/java/com/aitrading/ai/AiHttpTransport.java
- backend/src/main/java/com/aitrading/ai/AiProvider.java
- backend/src/main/java/com/aitrading/ai/AiProviderConfiguration.java
- backend/src/main/java/com/aitrading/ai/AiProviderProtocol.java
- backend/src/main/java/com/aitrading/ai/GeminiProvider.java
- backend/src/main/java/com/aitrading/ai/OpenAiProvider.java
- backend/src/main/resources/db/migration/V13__ai_provider_neutral.sql
- backend/src/test/java/com/aitrading/AiTradingApplicationTests.java
- backend/src/test/java/com/aitrading/ai/AiApiTests.java
- backend/src/test/java/com/aitrading/ai/AiProviderConfigurationTests.java
- backend/src/test/java/com/aitrading/ai/AiProviderMigrationTests.java
- backend/src/test/java/com/aitrading/ai/GeminiAiApiTests.java
- backend/src/test/java/com/aitrading/ai/GeminiProviderTests.java
- docs/architecture.md
- docs/cnpm-index.md
- docs/execution-state.md
- docs/product-backlog.md
- frontend/src/chat/AiChat.test.tsx
- frontend/src/chat/ConversationProvider.tsx
- frontend/src/chat/PersistentChat.tsx
- frontend/src/chat/aiApi.test.ts
- frontend/src/chat/aiApi.ts
- scripts/smoke_ai.py
- scripts/test_backend.py
- specs/PB-008/design.md
- specs/PB-008/provider-neutral-test-cases.md
- specs/PB-008/provider-neutral.md
- specs/PB-008/revision-history.md
- specs/PB-008/spec.md
- specs/PB-008/tasks.md
- specs/PB-008/test-cases.md
- specs/PB-008/test-evidence/gemini-real-smoke-attempt.json
- specs/PB-008/test-evidence/gemini-unconfigured-desktop.png
- specs/PB-008/test-evidence/gemini-unconfigured-mobile.png
- specs/PB-008/test-evidence/gemini35-checks.json
- specs/PB-008/test-evidence/gemini35-real-smoke.json
- specs/PB-008/test-evidence/provider-neutral-checks.json
- specs/PB-008/test-evidence/provider-neutral-local-smoke.json
- specs/PB-008/test-evidence/provider-neutral-results.md
- specs/PB-008/test-evidence/results.md
