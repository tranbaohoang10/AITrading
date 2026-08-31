# PB-007 verification — Issue #10

31/08/2026, Asia/Ho_Chi_Minh. Synthetic local fixtures; Codex implementation
verification, not independent approval or financial advice.

## Local execution

- Java21/PostgreSQL17.11 `python scripts/test_backend.py`: full84 tests PASS after
  correcting a compile import collision. Final run after strengthening the
  revision99 concurrent quota boundary is in progress; result appended below.
  Includes all74 prior auth/chat/DSL/market/foundation tests unchanged except the
  required current Flyway assertion4→5; applied migrations V1–V4 preserved.
- Frontend `npm run lint`, `npm run build`, `npm test`: exit0,88 tests across11
  files;13 strategy state/UI and4 API contract tests plus71 prior tests.
  Last build assets index-B9cXtKor.js, index-Dm56lsLT.css. No skipped tests.
- `npm audit --audit-level=high`: exit0,0 vulnerabilities. No dependency change.
- `python -m unittest discover -s scripts -p test_verification_tools.py -v`:
  exit0,6 fail-closed dependency/cleanup tests.
- `python scripts/check_dsl_fixtures.py`: exit0,6 independent canonical fixtures.
- `python scripts/check_dependencies.py backend/build/reports/dependencies.txt
  tmp/pb007-dependency-audit.json`: exit0,118 locked Java coordinates,0 findings.
  Point-in-time OSV audit, not proof of absence of all vulnerabilities.

## AC and separate test case evidence

| Test | Actual execution |
| --- | --- |
| STR-01 | Actual ownedDraftAndValidatedRevisionsKeepExactImmutableTextAndCanonicalMetadata plus browser create/draft/reopen/history. Exact incomplete text preserved, old revisions unchanged, no draft payload in list. PASS |
| STR-02 | draftBoundsUnicodeAndValidationFailuresNeverPromoteOrTruncateText: empty/64KiB/+1/multibyte/surrogate/control/title boundaries, no truncation. PASS |
| STR-03 | Real server save against PB-005 validator: metadata/hash equal independently validated fixture, malformed/schema-invalid/duplicate JSON rejected422, no insert. Browser draft r2 retained after invalid validated save; explicit Validate alone leaves revision unchanged. PASS |
| STR-04 | createAndAppendReplayKeepOriginalIntentEvenAfterNewerRevisions and concurrentSameIntentAndStaleWritersCannotDuplicateOrOverwrite; actual two-tab conflict retained local edits and server revision. PASS |
| STR-05 | Actual quota fixtures99strategies and99revisions, next100 accepted, over limit409, replay accepted at limit. Concurrent strategy quota PASS; final strengthened concurrent revision quota run pending below. |
| STR-06 | Actual DB trigger failure after revision insert rolls back pointer and new row; simultaneous read/save/delete allows only coherent snapshot or404/409. Delete affects only owned strategy; browser cancel/confirm preserves research strategy/dataset. PASS |
| STR-07 | allOwnedPathsRejectForeignUsersAndUnknownIdsWithoutLeakingContent: B current/history/exact revision/save/delete A denied404, stale credential mutations/HTTP401. Browser B list empty after A creates6revisions. PASS |
| STR-08 | HTTP CSRF/wrong token/Origin/anonymous, exact512KiB chunked and+1, other endpoint limits, unknown derived fields/duplicate/type coercion, atomic write59→60/429 and read300/429, independent B/window recovery. PASS |
| STR-09 | UI ignored delayed validation after edits, old selection read and previous-user save; beforeunload warning and provider state under keyed auth. Real mobile→tablet retained unsaved title; shell aliases/navigation unit tests retain draft. PASS |
| STR-10 | UI same UUID/exact payload retry, double-click suppression, disabled uncertain editor,409 keeps draft; browser cancel reload returns focus and text, confirmation loads newer server version. PASS |
| STR-11 | Read-only history then explicit copy saves next revision, no auto-save from sample or Validate; hostile text stays textarea/pre,64KiB UTF-8 client guard. Chart mismatch/match test retains saved context when editor changes. Actual desktop/mobile chart mismatch visible. PASS |
| STR-12 | Actual browser1600x1000 /900x900 /390x844, real API/DB: create/save/invalid/history/conflict/restart/hash/delete/two-user isolation. Images below; no horizontal page overflow. PASS |
| STR-13 |88frontend,84backend before final quota strengthening,6verifier/6canonical,lint/build/audits PASS. Final full backend, scope and publication/CI required below. |

## Actual browser journey

Owned API harness43524, PostgreSQL pg-test-ywf3l31_, JavaPID2568 then656 after
restart. A/B are synthetic accounts on this DB, never real-service credentials.

1. A created Private price research A: r1 empty DRAFT; saved `{ incomplete draft`
   as r2 DRAFT. Save validated rejected it with MALFORMED_JSON, no r3 was created.
