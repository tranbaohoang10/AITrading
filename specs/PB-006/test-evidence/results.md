# PB-006 verification — Issue #9

31/08/2026, Asia/Ho_Chi_Minh. Codex executed these checks on synthetic local data.
This is implementation evidence, not independent approval or financial advice.

## Executed checks

- `python scripts/test_backend.py` with Java21 and owned PostgreSQL17.11:
  clean/test/bootJar/dependencyInventory exit0;73 tests passed before adding the
  final concurrent read/duplicate-delete test. Final74-test run is pending below.
  Earlier73-test cluster pg-test-u5ovvqu5 stopped and password file removed.
- Frontend `npm run lint`, `npm run build`, `npm test`, `npm audit --audit-level=high`:
  exit0 each;71 tests across9 files; TypeScript/Vite build PASS;0 vulnerabilities.
  Last verified code includes final mobile/keyboard and empty-state wording fixes.
- `python -m unittest discover -s scripts -p test_verification_tools.py -v`:
  exit0,6 fail-closed audit/cleanup tests.
- `python scripts/check_dsl_fixtures.py`: exit0,6 independent Decimal/UTF-8 goldens.
- `python scripts/check_dependencies.py backend/build/reports/dependencies.txt
  tmp/pb006-dependency-audit.json`: exit0,118 Java coordinates,0 OSV findings.
  No dependency/lockfile/license change. Audits are point-in-time checks only.

## AC/test mapping

| Test case | Actual execution and result |
| --- | --- |
| DATA-01 | MarketCsvParserTests: equivalent quoted/BOM/CRLF CSV yields same canonical/different raw hash; immutable exact BigDecimal. Independent Python-derived hardcoded hashes checked in Java. PASS |
| DATA-02 | Parser attack tables plus actual HTTP invalidCsvMetadataAndUnknownFieldsCannotPartiallyPersistOrExecute: reject format/formula/control/URL/path fields, inert HTML/SQL-looking metadata, fixed diagnostics and zero partial rows. PASS |
| DATA-03 | Parser0/1/5000/5001 rows, exact1MiB/oversize/multibyte, numeric precision/range/OHLC; HTTP persists5000 rows and returns last500 correctly. PASS |
| DATA-04 | Invalid calendar/leap/24h/leapsecond/timezone/alignment/order/duplicate/open/future variants; exact candle-close boundary accepted, gaps counted. PASS |
| DATA-05 | HTTP owned import/list/candle paging and stable keyset ties while inserting; browser reload/API restart retains hashes, exact OHLC and datasets. PASS |
| DATA-06 | HTTP ownerPredicatesRejectAllForeignReadsPagesAndDeletesWithNoLeaks, current credential revocation, invalid IDs/owner injection; browser B empty after A imports. PASS |
| DATA-07 | Concurrent identical requests create one dataset; different intent409; quota49 concurrent outcomes200/409, replay works at50; separate users independent. PASS |
| DATA-08 | Real DB trigger failure at second candle rolls back parent and inserted row, no SQL leak; hash mismatch409, delete cascade only own; browser cancel/focus restore and confirmed deletion verified. Additional simultaneous read/double-delete run pending. |
| DATA-09 | Actual CSRF/wrongOrigin/anonymous/2MiB exact chunked vs +1/old endpoint bounds; import race200/429; independent read/delete quotas and window recovery. PASS |
| DATA-10 |14 frontend market tests: API contract guards, file extension/size/read, no autosave, loading/empty/error, same-key uncertain retry, definite rejection retains editable CSV, async user/selection isolation and delete failure/retry. PASS |
| DATA-11 | Actual browser1280x800,900x900,390x844: import/paging/window/keyboard/restart/provenance/delete/two-user isolation. Screenshots below. PASS after fixes |
| DATA-12 |71 frontend,73 backend before final race addition,6 verifier,6 canonical; lint/build/audits PASS. Final74 backend, staged scope, GitHub delivery and actual CI pending. |

## Real browser evidence

Actual local React/Vite → Spring Boot → owned PostgreSQL, no mocked network.
A imported3 synthetic TEST_USD hourly candles with a missing interval. First open
was exactly100.12345678, volume200, Jan1 2024 UTC. Canonical fingerprint remained
d518584c2e2aab613be1b9d2b48d32c557763bbd8d3d77f297d9f0e27c50ed96 and raw fingerprint
104055334f404db4bdf27383c96253f1b8c8eb263f7ab54a660bf3661b3719c8 after API restart.
Source clearly SYNTHETIC and gap count1, no invented indicators/trade markers.

