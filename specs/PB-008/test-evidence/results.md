# PB-008 verification — Issue #12, 31/08/2026

Implemented provider boundary, durable owner-only attempts and explicit chat UI.
Local verification is separate from real provider verification. **AI-T10 is
BLOCKED: no project server OPENAI_API_KEY is available. Issue #12 remains open;
PB-008 is not DONE.** No request was sent to an external AI provider in this task.

## Evidence map

| Cases / AC | Executed coverage | Result |
| --- | --- | --- |
| AI-T01 /01 | Disabled/missing/invalid config, fixed production HTTPS endpoint, actual local HTTP request schema/auth, no redirects or automatic retry | PASS local |
| AI-T02 /02 | Actual Spring HTTP/PostgreSQL owner/BOLA, session, CSRF/Origin, mass-assignment denial before provider | PASS local |
| AI-T03 /02 | Latest user/version,20-message and16000-character whole-message windows, independent SHA256 context fixture | PASS local |
| AI-T04 /03 | Answer/clarification/assumptions, immutable bounded Unicode, unknown/duplicate/wrong-type/trailing fields, refusal/incomplete/tool rejection | PASS local |
| AI-T05–07 /04 | Pending/success replay, changed intent, quotas, max4 calls, cancel/edit/delete/revoke races, atomic DB rollback, expired lease and late result | PASS local |
| AI-T06 /04 | Real loopback HTTP401/403/429/500/504/400/302, chunked oversize/wrong MIME, hang after headers with whole-exchange timeout | PASS local |
| AI-T08 /05 |105 frontend tests including17 new API/component cases; saved-only action, status/no replay, uncertain UUID, reload recovery, cancel/late response and identity races | PASS local |
| AI-T09 /05 | Actual application with unconfigured provider at1600x1000,900x900,390x844; literal hostile text, draft retention, saved chat after real API restart | PASS for unavailable-provider path |
| AI-T10 /06 | Real configured OpenAI response, persistence and two-conversation smoke | BLOCKED — external project key missing |
| AI-T11 /06 | Full regression/build/audit, staged scope, normal push/exact SHA/actual CI | Local regression PASS; publication verification in progress |

## Browser evidence and limits

Used actual Vite127.0.0.1:5173 + Java API127.0.0.1:8080 + isolated PostgreSQL.
Signed in a synthetic account, created and renamed a conversation, and saved
literal script-shaped text. Exactly one user message remained; no assistant was
invented. Check AI availability reported unconfigured and Ask AI stayed disabled.
Document scroll width equalled viewport width at1600,900 and390 pixels. Mobile
message area scrolls independently. An unsaved draft survived mobile→tablet chat
navigation; no browser storage was read or written by the test tools.

Screenshots visually inspected: ai-unconfigured-desktop.jpg,
ai-unconfigured-mobile.jpg, ai-unconfigured-tablet.jpg, ai-after-api-restart.jpg.
The scope check caught JPEG capture bytes saved with a PNG extension before
commit; renamed the four artifacts to match their actual format, without editing images.
The desktop screenshot capture may crop the lower viewport; DOM checks verified
the disabled action and application state, while mobile shows the full controls.
Owned API restart24728→20644 against the same pg-test-680zw3p8 database retained
session, title and exact user content after reload. This verifies saved-chat
persistence, **not successful provider output across JVM restart**. The automated
lease-recovery test constructs a fresh service around persisted PG attempts; it
does not claim a killed JVM was restarted with an active provider request.
Signed out and reset viewport; owned API/DB stopped, generated password file
removed. No user PostgreSQL service changed. Two-user AI isolation is verified
by actual HTTP/PG integration tests, not an additional browser B-account journey.

## Regression commands

- Frontend npm run lint / npm run build / npm test / npm audit --audit-level=high:
  all exit0;105 tests,13 files,0 vulnerabilities. TypeScript and Vite build PASS;
  assets index-BrJpLWee.js and index-CddleWOv.css.
- python -m unittest discover -s python/tests -v:35 PASS, exit0.
- python -m unittest discover -s scripts -p test_verification_tools.py -v:6 PASS,
  exit0. python scripts/check_dsl_fixtures.py:6 independent fixtures PASS, exit0.
- python scripts/test_backend.py with Java21:clean compile/bootJar/test/inventory
  exit0;105 tests,0 failures/errors/skipped, real PostgreSQL17. Owned cluster
  pg-test-_v_spmgo stopped and generated credential file removed. Named JUnit
  evidence: backend-tests.json. Earlier104-test run also PASS after the repair below.
- python scripts/check_dependencies.py backend/build/reports/dependencies.txt
  tmp/pb008-dependency-audit.json:118 dependencies,0 findings,passed true,exit0;
  sanitized full report dependency-audit.json. No Python third-party dependencies.

## Repairs and security assessment

The first full104 backend run failed two availability tests because the new
GET /api/ai/capabilities lacked an authenticated SecurityConfig matcher. Added
that exact GET matcher; denyAll and test assertions were retained. Rerun104 PASS.
Final suite adds malformed/oversized requests,cancel rate and late-after-expiry
checks, and strengthens context-hash equality against an independent fixed value.

Provider body/error/key is not logged or echoed; context only comes from owned
saved messages. Actual HTTP stubs use clearly labelled synthetic keys/responses,
not production alternate endpoints. No configurable caller URL, redirect, tools,
eval, shell, upload/PDF parser or privileged mutation sink. Broken access control,
IDOR/BOLA, auth/session/CSRF, injection/mass assignment, XSS, SSRF, quotas, races,
timeouts and dependency security have relevant coverage; existing auth/password
regressions remain intact. There is no live trading/payment/RAG behavior here.

Presence-only checks on31/08/2026 show OPENAI_API_KEY absent in Process,User,Machine
environments; no values printed. Earlier AITRADING_AI_API_KEY discovery also found
none, but that alias is not used by the implementation. Codex credentials were
not read or reused. Operator setup is documented in README. store:false does not
promise zero retention; provider account policies apply. Cancellation cannot
promise upstream billing reversal. No new dependency or applied migration edit.

## Delivery

Pending scoped commit/push and actual CI. Leave Issue #12 open until AI-T10 and
all DoD requirements pass. Continue independent READY backlog work meanwhile.

31/08/2026 update: commit72ff79e0d891eb4241d837b08705d232a1266e5d normal-pushed
2a3cf20..72ff79e to origin/main; ls-remote and GitHub commit API agree. Actual
CI33362744818 both jobs success; downloaded JUnit105/0/0/0 and OSV118PASS verified.
38-file scope/protected blob/Markdown/limited secret-signature checks PASS;
git diff --check and staged diff check PASS; working tree clean after delivery.
AI-T11 PASS. Issue12 remains OPEN/BLOCKED for AI-T10, comment5474429092. No false
DoD completion; next independent READY feature PB-011 now Issue13.

31/08/2026 provider-neutral amendment: this original OpenAI-only evidence is
preserved. Current Gemini selection, V13, tests and publication stop condition
are tracked in provider-neutral-results.md. OpenAI is optional, and no previous
CI/commit certifies the uncommitted Gemini amendment or its real-provider smoke.