2. Explicit synthetic neutral price-action example filled editor. Validate reported
   valid without changing r2. Save validated created r3, schema/validator1.0.0.
3. Imported clearly labelled DEMO_USD360 synthetic candles; chart showed actual
   prices, and warned mismatch with saved BTC_USDT/1h strategy. No backtest enabled.
4. Second browser tab loaded r3 and saved title Remote title revision4 as r4.
   Original tab tried Unsaved local title using r3:409, draft retained. Cancel
   Reload returned focus to its trigger and kept text. Confirm reload loaded r4.
5. Read-only preview of r2 did not change editor. Use revision copied it, Save draft
   created r5. Preview/copy r4 followed by validated save created r6. All earlier
   revisions remained in history. No in-place history edits occurred.
6. Unsaved mobile title survived390→900 resize. Restored saved title then reloaded
   r6. Mobile editor/chart toggle worked, text wrapped and controls remained usable.
   Document scrollWidth equals viewport width1600,900,390.
7. Restarted owned API, reloaded whole page, selected persisted r6. Same raw draft,
   all6 revisions and canonical SHA256
   `93552dae78712326cabe76cb51e828c0336984e2ba5e75bbe381331a872f84dd`, schema/validator
   1.0.0 and minimumBars1 remained. API restart did not require new account.
8. Created separate Disposable deletion fixture. Cancel delete returned focus and
   retained it; confirmed delete removed only that fixture. Research r6 remained.
   New B account had empty strategy and dataset lists, no A content. B identity
   confirmed through Account; signed out, active viewport override reset and original
   tab navigated away from old private content. Owned API/PG shut down exit0 and
   generated password file removed. Vite remains local for continuing backlog work.

Screenshots (actual UI, not mockups):

- [Invalid draft rejected](strategy-invalid-desktop.png)
- [Desktop editor and real chart](strategy-chart-desktop.png)
- [Conflict preserves draft](strategy-conflict.png)
- [Tablet retains unsaved draft](strategy-tablet-draft.png)
- [Mobile editor](strategy-mobile.png)
- [Mobile chart and mismatch](strategy-mobile-chart.png)
- [After restart](strategy-after-restart.png)
- [User B empty workspace](strategy-user-b-empty.png)

## Failures and fixes

- Initial Java compile failed because wildcard java.security and java.sql both
  export Timestamp. Replaced security wildcard with explicit imports, reran full
 84test build PASS. First failed owned cluster stopped and password removed.
- New frontend test used unsupported `exact` option on Testing Library getByRole.
  Removed option; string name matching already exact. No expected result weakened.
- Initial full87test run had1 fixture failure: authenticated Shell lacked required
  ConversationProvider. Added actual provider with empty list API contract mock;
  corrected expected existing dialog label Mobile navigation. All tests passed.
- Two-tab browser revealed selected header r4 but selector still showed old r3
  after reload. Updated apply() to refresh the selected list metadata while keeping
  list creation time/order; removed redundant raw-revision spread into metadata.
  Added assertion and verified actual browser selector Remote title revision4·r4.
  Then full87 passed, final88 after chart match/mismatch test also PASS.

## Security and scope limits

Backend owns authorization, exact revision checks, validation metadata and atomic
transactions. Frontend hiding controls is not an access control. Raw DRAFT may
contain arbitrary bounded text but is never executed or parsed as remote code.
No URL/file/SQL/template/eval path is introduced; untrusted data stays text and
prepared SQL parameters. Existing password/hash/session/outage/market/DSL tests
remain; no test/security disable or required check skipped.

No dependency/stack, applied migration, legacy governance, protected mvp-ui review,
credit/payment, live broker, AI/provider or runtime/export change. V5 is additive.
Storage limits bound revision history; saved text is not automatically pruned to
make room. Idempotency applies while strategy exists; no tombstone after deletion.
An original replay may return an older immutable revision after another client
advances; next save conflicts safely and explicit Reload is available. Drafts only
persist when saved; no localStorage/private cache, forced reload/signout can lose
unsaved edits. Browser restart check is API restart, not retention of unsaved state.

Final scoped commit/push, exact GitHub SHA and actual CI pending before DoD closure.

## Final local run

Full backend harness exit0:84 tests,0 failures,0 errors,0 skips; clean build and
dependencyInventory PASS. Revision99 concurrent writers produce200/409, max100
and winner replay PASS. STR-01–12 now PASS; STR-13 local checks PASS and awaits
GitHub delivery/CI. Exact JUnit names in backend-tests.json. Owned test cluster
pg-test-eq1si3jo stopped and generated credential file removed.
Protected mvp-ui blobs remain e03fe3d3fcdc7eef83d83f819ca848c6b8e49b39 and
5fb05f3f5d82640776c77283bacb8e529344c067 on feature/mvp-ui; no edits/stash/revert
or inclusion in this scope. Applied V1–V4 and all dependency locks unchanged.
