# PB-001 local verification — 30/08/2026

Issue #4. Local checks below precede publication; exact remote SHA/closure evidence
will be posted to the Issue after push. No independent-review claim is made.

| Check | Actual result |
| --- | --- |
| Baseline npm ci --ignore-scripts | Exit 0, recovered original lockfile; 343 packages |
| Original lint/build/tests before edits | Exit 0; original 10 tests passed |
| Initial npm audit | FAIL: one high nanoid <3.3.18, GHSA-2v37-7h3g-55p8 |
| Remediation | npm update nanoid --ignore-scripts; 3.3.17 → 3.3.18 compatible transitive patch; no new direct dependency |
| npm audit final | Exit 0; 0 vulnerabilities at all severities |
| Patched-lock fresh install | Initial retry hit Windows EPERM on native lightningcss loaded by our Vite server; stopped owned session 89309, reran npm ci --ignore-scripts successfully (343 packages, zero vulnerabilities) |
| npm run lint final | Exit 0 |
| npm run build final | Exit 0, tsc + Vite 7.3.6, 45 modules |
| npm test JSON report | Exit 0; 27 passed, 0 failed/skipped/pending; original 10 preserved |
| Source dangerous-sink/network/storage search | No production source matches; rg exit 1 means no match, not execution failure |
| Test skip/only/todo search | No matches |
| Browser | In-app Chromium, actual local Vite at 127.0.0.1:5173; no console warn/error captured |
| Responsive | Actual desktop 1440×800, tablet 1024×768, mobile 390×780; no document overflow observed; exact breakpoint unit tests 767/768/1199/1200 |
| Clipboard | Browser Copy showed Copied after write; unit tests independently reject missing/denied clipboard |
| Action separation | Browser generation completed with Backtest still waiting and zero trades; unit test verifies later explicit backtest |
| Modal | Native :modal true, focus stays inside during keyboard traversal; explicit Escape closes tablet/mobile and restores open trigger |
| Mobile | Selecting AI Chat closes drawer and removes Chart; one main view, no horizontal page overflow |
| Visual | Neutral chart-centered layout, no purple/sparkle/glow; screenshots desktop/tablet/mobile/mobile-chart |

Failures found and repaired (not concealed): TypeScript rejected Playwright's
`exact` option in Testing Library tests; removed invalid option (Testing Library
matches strings exactly by default). Browser's simulated Escape did not emit native
cancel; added explicit Escape handling and regression test. Reran build/tests.

Dependency justification: reuse existing React, Tailwind and Vite/TypeScript build
plus Vitest/Testing Library/jsdom/ESLint. Their installed versions/licenses/engines
are in dependencies.json; all direct licenses MIT except TypeScript Apache-2.0.
Registry npm metadata confirms nanoid 3.3.18 MIT and compatible Node engine.
Advisory: https://github.com/advisories/GHSA-2v37-7h3g-55p8.
No package was added solely for visual styling or state management.

Scope: no backend/auth/private data; SVG prices/results and script strings remain
synthetic examples. Tests do not certify real broker/AI/DSL/Pine/MQL5 behavior.
Full product security, real engine and provider checks remain required backlog work.

Pre-publication preservation: feature/mvp-ui still 0029c82; protected re-review
blobs remain e03fe3d3fcdc7eef83d83f819ca848c6b8e49b39 and
5fb05f3f5d82640776c77283bacb8e529344c067. Original test blobs are unchanged:
b49f9b55e0a6922fa7722e24f0fd9037f13d910f, 4cdba4bacf2971351da8d6210cf45449846e9354,
01172dcd3a972ebfe311a894d18fcd235282e477. Staged scope: 49 files; diff --check and
cached diff --check exit 0. Limited credential-content pattern scan: no matches
in 45 text files; four images contain only the local synthetic UI.
