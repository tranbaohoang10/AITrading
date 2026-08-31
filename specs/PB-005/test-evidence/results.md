# PB-005 verification log — 31/08/2026

Issue #8. Local Windows / Java21 / PostgreSQL17 / Node24 / Python3.12.
No new runtime/test dependency, Flyway migration or UI change. Runtime/target
execution remains unimplemented; validation PASS is not a trading certification.

## Failures and corrections retained

1. Initial compileJava exit0. First DSL unit run14 tests had1failure: empty input
   returned Jackson MissingNode and became structural422 rather than malformed400.
   Added explicit MissingNode rejection in production; unchanged rejection assertion
   then passed in full real-DB run52tests, exit0, cluster pg-test-es57v_qw stopped.
2. Added exact128/129 condition and10000/10001 warm-up boundary tests, schema
   fingerprint freeze and fail-closed trusted-schema tests. Full run55tests passed,
   exit0, owned pg-test-tqrartby stopped and generated credential file removed.
3. Review improved tagged-union diagnostics: a negative lag or excessive period
   now reports NUMBER_RANGE at its exact trusted field path, instead of the generic
   UNSUPPORTED_SHAPE. Assertions deliberately strengthened for precision (not a
   relaxation of validation). Added exact20 diagnostic-cap/no-ID-leak case. Final
   full rerun is required for this last revision; results appended below.

## Independent checks already executed

- `python scripts/check_dsl_fixtures.py`: exit0, six Python Decimal/UTF-8 canonical
  fixtures match committed bytes/SHA256. Java separately checks same goldens and
  minimumBars. This is a project contract, not claimed RFC8785 compliance.
- `python -m unittest discover -s scripts -p test_verification_tools.py -v`: exit0,
  six tests; audit/cluster cleanup failure paths still fail closed.
- frontend `npm run lint`, `npm run build`, `npm test`, `npm audit --audit-level=high`:
  all exit0; TypeScript/Vite build,57 tests,0 audit findings. No frontend source changed.
- `python scripts/check_dependencies.py backend/build/reports/dependencies.txt
  tmp/pb005-dependency-audit.json`: exit0;118 locked Java packages, no OSV findings.
  No new package/license/lockfile. Audit is a point-in-time check, not a guarantee.
- Protected old mvp-ui review blobs remain e03fe3d3fcdc7eef83d83f819ca848c6b8e49b39
  and5fb05f3f5d82640776c77283bacb8e529344c067 on feature/mvp-ui. No edits/stash/revert.
  No diff in frontend, applied V1–V3 migrations, .agents, Constitution or AGENTS.

## Applicability and remaining delivery

No browser screenshot required: API/schema-only feature, existing UI unchanged.
Actual HTTP tests use separate authenticated sessions and real disposable PG; unit
fixtures are synthetic. DB outage/recovery and password/session attacks remain in
the existing full auth/chat integration suites, not replaced by mocks.
No file upload, provider, remote schema fetch, shell/eval, SQL construction or target
execution sink added. Injection/SSRF/traversal/type payload rejection is tested.
Metadata may contain inert HTML/SQL-looking text; future consumers must render text
and revalidate, never execute. Missing future runtimes are explicitly reported.
Commit/push, exact GitHub SHA, actual required CI and Issue closure still pending.

## Final local revision verified

`python scripts/test_backend.py` exit0: clean compile/test/bootJar/dependencyInventory,
56tests,0failures,0errors,0skipped (16validator +2schema +5HTTP DSL +33prior).
Actual JUnit names/counts in backend-tests.json; owned pg-test-i__9peiw stopped,
pg_ctl reports no server running and generated credential file no longer exists.
Frontend57, verifier6 and independent canonical6 checks also pass as recorded above.
Final scope check covers34files (including this feature evidence and PB-004 delivery
checkpoint); Markdown links/fences pass, git diff --check passes; limited GitHub/AWS/
private-key signature scan finds0. This is not a comprehensive secret scanner.
No changes to existing product tests, frontend source, lockfiles or migrations.
No known unresolved defect in this scope; GitHub delivery remains required.

## Delivery verified — 31/08/2026

Commit28a68e02b6a74c883f3dd31b87951cceaea5be07, normal fast-forward push verified
by ls-remote and GitHub API. Actions33352803357 completed/success on exact SHA,
both jobs PASS. Downloaded JUnit56/0/0/0 and OSV118passed. Issue8 CLOSED/completed:
https://github.com/tranbaohoang10/AITrading/issues/8#issuecomment-5473210114 .
DSL-12 and T07 delivery now PASS/complete; prior pending statements are historical.
