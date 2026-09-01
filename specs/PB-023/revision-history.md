# PB-023 revision history

- 01/09/2026, Asia/Ho_Chi_Minh: selected after PB018 DONE; Issue24, CNPM design,
  initial threat matrix and adversarial test plan created before security changes.
- 01/09/2026, Asia/Ho_Chi_Minh: source and regression review found no unresolved
  high/critical issue. Added four defense-in-depth response headers, explicit
  deployment Secure-cookie guidance and a local two-owner adversarial/restart smoke.
- 01/09/2026, Asia/Ho_Chi_Minh: the first full run caught an unsafe explicit
  `secure=false` default that suppressed HTTPS auto-detection. Removed that override
  and retained the standard deployment setting; clean full regression then passed.
