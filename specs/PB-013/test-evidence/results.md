# PB-013 execution evidence — Refs #15

31/08/2026 Asia/Ho_Chi_Minh. Codex executed these checks on actual main worktree;
not independent or Product Owner approval. Only synthetic local accounts/data.
No secrets, cookies, CSRF values or database credentials retained in this evidence.

## Commands and results so far

- Java21 Gradle Wrapper compileJava: exit0.
- `python scripts/test_backend.py`: initial136tests/0failures/errors/skips, exit0;
  13new actual HTTP/PostgreSQL journal tests. Cluster pg-test-yvwfpmn5 stopped;
  generated credential file removed. A final run with the new account-write guard
  adds one security test and is still being verified; no final PASS claimed yet.
- `npm test`, `npm run lint`, `npm run build`: final account-header source,
  session24116,146tests/17files PASS, lint/type/Vite build exit0. 15new journal
  tests (11component,4API), original131 preserved. No skipped test or new package.
- Python `unittest discover -s python/tests -v`:40PASS exit0, including actual
  supervised OS memory/CPU child tests. Verifier suite6PASS, independent canonical
  fixtures6PASS and engine/UI fixture check6PASS; each exit0.
- Java OSV audit:118resolved packages,0findings,passedtrue exit0;
  report tmp/pb013-dependency-audit.json. Frontend npm audit0vulnerabilities exit0.
- `git diff --check`: exit0 during local review. Exact final staging/publication
  checks still required; no push/CI completion claimed yet.

## Real browser/storage sequence

Browser API harness pg-test-7rdf7m4d; JVM17504→2784 using only its restart-api
sentinel. Browser account pb013-browser@example.test. Input dataset explicitly
SYNTHETIC, TEST_USD/1h,3candles at00:00/01:00/03:00UTC on01/01/2024 with1gap.
Imported through actual application UI, not intercepted browser network or mock.

Created journal **5cce86a1-6e55-4ae5-bdeb-35f13f0886f2**:
LONG quantity2, entry100 at01:00Z, exit110 at03:00Z, fees1+2USD.
Expected/manual gross20 and net17. Actual saved detail, daily01/01report and
range01–03/01all show gross20/net17/fees3/closed1/open0. Script-like entry reason
is displayed as inert text. Explicit update savedv2; dirty New entry showed
discard dialog, Keep retained draft, then explicit Save persisted new note.

Reload after JVM restart retained session and same ID/v2/note/net17/chart. Actual
dataset deletion through its confirmation dialog preserved journal values and
showed unavailable chart on refresh. No unrelated current-market chart substituted.
This sequence used the V8 service before the final AuthGuard header addition;
the final header boundary has separate HTTP and browser verification below.

Screenshots visually inspected at widths1600/900/390 (actual viewport captures;
do not assume configured browser height equals capture height). Desktop chart
beside form, tablet/mobile stacked layout, scrollable form/report and usable
keyboard candles. Home selected00:00Z; mobile Previous selected01:00Z. Provider
retained selectedv2 across tablet→mobile navigation. ISO UTC text fields preserve
partial input and avoid implicit local-time conversion; range uses YYYY-MM-DD.

- desktop-journal.jpg / desktop-chart.jpg: report17USD and actual source chart.
- tablet-report.jpg: persistedv2 and exact range totals after browser reload.
- mobile-report.jpg / mobile-chart.jpg: narrow report and real gapped candles.
- desktop-journal.txt, saved-v2.txt, restarted.txt, source-deleted.txt: sanitized
  visible DOM state only; synthetic notes retained as verification input.

Initial native date/datetime-local fill did not propagate to controlled state in
the browser test; explicit ISO inputs fixed actual create/range behavior and have
a partial/millisecond/new-entry regression. Initial component act warnings fixed
by awaiting remount. Delete-conflict message now survives the report refresh.
No expected financial/security result was weakened to obtain PASS.

The initial API/PG harness was stopped after verification; credentials removed.
Final cross-account header browser flow and final backend count remain pending.

## Security applicability and limitations

Real tests cover owner list/get/write/delete/report, foreign/missing datasets,
CSRF/Origin, current credential revocation, strict DTOs, duplicate keys, chunked
16KiB body bound, Unicode/control/decimal/time constraints, exact money,
idempotency/version/read-write-delete races,500entry/100write quotas, atomic
rollback via failing ledger trigger and per-user300read/60write rate limits.
New X-Workspace-User check prevents stale-tab writes into a different session user;
header is a precondition, never authorization to select another owner.

No new external URL fetch/upload/shell/template execution, password hashing/token
issuance, provider call, credit/payment or broker order. Existing regression and
dependency checks cover reused boundaries. No financial/AI reason-quality claim.
List and summary are independent fresh reads, not a cross-request DB snapshot;
refresh after concurrent edits. Browser draft/request identities are memory-only;
on reload inspect saved records before new intent. Deleting an entry intentionally
cascades request metadata; replay guarantee applies only while the entry exists.

PB-008 remains blocked on the project server AI key and actual provider smoke.
PB-013 does not certify that dependency or cross-target external runtimes.

## Final local verification

Final backend session51348: **137tests,0failures/errors/skips**,14journal tests;
exit0. pg-test-jp_si9yd stopped, credential file removed. Extracted suite/case
inventory: backend-summary.json. Final frontend session7373: **149tests/17files**
PASS,18journal tests (14component+4API), lint and type/Vite build exit0. Three final
cases cover an acknowledged save followed by identity429 (same UUID retained),
another account's404 after uncertain delete (never false proof of deletion), and
an out-of-range linked candle timestamp (warning without changing monetary input).

Final API harness pg-test-v3esd0q7/JVM24700 used the final account header guard.
Browser A=pb013-final-a@example.test successfully created its own OPEN journalv1
with correct expected-account header (final-api-save.txt). A then entered a new
PRIVATE_A draft but did not save. Tab2 signed out A, created/signed in B at
pb013-final-b@example.test. B journal was empty. Saving old A draft in tab1 was
rejected and returned it to Sign in; B Refresh still showed0closed/0open and no
record/reason from A. Visible DOM: cross-account-write-blocked.txt and
other-user-empty.txt; screenshot other-user-empty.jpg visually inspected.

Both sessions ended; final API/PG stopped exit0 and generated credential file
removed. Only the local Vite development server may remain. No production service,
external account or live-money trading touched. All screenshot captures inspected.
JRN-T01–08 local requirements PASS. JRN-T09 publication still pending until exact
main SHA and actual required CI are verified and Issue15 is completed.

Final local scope check:45files,3382insertions/8deletions before this evidence
append. Entire new/integration diff reviewed; cached diff --check exit0;
tmp/pb013-scope-check.py confirms allowed paths, protected mvp-ui blobs unchanged,
V1–V7/Python/dependencies/governance/CI/scripts unchanged, valid Markdown links/
fences/JSON/JPEG and limited secret-pattern checks. The latter is not a comprehensive
secret scanner. No unrelated pre-existing change included. Refs14 is included
only for the already-delivered PB-012 completion checkpoint.
