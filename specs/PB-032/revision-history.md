# PB-032 — Revision history

All timestamps use Asia/Ho_Chi_Minh.

## 04/09/2026

- Created Issue #33 and scoped the work to the React chat composer and global typography only.
- Directly inspected the logged-in LuxAlgo Quant composer: the live page uses an 85.6px two-tier card, a 14px/20px message input, and `Aeonik` supplied by LuxAlgo. Quant deliberately uses its existing Inter/system fallback stack rather than copying or bundling LuxAlgo's proprietary font asset.
- Implemented a two-tier private-chat composer: message input above, then context/provider controls and voice/send actions below. The same compact structure is used for the unauthenticated demo composer without changing its disabled or demo-only semantics.
- Centralized the UI type family and base scale in `styles.css`: 14px body/input, 12px labels, 11px metadata and 16px headings. Explicit code/chart monospace styles remain unchanged.
- Verified 04/09/2026: targeted accessibility/shell/workspace/chat tests (41 passed), full frontend Vitest suite (31 files, 228 tests), ESLint, TypeScript and Vite production build. Browser QA confirmed no document-level horizontal overflow at a 1536px viewport.
