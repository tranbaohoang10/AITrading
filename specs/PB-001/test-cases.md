# PB-001 Test Cases — Refs #4

All cases use local synthetic demo data and current frontend. No real accounts,
third-party attack targets or financial data. Cases designed before implementation; actual
execution evidence after implementation. Commands run from frontend unless stated.

| Test Case ID | Requirement / AC | Objective | Preconditions | Test Data / Input | Steps | Expected Result | Actual Result | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SHELL-T01 | 01 | Preserve source provenance/history | main baseline, old branch exists | 0029c82 and protected blob IDs | Compare old ref/blobs and task diff | Old ref/blobs unchanged; no protected records staged | Verified; see test-evidence/results.md and vitest.json | PASS | Git |
| SHELL-T02 | 02 | Reproducible regression | Restored manifest/lock | Original 10 tests | npm ci; lint; build; test | Install succeeds, unchanged regressions pass | Verified; see test-evidence/results.md and vitest.json | PASS | Commands |
| SHELL-T03 | 03 | Responsive exact boundaries | Render App | 767,768,1199,1200 | Resize and inspect active regions | Correct mobile/tablet/desktop at each bound | Verified; see test-evidence/results.md and vitest.json | PASS | Unit + browser |
| SHELL-T04 | 04 | No dead sidebar destinations | Desktop App | Journal/Settings/Workspace | Click each destination then return | Explicit planned module or actual view; chart restores | Verified; see test-evidence/results.md and vitest.json | PASS | Unit/browser |
| SHELL-T05 | 04 | Modal accessibility | Tablet/mobile | Tab, Shift+Tab, Escape | Open drawer; traverse; Escape | Contained focus, inert background, close+trigger focus | Verified; see test-evidence/results.md and vitest.json | PASS | Browser |
| SHELL-T06 | 04 | Keyboard tab selection/resize bounds | Desktop | Arrows/Home/End; 100 resize presses | Select tabs and resize beyond limits | Correct active panel; width stays 320–400 | Verified; see test-evidence/results.md and vitest.json | PASS | Unit/browser |
| SHELL-T07 | 05 | Empty/bounds rejection | Chat demo | whitespace; 4000; 4001 chars | Set prompt and generate | Empty/oversized rejected; 4000 accepted | Verified; see test-evidence/results.md and vitest.json | PASS | Unit |
| SHELL-T08 | 05 | Duplicate/in-flight safeguards | Demo provider | repeated generate/backtest | Invoke twice within same event batch | One job/message pair; no premature backtest | Verified; see test-evidence/results.md and vitest.json | PASS | Unit |
| SHELL-T09 | 05 | Input safely displayed | Chat/code | HTML-like script/img text | Generate and inspect DOM | Text only, no injected element/script | Verified; see test-evidence/results.md and vitest.json | PASS | Unit/browser |
| SHELL-T10 | 05 | Lifetime and action separation | Fake clock | pending timer then unmount | Start demo; unmount; advance; generate separately | Timers cleared; no backtest from generate | Verified; see test-evidence/results.md and vitest.json | PASS | Unit |
| SHELL-T11 | 06 | Honest clipboard result | Code view | successful/rejected/missing clipboard | Click Copy for each outcome | Success only on resolution; visible error otherwise | Verified; see test-evidence/results.md and vitest.json | PASS | Unit/browser |
| SHELL-T12 | 07 | Professional responsive visual state | Dev server/browser | 390/1024/1440 | Inspect chart/chat/results/modal | Neutral/no spark/neon; visible labels/controls; no page overflow | Verified; see test-evidence/results.md and vitest.json | PASS | Screenshots |
| SHELL-T13 | 02,05 | Supply-chain and isolation | Installed lock | npm audit + source scan | Audit deps; inspect network/storage/HTML sinks | No unresolved high/critical; no runtime API/storage/eval | Verified; see test-evidence/results.md and vitest.json | PASS | Audit/source/browser |

Auth/IDOR/BOLA, CSRF, SQL, SSRF and actual upload/provider/DB failure tests are N/A
here because no backend, identity, network client or upload exists. This is not a
waiver for later features. The attachment/data configuration controls must clearly
show not connected rather than imply these protections have been implemented.
