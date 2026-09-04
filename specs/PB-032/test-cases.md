# PB-032 — Test cases

Issue: #33

| ID | Acceptance criterion | Scenario | Expected result | Evidence |
| --- | --- | --- | --- | --- |
| TC-01 | AC-01 | Render private chat | Message input is in the composer; provider, voice, and send controls are in a distinct action row. | `AiChat.test.tsx` |
| TC-02 | AC-01 | Enter a message and send | Existing draft, Enter-to-send, disabled, provider, request, and reply flows remain unchanged. | Existing chat regression suite |
| TC-03 | AC-02 | Inspect global CSS and rendered controls | UI uses the central Inter/system sans stack with compact 14/12/11/16px scale; code/chart monospace remains intentional. | CSS review and browser QA |
| TC-04 | AC-03 | Inspect desktop and mobile layouts | Composer has no clipped controls or document-level horizontal overflow. | Browser QA |
| TC-05 | AC-04 | Run frontend regressions | No API/provider/auth/ownership behavior changes. | Full frontend suite |

## Execution result — 04/09/2026

| Test | Result | Evidence |
| --- | --- | --- |
| TC-01, TC-02 | PASS | `npm test -- --run src/Accessibility.test.tsx src/ShellSafety.test.tsx src/Workspace.test.tsx src/chat/AiChat.test.tsx --reporter=dot --no-file-parallelism` — 4 files, 41 tests passed. |
| TC-03 | PASS | Read-only LuxAlgo inspection found its `Aeonik` 14px/20px composer input. Quant renders the intentionally licensed-safe Inter/system stack at 14px/20px for body/input, with 12px labels, 11px metadata and 16px headings. |
| TC-04 | PASS | Browser QA at a 1536px viewport: two-tier Quant composer rendered at approximately 284px × 95px; the action row was approximately 38px high and `scrollWidth === clientWidth === 1536`. |
| TC-05 | PASS | `npm test -- --run --reporter=dot --no-file-parallelism` — 31 files, 228 tests passed; `npm run lint` and `npm run build` passed. |

Security applicability: this change introduces no network call, executable content path, dependency, authentication, authorization, provider configuration or saved-chat ownership change. Existing safety regressions remain covered by the passing suite.
