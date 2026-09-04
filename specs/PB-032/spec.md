# PB-032 — LuxAlgo-inspired chat composer and typography density

Issue: #33

## Scope

Refine the React frontend only. Quant retains its own visual identity while using the currently inspected LuxAlgo Quant composer and type density as a usability reference. No LuxAlgo branding, assets, stylesheet, proprietary font files, API contracts, authentication, conversation ownership, provider behavior, or persistence semantics are copied or changed.

## Acceptance criteria

- **AC-01 — Two-tier composer:** both private and demo chat composer variants separate the message input from the model/action row, remain keyboard accessible, and retain auto-grow, Enter-to-send, disabled, provider disclosure, voice-placeholder, and send behavior.
- **AC-02 — Type system:** an application-wide sans-serif type stack and compact baseline are centralized. Body content is 14px; labels 12px; metadata 11px; headings 14–16px. Purposeful monospace code/chart data remains exempt.
- **AC-03 — Responsive Quant UI:** the composer remains usable at desktop, tablet, and mobile widths without horizontal overflow or clipped controls.
- **AC-04 — Safety:** no backend, AI-provider, authorization, message persistence, request identity, or live-trading behavior changes.

## Data and security impact

N/A. This feature changes only local presentation. Existing text input validation, ownership, request IDs, retries, uncertainty handling, and cancellation flows remain unchanged.

## Definition of done

Component regression tests, full frontend suite, lint, production build, diff check, direct LuxAlgo comparison, and local browser QA pass. Evidence is appended before a normal `main` push.
