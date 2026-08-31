# PB-011 revision history

- 31/08/2026: Issue #13 created before code. Independent READY successor while
  PB-008 real-provider smoke is blocked; design freezes owned inputs, durable
  lifecycle and bounded trusted process supervision without changing engine semantics.
- 31/08/2026: Added V7/API/store/scheduler and independent process/pipe/resource
  boundaries. Real Windows resource tests, Java/Python/PG hand calculations and
  synthetic API restart/source-deletion smoke PASS. Expanded validation, global
  quotas and watchdog slow-status tests before final regression/publication.
- 31/08/2026: Expanded separate test Markdown with explicit preconditions,input,
  steps,expected/actual status and named evidence for every case, per the full-build
  request. No implementation or expected runtime behavior changed.
