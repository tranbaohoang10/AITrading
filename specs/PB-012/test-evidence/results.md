# PB-012 execution evidence — Issue #14

31/08/2026, Asia/Ho_Chi_Minh. Synthetic data only. Publication still pending.

## Implemented and checked

- Existing worker/engine/migrations/stack unchanged. GET owned frozen-candle page
  reads V7 input_json after current credential, ownership and SUCCEEDED checks.
- Authenticated Backtest Results/Trades use actual BacktestProvider; legacy mock
  shell tests remain isolated and unchanged. Explicit version/dataset, jobs,
  cancel/retry/delete, metrics, curves, exact trades/open positions, source and
  cost/hash provenance, frozen candles and distinct event markers are connected.
- Durable request ID preserved during uncertainty, including rejected retries;
  first definitive rejection allows corrected input. No automatic POST retry.
- Browser result decimals remain strings for inspection/export. Geometry uses
  normalized finite display values. Null ratios remain undefined. Exact intrabar
  protective exit time is never invented. Late job/chart/user replies discarded.

## Commands and outcomes

| Command / environment | Actual outcome |
| --- | --- |
| `python scripts/test_backend.py`, Java21 + owned PostgreSQL17 + real Python | Exit0; 123 JUnit tests,0 failures/errors/skips; owned pg-test-_gmy4pie stopped, credential file removed |
| `npm test` after integration | Exit0; original105 +23 new =128 PASS; subsequent uncertainty/keyboard/candle-race additions require final report below |
| `npm run lint`, `npm run build` | Exit0; TypeScript/Vite production build PASS; no new package/lock change |
| `npm audit --audit-level=high` | Exit0; 0 vulnerabilities |
| `python scripts/check_dependencies.py backend/build/reports/dependencies.txt backend/build/reports/dependency-audit.json` | Exit0;118 dependencies,0 findings; dependency-audit.json |
| `python -m unittest discover -s python/tests -v` | Exit0;40 PASS; actual CPU/memory supervised worker checks |
| `python -m unittest discover -s scripts -p test_verification_tools.py -v` | Exit0;6 PASS |
| `python scripts/check_dsl_fixtures.py` | Exit0;6 independent canonical fixtures PASS |
| `python scripts/backtest_ui_fixtures.py --check` | Exit0;6 actual engine UI fixtures match; hand expectations100/0/-100/100/-9900/-100 net profit |
| `git diff --check` during work | Exit0; only normal Windows LF/CRLF notices |

Fixture cases: win,zero,loss,open,negative-equity and protective gap stop. The first
negative fixture was rejected by the existing leveraged-stop constraint; corrected
the test input to stop10% at leverage10, preserving the validator and expected
gap loss. No expected outcome was weakened. Early UI tests selected duplicate
displayed numbers ambiguously; selectors now name the specific metric. Browser
End key initially left native range unchanged; production handles Home/End/arrows
explicitly with bounds and a regression assertion. An initial sandbox Vite cache
write was denied; normal approved escalation ran the same build successfully.

## Actual browser journey

API served by owned pg-test-xq_as13o; initial JVM7216, restarted JVM26576.
Vite127.0.0.1:5173 → API127.0.0.1:8080 → PostgreSQL → supervised Python.
Registered a synthetic researcher through the UI, imported three known candles,
created a script-like inert strategy title and saved its real VALIDATED r2.
No API shortcuts, hidden browser stores or mock job responses used in this journey.

Explicit Start produced job e927bc1a-b681-4c03-9233-eb689e21c0fb and actual RUNNING;
manual refresh observed SUCCEEDED. Net100,closedTrades1,equity1100,entry100,exit110.
InputHash38a8086659b4719bac0995ec08fcb4c07d62aa9ba213ce381805ad76d3ed428f;
resultHash b04fd6e6beb34cea4e48d341fe1057854d82da10d6059ccfbded44fa48353494.
Signal0/entry1/exit2 align with frozen UTC bars. End selects result bar2 close03:00Z;
Home selects frozen candle0 open00:00Z. Title remains literal text.

