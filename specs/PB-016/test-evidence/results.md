# PB-016 verification results — 31/08/2026 — Refs #18

Local implementation checkpoint; **feature DoD is not complete**. Official MQL5
compilation is PASS; actual MQL runtime/event and CSV negative execution are
NOT RUN, as explained in [target validation](target-validation.md). No script,
mock log, Python run or source snapshot substitutes for target execution.

## Local evidence

- `python scripts/test_backend.py` (`tmp/pb016-backend-tests.log`):163tests,
  zero failures/errors/skips, real HTTP/PostgreSQL, build/dependency inventory PASS.
- `npm run lint`, `npm run build`, `npm test`:186tests/22files PASS; final UI run
  `tmp/pb016-frontend-final.log` includes updated Strategy editor explanation.
- `python -m unittest discover -s python/tests -v`: first42-test run had one CPU
  deadline probe timeout while heavy suites ran concurrently. No timeout/expected
  result changed; same full42 passed in12.964s on retry after that workload ended
  (`tmp/pb016-python.log`, `tmp/pb016-python-retry.log`). First failure is retained.
- `python -m unittest discover -s scripts -p test_verification_tools.py -v`:6PASS;
  `check_dsl_fixtures.py`:6PASS; `backtest_ui_fixtures.py --check`:6PASS.
- `python -m unittest discover -s scripts -p test_mql5_trace_verifier.py -v`:2PASS.
  These test rejection of missing/duplicate/wrong-source/event/numeric/error logs
  with synthetic strings only. They do not execute the target.
  Final location is `python/tests/test_mql5_trace_verifier.py`, so the existing CI
  Python discovery runs these tests too. Final unchanged-engine suite44PASS in
  7.306s (`tmp/pb016-python-final.log`); no CI workflow change needed.
- Java OSV118 coordinates, no findings (`tmp/pb016-java-audit.json`); npm audit0
  vulnerabilities (`tmp/pb016-npm-audit.json`). No dependency/lockfile changed.
- Official MetaEditor:8generated fixtures,0errors/0warnings, fresh EX5 and code
  hashes in [compiler.json](compiler.json). Source/CSV copies are preparation for
  runtime comparison, not MQL PASS. No compiled binaries are committed.

## Actual browser and persistence

Synthetic A/B users only, local8080/5173 with owned PostgreSQL cluster6sjuvufm.
Actual JVM5256→21520 down/up and persistent session/artifact/replay/hash/deletion
are verified in [restart smoke](restart-smoke.json). The smoke creates its own
synthetic source; the browser source has a different UUID and therefore code hash.

- Empty MQL5 selection reports no source, never inserts demo output.
- Saved DRAFT r1 rejected clearly ([DOM](browser-draft.md)). Explicit synthetic
  sample savedVALIDATEDr2, then unsaved title changed. Generate used savedr2 and
  retained unsaved title ([draft retained](browser-draft-preserved.md)).
- Actual generated source, provenance and copy-success status in
  [generation DOM](browser-generated.md). Source UUID
  `ca9b1f20-8281-46a0-9014-726c19a2bbff`, DSLhash
  `93552dae78712326cabe76cb51e828c0336984e2ba5e75bbe381331a872f84dd`, codehash
  `9605b6a48141bd6dfb928c2ee927242fc669b0062c38c02788f7b1e526a77dc7`.
- Visually inspected actual [desktop1600](browser-desktop.jpg),
  [tablet900](browser-tablet.jpg), [mobile390](browser-mobile.jpg). Document width
  equals viewport on900/390; code scrolls inside its own region. Responsive remount
  reloads the same owned saved artifact. [Mobile DOM](browser-mobile.md) records
  download action success; downloaded destination/file bytes not independently
  inspected. UI tests verify Blob/filename/click/revoke. Clipboard not read back.
- A source loaded in a second tab; first tab signs A out and B in. Stale A
  Regenerate returns to Sign in ([DOM](browser-stale-account.md)); B has no source
  selection ([DOM](browser-b-empty.md)) and retains own session
  ([DOM](browser-b-session-preserved.md)). HTTP tests assert401 separately; DOM
  itself is not evidence of HTTP status. B signed out after verification.

## Failure handling

Generator label-neutrality initially compared the runtime provenance hash as if
it were executable semantics. Corrected normalization of that exact source hash
only, retaining complete-code comparison and malicious-label exclusion. Compiler
warning62 from local/global count shadowing was fixed without suppressions; the
source-bound assertion was updated for the local rename. Smoke initially retained
a Pine-specific warning-string assertion; corrected to the actual MQL research
warning/version/no-OrderSend obligation, then real restart smoke PASS. The first
failed smoke left only disposable synthetic data in the owned test DB.

Final backend attempt `tmp/pb016-backend-final.log` failed at Gradle clean because
the still-running browser-test JVM held `backend/build/libs/api-0.0.1-SNAPSHOT.jar`
open on Windows. Stopped the owned harness via its sentinel (normal tool escalation
needed for its elevated-owned directory), verified PG stopped/password removed,
then reran full clean/test/build. No test disabled, no forced file deletion.

## Security / scope / remaining work

Local API tests cover owner/BOLA/IDOR, account binding/CSRF/session/revocation,
strict body/IDs, malicious names, hash integrity, quota races/idempotency, actual DB
rollback, source deletion, rates and oversized body. Existing password/Argon2id,
brute-force, session and private workspace regression remains enabled. No URL,
upload, HTML execution, DLL, shell, broker/order or new password/token API.
CSV sandbox/path/format checks are implemented, **actual target negative tests
remain unverified**. Numerical double limitations are explicit; no live execution
or target-parity claim. Generic SSRF/new JWT/upload attacks are N/A to this API.

No unrelated/protected re-review, governance, stack, dependency, CI, applied
migration or Python engine changes. PB-015 publication checkpoint is separately
traceable with Refs #17. Exact scope/staged diff, final tests, push/GitHub SHA/CI
and Issue update remain to be recorded. Keep Issue18 OPEN until all DoD passes;
continue independent READY backlog work if actual target access remains blocked.

## Final source review checkpoint

Added NUMERIC_RANGE abort for nonfinite balance/equity/quantity/fill/fees/P&L,
without END success marker, plus rejection of Windows device filename stems.
Updated only reviewed source snapshots; exact Java emitter equality remains tested.
`tmp/pb016-backend-final4.log`:163tests,0failure/error/skip, clean/build PASS on
owned abe6tr9u, stopped/password removed. Final official compiler report was
refreshed: all eight source hashes match reviewed snapshots and compile0/0.
Frontend186/lint/build unchanged by these backend-only guards. Earlier browser
screenshots/source hashes precede the guards; UI behavior is unchanged. A final
real API/restart smoke is required below for the final generator; do not silently
replace those older evidence hashes.

Final `scripts/smoke_mql5.py` PASS against zoftr_bz, JVM27456→26396, with the final
generator. [Final restart report](restart-smoke-final.json) records exact codehash
`1d213ccea9d0c415bcb92bdd8f66515caf9ef63b7bc9eea4a4abfe959d609af2`, replay/session
and deletion after actual restart. Synthetic user signed out; harness then stopped
via its own sentinel and password removed. [Final verification](verification.json)
separates local/official compilation PASS from official runtime NOT RUN/DoDfalse.
