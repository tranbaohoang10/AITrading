# PB-016 revision history

- 31/08/2026: selected next independent READY item after PB-015 checkpoint60964d5;
  Issue18 created before code. Research CSV script scope, no live orders or owner
  terminal-profile modification. Official compiler discovered; execution NOT RUN.

- 31/08/2026: implemented generator/API/V10/real UI and tests. Local163backend,
  186frontend/lint/build PASS; official MetaEditor compiled eight generated
  fixtures with zero errors/warnings (compiler.json), actual target events NOT RUN.
  Initial warning62 local count shadowing corrected; source test updated for that
  rename. Label-neutrality test now normalizes only source hash, which correctly
  also appears in runtime provenance logs, while still comparing all source text.
  Python CPU-limit test timed out under concurrent workload; unchanged full42
  passed in12.964s after heavy tests stopped. Both runs retained in ignored logs.
- 31/08/2026: isolated script probe loaded but failed initialization after waiting;
  no OnStart output, no runtime PASS. Service probe compiled but was not executed.
  Computer Use app approval timed out; stopped UI attempts, no bypass, PO notified
  asynchronously. Continue local/browser/API checks; keep official runtime pending.

- 31/08/2026: source review identified potential double overflow from repeated
  compounding within the allowed5000 bars. Added explicit finite-account/fill/fee
  checks and abort without END; prepared1100-bar repeated-target CSV. Official
  negative execution still required. Regenerate source hashes/goldens and recompile
  all target fixtures after this final generator change; older browser artifact
  hashes remain evidence for the pre-guard build and are not silently relabeled.
- 31/08/2026: filename review additionally rejected reserved Windows device names
  such as CON.csv/NUL.csv/COM1.csv/LPT9.csv; extension/ASCII checks alone do not
  exclude device aliases. Official negative target execution remains required.
- 31/08/2026: final frozen source163backend/186frontend/44Python PASS; both guards
  in exact Java goldens and official MetaEditor8/8 zero warnings/errors. Final
  smoke JVM27456→26396 passed artifact/hash/replay/session/deletion on zoftr_bz,
  signed out and stopped harness/password removed. Browser screenshots remain
  correctly labeled pre-guard evidence; final API report carries new code hash.
  No runtime certification; commit/push/CI checkpoint and open Issue update next.