Desktop1600,tablet900,mobile390 were navigated and screenshots visually inspected.
Provider keeps the selected job across responsive panes; new browser load restores
owned history after explicit selection. Mobile chart/buttons wrap within390px;
trade/event/provenance details remain accessible through scrolling/disclosures.
Images are JPEG viewport captures and do not claim every off-screen row is visible.
Screenshots: desktop-result,desktop-frozen-chart,desktop-trade,tablet-result,
mobile-result,mobile-frozen-chart (.jpg).

Deleted only this synthetic source dataset via confirmation. Refreshed job result
and frozen chart still correct; source-deleted-dom.txt records provenance. Restarted
only the owned API, reloaded browser and selected the same persisted job. Same
result hash and all three frozen candles restored (restarted-dom.txt). Original
source no longer appears as an available new-run input. Export JSON was explicitly
clicked in browser; component test verifies Blob type/static safe filename. The
browser download destination is not exposed here; no claim of filesystem download
verification is made. Export payload serialization is covered separately in tests.

## Applicability and remaining delivery

BOLA/IDOR/auth/revocation, invalid bounds/state, unknown resource, source deletion
are actual backend HTTP/PG/Python tests. Existing CSRF/rate/session/worker/DB-race
tests remain regression requirements. UI tests exercise no-autostart, wrong
identity/hash/time/decimal, zero/loss/open/protective/negative equity, stale results
and candles, identity remount, uncertain/rejected retry, delete confirmation,
cancel/new snapshot retry, inert labels and safe explicit export.

No new upload, URL fetch, provider, crypto, password, shell, migration or package
surface. Existing attack-class tests run; this feature does not certify deferred
AI/RAG/broker work. PB-008 real-provider smoke still blocked on server project key.
Exact staged scope/protected files, final counts, GitHub SHA/CI and Issue closure
will be appended only after those checks succeed.

### Final local checks (31/08/2026)

Full frontend run after the export-content and candle-race assertions:130 PASS,
0 failed/pending, exit0 (frontend-tests.json). Lint exit0; production build passed
for the same production source. Blob read-back equals the selected job plus exact
server result and contains no credential fields. No console test warnings remain.
Backend123/Python40/verifier6/canonical6 and fixture6 checks above are all PASS.
Publication remains pending; this paragraph does not declare Issue completed.

### Cross-tab identity hardening and final regression

Added authenticated current-user verification before publishing each asynchronous
backtest response, catching a shared session switched in another tab. A tab does
not claim instantaneous revocation of already-rendered data: its next successful
server read detects mismatch and clears authenticated workspace. Actual browser B
has empty jobs/inputs and no A result (other-user-empty.jpg); the old A tab's next
Refresh jobs cleared it to sign-in (cross-tab-session-dom.txt). This verifies the
explicit read boundary, not OS screen locking or instantaneous cross-tab broadcast.
Final full run after this fix:131frontend PASS,0 failed/pending; lint/build exit0.
Existing123backend/40Python/security audits remain unchanged and PASS.
The final error-path guard discards an unverified job before any follow-up read;
26 targeted backtest tests and production build/lint rerun. Both synthetic browser
accounts signed out; owned xq_as13o API/PG stopped exit0 and credential file removed.

### Publication complete

Normal push bcdeaff..493b737. Exact origin/main and GitHub commits/main SHA:
493b737bf8c28950df10c3667b837dd35f77aff5.44files,3535insertions,10deletions;
full/staged scope+diff check and protected blobs/migrations/engine/locks PASS.
CI33368826001 frontend/backend SUCCESS. Actual frontend log131PASS/audit0;
downloaded backend artifact123tests/0failures/errors/skips and OSV118 PASS. CI's
Python and regenerated UI fixture checks PASS. Issue14 CLOSED/COMPLETED,
comment5475264704. Working tree clean after push. PB-013 Issue15 created next.
RES-T10 publication requirement now PASS. This does not close blocked PB-008.
