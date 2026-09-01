# PB-015 verification record — 31/08/2026

Issue17; base main7e741be. The implementation remains an experimental research
indicator rather than native Strategy Tester. Official Pine compilation and all
eight synthetic runtime traces now PASS; publication SHA/CI remains before the
feature DoD can be marked complete. No trading-performance or independent-review
claim is made.

## Local execution

Final machine-readable counts/audits are recorded in `verification.json` after
the final commands complete. Tests retain prior business/security assertions.
Full suites run against fresh owned PostgreSQL clusters; no user database used.

Commands:

- `python scripts/test_backend.py` — Java21 Gradle Wrapper clean/test/bootJar,
  Flyway V1–V9 and actual PostgreSQL HTTP integration. New tests cover owned
  immutable artifact/read/replay, revocation/expected account/CSRF/origin, malformed
  bodies/IDs/DRAFT, data isolation, concurrent uniqueness/quota100, DB rollback,
  corrupt artifact and write-rate60. Generator tests cover validation/provenance,
  neutral/inert labels, all supported components, target caps and eight source
  snapshots matched to Python canonical hashes.
- `npm test`, `npm run lint`, `npm run build`, `npm audit --json` — React lifecycle,
  actual WebCrypto hash verification in API tests, wrong source/version/hash/body,
  bounded streaming, delayed CSRF account binding, clear error/retry, late response,
  changed account, clipboard failure and safe text download. Existing tests retained.
- `python -m unittest discover -s python/tests -v` — existing40 engine/worker tests
  plus2 reference/artifact-integrity tests. Eight pinned synthetic inputs include
  hand-checked next-open P&L200, long target cap1000, short target cap500, rule-exit
  before barriers−600, costs/both-hit/gaps, nonpositive equity, simultaneous entries
  and causal indicator/pivot/trendline/rule traces. **This executes Python only.**
- `python -m unittest discover -s scripts -p test_verification_tools.py -v`,
  `python scripts/check_dsl_fixtures.py`, `python scripts/backtest_ui_fixtures.py --check`.
- `python scripts/check_dependencies.py backend/build/reports/dependencies.txt tmp/pb015-java-audit.json` — public Maven coordinates only, no source/secrets sent.

## Actual local browser and restart

Owned API cluster `pg-test-e9ly9pae`; JVM28620→100 restart, then stopped through
its own sentinel; PostgreSQL stopped and generated password file removed. A/B
synthetic browser accounts signed out. No production service or real broker used.

- A created `PB015 synthetic research`, r1 DRAFT: Pine view rejected draft clearly
  ([DOM](browser-draft.md)). Explicit built-in synthetic DSL saved as VALIDATED r2.
- A changed only unsaved title to `PB015 unsaved title must remain`; Pine generated
  savedr2 and showed exclusion warning. Returning to editor retained the draft
  ([DOM](browser-draft-preserved.md)). No auto-save or source rewrite.
- Actual generated source and copy-success status, expanded provenance:
  [generation](browser-generated.md), [copy/provenance](browser-copy-provenance.md).
  Browser strategy3601dfbb-60da-4517-981f-84d4a07470ab, DSL hash
  `93552dae78712326cabe76cb51e828c0336984e2ba5e75bbe381331a872f84dd`, code hash
  `9bcef36eee23ea959b0f7a4200bd284a051425641210bce7d228b8d73f8993d1`.
- Visually inspected actual [desktop1600](browser-desktop.jpg),
  [tablet900](browser-tablet.jpg), [mobile390](browser-mobile.jpg). Controls/text
  fit; source scrolls horizontally within its own area. Responsive remount restores
  the persisted artifact rather than replacing it with demo source.
