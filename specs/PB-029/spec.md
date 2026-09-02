# PB-029 — Phase 1 App Shell and AI Assistant

Issue: #30

## Goal

Redesign only the App Shell and persistent AI Assistant into one compact, near-black trading terminal. The workspace remains dominant and the chat becomes a simple user-facing flow.

## Acceptance criteria

1. Quant uses a neutral Q mark, near-black canvas, charcoal surfaces, off-white text, muted secondary text and subtle separators. Normal actions are neutral; green/red retain semantic meaning.
2. Desktop uses a compact rail and narrow resizable assistant beside the dominant workspace. Tablet uses an assistant overlay. Mobile has no horizontal overflow.
3. Normal chat permanently shows none of the old refresh/reload/title-form/rename/delete/provider-check/save/second-AI controls.
4. History, new chat and conversation actions use compact controls. Rename/delete are inside the conversation menu and deletion remains confirmed.
5. One Send action freezes and saves the user message, waits for authoritative confirmation, then starts AI with the confirmed conversation version and source sequence.
6. Existing request identities, idempotent retry, uncertain outcome recovery, cancellation, CSRF, authentication, ownership and expected-account binding remain intact.
7. Provider capability is checked automatically. The UI shows only a compact provider state; privacy/model details remain accessible through an information disclosure.
8. Generate from Image navigates to the existing Image Analysis workspace; no unsupported analysis is simulated.
9. Real-app chat/history/rename/delete and visual layouts at 1920×1080, ~1440, 1024 and 390 are reviewed. Frontend tests, lint and build pass.

## Out of scope

Backend/API contracts, database/Flyway, authentication semantics, Strategy DSL, Python backtest, Pine, MQL5, journal business logic and the RAG security model.

## Security requirements

- Render message/provider text inertly through React.
- Preserve the existing bounded API parsers and account-bound request helpers.
- Do not create a second AI request while a prior request is pending or uncertain.
- A failed save must never start AI. A confirmed save must use its server sequence and refreshed conversation version.
- Delete remains a separate confirmed destructive action.

## Definition of Done

Scope review and `git diff --check` pass; required tests/lint/build and real-app review pass; no Pine/MQL5 target validation is run; commits are pushed to `origin/main`; CI passes and Issue #30 is closed.