Second explicit sample import created360 DEMO_USD candles. Changed100→50bar window
to311–360, Older moved261–310. Last inspected candle Jan13 21:00UTC had
open111.67/high112.57/low111.17/close112.07/volume133, matching persisted source.
Viewport resize retained selection/window. Home selected index0, exact first OHLC.
Delete cancellation returned focus and kept dataset; confirmation removed only
the3-candle dataset, preserving the360-candle dataset. Newly registered B showed
an empty dataset selector and no A data. B identity confirmed through Account UI.
Both sessions signed out; viewport reset; owned harness40784 stopped with exit0,
PostgreSQL pg-test-h_lcd63w stopped and generated password file removed.

- [Desktop](market-desktop.png): actual data/chart/provenance, fixed vertical spacing.
- [Mobile](market-mobile.png): full dataset selector and readable chart at390px.
- [Mobile import](market-import-mobile.png): scrollable form within viewport.
- [Tablet after API restart](market-tablet-after-restart.png): persisted exact values/hashes.
- [User B empty](market-user-b-empty.png): no inherited datasets.

DOM geometry checked scrollWidth equal viewport width1280/900/390; candle values
and provenance had12px separation after fix. Mobile selector width301.475px.
Screenshots record visible states; unit tests separately cover async failures.

## Failures retained and corrected

1. Initial full backend72 tests had9 market API failures503: new rate-key purpose
   plus colon/SHA256 exceeded existing VARCHAR80. Shortened only new purpose names
   to data-import/data-delete/data-read. Limits unchanged, V2 not edited. Then72
   passed; subsequent73 passed after maximum5000 test and golden assertions.
2. Initial frontend assertion used unsupported asymmetric matcher with toHaveValue.
   Corrected to exact original CSV equality before/after rejection, preserving
   expected behavior;71 tests now pass, old tests retained.
3. Actual browser revealed flex shrink overlapping values/provenance and tiny SVG
   axes. Fixed non-shrinking chart and ResizeObserver pixel-width viewBox/axis text.
   [Initial desktop](market-desktop-initial-layout.png) retained, not called PASS.
4. Mobile selector initially collapsed to arrow; gave label full row on small
   screens. [Initial mobile](market-mobile-initial-selector.png) retained.
5. Native Home key did not move inspection slider in actual browser; explicit
   clamped Home/End/arrow handling fixed it, tested in UI automation and browser.

## Security, scope and limitations

CSRF/auth/session, BOLA, mass assignment, injection/XSS/path/URL/formula, replay,
body/row/numeric/time limits, quota/rate races and transaction failures tested.
No file-path storage, arbitrary fetch/eval/script/SQL interpolation, external feed,
AI provider, broker, real-money order or payment implementation. Shared auth tests
retain password/hash/session/revocation/DB-outage checks. UI passes file contents,
never a server-side file path. Raw/canonical hashes are not trust signatures.

Applied V1–V3, dependency locks, workflow/security settings and protected mvp-ui
reviews remain unchanged. Old review blobs on feature/mvp-ui remain
e03fe3d3fcdc7eef83d83f819ca848c6b8e49b39 and
5fb05f3f5d82640776c77283bacb8e529344c067. They are not present as modified files
on current main and are not part of this feature. No stash/reset/branch merge.

Idempotent import replay applies while its dataset exists. Deleted datasets have
no retained tombstone; another session deleting before a retry can permit recreation.
An uncertain deletion may return404 on retry; UI must refresh, not claim data is
still present. No background retry, general CSV dialect, realtime feed, candle
editing, backtest runtime or source-authenticity certification is claimed.

Commit/push exactSHA and actual CI remain required before Issue completion.

## Final local verification

Final full harness exit0:74 tests,0 failures,0 errors,0 skipped, clean build and
dependency inventory PASS. Includes three concurrent read/double-delete races: a
read sees either a complete25-candle snapshot or404, deletes return204/404, other
user dataset survives. DATA-08 now PASS. Exact JUnit names in backend-tests.json.
Owned pg-test-f2dbltft stopped and generated credential file removed. DATA-01–11
PASS; DATA-12 local checks PASS, publication/CI still pending.

## Delivery verified — 31/08/2026

Commit7c7c1983e0d783278fa9dc338a606bc61ec46167 normally pushed to main; GitHub API
and ls-remote exactSHA confirmed. Actual CI33355769629 success, both jobs PASS;
downloaded artifact JUnit74/0/0/0, OSV118passed. Issue9 CLOSED/completed, comment
https://github.com/tranbaohoang10/AITrading/issues/9#issuecomment-5473556927 .
DATA-12 and T07 now PASS, all DoD met. Scoped44file review and limited signature
scan0, git diff --check PASS; status clean after push. Next PB-007 Issue10 created.
