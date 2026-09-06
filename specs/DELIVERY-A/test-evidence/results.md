# Library verification — Refs #42

06/09/2026, Asia/Ho_Chi_Minh. Start SHA: 32e795682ef8b69dad587b0b1c993197648b9a42.

## Executed checks

| Command / check | Result |
| --- | --- |
| `npm test -- --maxWorkers=2` | PASS, 274 tests / 40 files; 67.59 s, exit 0 after Journal, timezone and Market Intelligence additions |
| `npm test -- src/document src/AppShell.test.tsx src/ShellSafety.test.tsx --maxWorkers=2` | PASS, 37 tests / 5 files after Modal focus fix |
| `npm run lint` | PASS, exit 0 |
| `npm run build` | PASS, exit 0; existing bundle-size advisory remains, no error |
| `npm audit --audit-level=high` | PASS, zero vulnerabilities, exit 0 |
| `scripts/test_backend.py --tests '*DocumentApiTests'` via bundled Python and Java 21 | PASS after existing AI hash repair, 18 tests including inherited AI contract tests, exit 0 |
| `scripts/test_backend.py --tests 'com.aitrading.*'` | PASS, 303 tests / 36 XML suites, 0 failures and 0 errors after the PostgreSQL admission-clock repair and Market Intelligence boundary tests |
| Gradle Wrapper `assemble dependencyInventory --no-daemon --console=plain` | PASS on Tomcat 11.0.25, exit 0 |
| `scripts/check_dependencies.py backend/build/reports/dependencies.txt specs/DELIVERY-A/test-evidence/dependency-audit.json` | PASS, all 121 resolved Java coordinates, zero findings, exit 0 |
| `scripts/verify_readiness.py` | PASS, exit 0; existing tracked repository offline readiness/secret checks |
| `git diff --check` | PASS, exit 0 |
| `git status --short` / scope review | PASS — unrelated pre-existing untracked files remain unstaged and are listed in the delivery note |

## Real browser

`node specs/DELIVERY-A/browser-qa.mjs`: real installed Chrome headless, live Vite 5173 + Spring Boot 8080 + repository-owned disposable PostgreSQL; only newly generated synthetic accounts/files. No route mocking, no private production data, no fake production answers. Script exit 0. See [browser-results.json](browser-results.json).

PASS: actual TXT upload/preview as inert text, new immutable v2, historical v1 preview, PDF parsing/page preview, title/filename search, no-match state, exact-source RAG request with truthful provider failure, global no-match insufficient, delete cancel/confirm, reload, Images honest empty state, foreign owner empty catalog and 404 preview. At 1440 three panes; at 1024/390 modal detail/upload and zero page horizontal overflow. Escape restores the trigger; repeated Tab stays inside upload dialog. Zero browser page errors.

Screenshots: empty-1440.png, library-1440.png, versions-1440.png, selected-rag-1440.png, detail-1024.png, upload-1024.png, library-1024.png, detail-390.png, upload-390.png, library-390.png, images-empty-1440.png.

## Honest limitation

Current browser-test AI capability is Offline/unconfigured. A successful live-provider RAG answer/citation UI and populated live image-analysis history cannot be certified from this run. Exact citation success/provider failure/current-source selection are covered by real PostgreSQL + local HTTP provider integration tests and frontend contract tests; these are not live-provider browser evidence. Issue stays OPEN until remaining required evidence is resolved. No credentials are requested in chat or persisted in this evidence.

## Repairs and applicability

Initial frontend full run overloaded local workers during concurrent Gradle work; chart tests timed out. Two heading assertions expected the old Documents heading and were updated to the explicitly requested Library heading. No behavioral test weakened. Real browser exposed native Tab moving focus outside the document, corrected by explicit first/last control wrap.

Existing AI Chat null attachment hash crashed before provider work; repair retains the established text-only hash. Existing backtest admission mixed PostgreSQL and JVM clocks; repair uses one database clock, rejects future metadata/candles without tolerance, and does not change calculations. Tomcat patch removes newly reported dependency vulnerabilities; old failing audit retained separately.

Auth/expected-account/CSRF, BOLA, replay/expectedVersion, parser bounds and current-version provenance remain server-side. No new migrations, permissions, live trading or dependencies. No HTML/URL execution. Historical citation snapshots intentionally survive source deletion.
