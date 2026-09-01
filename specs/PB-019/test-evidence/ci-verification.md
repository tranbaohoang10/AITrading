# PB-019 CI verification — 01/09/2026

- Feature commit: `43d0e21dd8069c7e567c63dcb154430ddc1da533`.
- Exact GitHub `main` SHA matched the local commit before CI verification.
- GitHub Actions run: `33474327220`, workflow `Prototype verification`, SUCCESS.
- Frontend job: SUCCESS (locked install, lint, build, tests, dependency audit).
- Downloaded backend artifact: 31 JUnit suites, 288 tests, 0 failures, 0 errors,
  0 skipped.
- Downloaded OSV report: 121 resolved Java dependencies, 0 findings, PASS.
- Local real-provider evidence remains synthetic-only and records one real
  `gemini-3.5-flash` turn; no provider secret is stored in evidence.

Issue #25 may be closed completed after this evidence receipt is published and its
exact GitHub SHA/CI are verified.