- `python scripts/smoke_pine.py --owned tmp/pg-test-e9ly9pae --report specs/PB-015/test-evidence/restart-smoke.json`
  exited0: actual HTTP/PG artifact byte hash, identical replay before/after observed
  down/up, persistent session, source deletion cascade and synthetic signout
  ([report](restart-smoke.json)). Browser A then reloaded same exact original hash
  ([DOM](browser-restart.md)). Smoke uses a separate synthetic strategy, so its
  code hash differs because provenance includes that strategy UUID.
- Mobile download action produced success status ([DOM](browser-download.md));
  browser download destination/file bytes were not independently inspected. Unit
  test verifies Blob text, ASCII filename, click and URL cleanup; clipboard content
  is not read back from the system clipboard.
- B signed in through the second local tab. A's stale Regenerate request returned
  the UI to Sign in ([DOM](browser-stale-account.md)); B's Pine view had no selected
  source ([DOM](browser-other-account.md)) and B remained signed in
  ([DOM](browser-b-session-preserved.md)). HTTP tests assert status401; browser DOM
  alone is not evidence of an HTTP status. B signed out afterward.

## Failures encountered and resolved / limitations retained

- First backend command `tmp/pb015-backend-tests.log` failed compile on a compound
  `var a=..., b=...` declaration in the new test. Split declarations, no production
  expected-result change. Owned `pg-test-8wsy9x48` stopped/password removed.
- Initial Pine frontend API test expected a particular header casing; actual
  `Headers` normalizes names. Changed the assertion to case-insensitive `Headers.get`
  and still asserted exact account/token values. No guard removed.
- New test-only Node crypto import lacked frontend TypeScript declarations and an
  anchor mock had implicit `this`. Use Vitest's actual typed Node crypto import and
  explicit HTMLAnchorElement annotation. Actual SHA256 assertions stay enabled.
- `tmp/pb015-backend-tests2.log` full suite passed151. While expanding fixtures4→8,
  an in-flight subsequent run failed its old compiled fixture-count assertion
  (`tmp/pb015-backend-tests3.log`,152tests/1failure). Reran after freezing the fixture
  set and test inputs; `tmp/pb015-backend-tests4.log` passed152/0/0/0. No fixture or
  business expectation weakened. That run's failure is not hidden as infrastructure.
- Source review caught missing UTC-epoch alignment in the initial emitted chart
  guard; added explicit start modulo interval/date bounds and minimum price. Source
  snapshots and assertion fixtures were regenerated before final verification.
- Official TradingView compiler/update validation passed for all eight generated
  exports and assertion fixtures. Eight complete official event/accounting traces
  contain DATASET_END and a PASS emitted after the original assertions; every
  logged value matches the pinned expected arrays/Python within the declared
  tolerance. Browser-only compaction changed only log delivery and round-tripped
  to each pinned source hash. [Target evidence](target-validation.md). No account,
  authentication, broker or chart-security workaround was used.

## Security applicability

Applicable and tested locally: owner BOLA/IDOR, missing/wrong identity, stale/revoked
session, CSRF/origin, strict fields/body/ID bounds, template/XSS injection avoidance,
private source response integrity, per-owner rate/quota, duplicate/concurrent writes,
rollback/retry and deletion isolation. Existing auth/brute-force/password/session,
dependency and resource regression suites remain enabled. SQL is parameterized;
generation never runs user code or fetches URLs. UI uses text, not HTML or execution.

No new upload, file-path input, remote URL, webhook, broker, token issuance, password
storage or privilege role is introduced: SSRF/path traversal/upload security and
new JWT/password attacks are N/A here, covered by existing applicable boundaries.
Source/credentials are not logged. Secret pattern checks are limited checks, not a
claim of exhaustive secret scanning. No dependency/lockfile/applied-migration change.

## Scope and publication

This final evidence change contains only PB-015 runtime records and current
backlog/execution documentation. Complete scope/diff verification, exact
commit/main push and actual CI must be recorded before publication is verified and
Issue17 is closed. PB-017 becomes READY only after that closure; do not redo DONE
features or call the entire backlog complete.
