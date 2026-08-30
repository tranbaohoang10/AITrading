# PB-001 — Frontend foundation and verified trading shell

Issue: https://github.com/tranbaohoang10/AITrading/issues/4 (created before source recovery).

## Mục tiêu

Reuse valid frontend work from feature/mvp-ui (0029c82) on main; produce a tested,
accessible, neutral trading UI foundation without misrepresenting demo data.
This feature implements only the shell. Real auth/chat/data/DSL/backtesting remain
separate backlog items and must not be considered complete here.

## Phạm vi

frontend/**; docs/product-backlog.md, docs/execution-state.md, docs/cnpm-index.md,
docs/revision-history/index.md, README.md and specs/PB-001/**. Do not merge old
governance or modify/import the two protected mvp-ui re-review files. Keep all old
specs on feature/mvp-ui unchanged; reference them with commit provenance.

## Use Case

UC-SHELL-01: A researcher navigates the responsive trading workspace and reviews
clearly labelled synthetic examples before connected modules are implemented.

## Use Case Description

Actor: visitor on a local prototype. Trigger: open frontend. Preconditions: local
frontend running; no credentials or private data. Main flow: open chart → choose a
workspace tab → inspect/copy text → enter a sample prompt → generate a demo →
explicitly run a separate demo backtest. Mobile navigation selects one primary
view; tablet opens a modal chat panel. Postcondition: local demo state only.
Alternatives: unimplemented module displays an honest unavailable state; blank or
oversized input is rejected; clipboard denial is a visible error; Escape closes
drawers and focus returns. Concurrent repeat clicks do not duplicate demo jobs.

## Acceptance Criteria

- AC-SHELL-01: Recover the existing frontend source/tests with provenance; preserve
  old branch/spec/review blobs; no governance rollback or duplicated new UI.
- AC-SHELL-02: npm ci, lint, type/build and all original 10 tests pass; dependency
  audit has no unresolved high/critical issue. Record actual versions/licenses.
- AC-SHELL-03: Desktop >=1200 uses sidebar/chat/workspace, tablet 768–1199 uses
  compact sidebar/workspace and modal chat, mobile <768 uses one primary view.
  Verify breakpoints 767/768/1199/1200 and browser at 390/1024/1440 pixels.
- AC-SHELL-04: Tabs, resize bounds, sidebar destinations and Escape/focus behavior
  work with keyboard. Unimplemented navigation is explicit, never a dead action.
- AC-SHELL-05: Demo generation and demo backtest remain separate; labels clearly
  disclose no real API/engine/feed; input 1–4000 trimmed characters, blank/oversized
  rejection, repeat submission suppression, safe text rendering, no network calls.
- AC-SHELL-06: Copy indicates success only after clipboard succeeds; missing/denied
  clipboard shows an error with selectable code; no unhandled rejection.
- AC-SHELL-07: Neutral dark palette, restrained squared surfaces, no purple/neon/
  sparkle/robot styling; chart/data central, readable contrast; brand from one config.

## UI Requirements

Preserve the established desktop/tablet/mobile hierarchy and six workspace tabs.
Visible focus; sufficient contrast; modal containment, Escape and restored focus.
Native SVG demo chart remains clearly synthetic. All unsupported controls are
disabled with explanation or navigate to a planned-module empty state. No upload
pretence: the attachment action is disabled until PB-018.

## Data / ERD Impact

No database or ERD change. In-memory demo state is discarded on reload. Persistent
private state is a later authenticated backend feature, not localStorage here.

## Security Requirements

Treat entered text as text; no innerHTML/eval/new Function/code execution. Bound
prompt length and duplicate jobs; no network or browser credential storage. Audit
dependencies, keep secrets out of tracked files. Auth/IDOR/SQL/CSRF/SSRF/upload and
backend races are N/A to this local unconnected shell; required in later features.

## Test Requirements

Preserve original acceptance tests; add meaningful negative/boundary/accessibility/
clipboard/duplicate tests. Run lint/build/tests/audit and actual browser interaction
at desktop/tablet/mobile with screenshots and console/network checks. Separate
test-cases.md records input/steps/expected/actual/status/evidence for every case.

## Definition of Done

- All AC-SHELL-01–07 satisfied with evidence and separate test Markdown.
- No unresolved high/critical defect, misleading AI/backtest claim or secret.
- Review git diff/staged scope; commit Vietnamese + Refs to this Issue, push main.
- Verify exact GitHub SHA and required CI if configured; update/close completed.

## Dependencies

None. Source: feature/mvp-ui 0029c82; original implementation 9511cce. Follow-up:
PB-002 backend foundation and PB-003 authentication, then connected modules.
