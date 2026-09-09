# PB-038 CI Audit Follow-up — 09/09/2026

## Trigger

GitHub Actions run `34302916536` verified provider commit
`9a8603b20ae846b53eaa2367d020937ec7eee646`. The backend job passed. The
frontend functional commands reached the final audit command, which failed after
new advisories classified the locked Vitest 3 `@vitest/mocker` and `js-yaml`
versions as vulnerable.

## Remediation

- Upgraded the test runner from Vitest 3.2.7 to 5.0.0, compatible with the
  repository's Node 24 and Vite 7 CI stack.
- Updated the lockfile so `@vitest/mocker` resolves to 5.0.0 and `js-yaml`
  resolves to 4.3.2.
- No production chart or market-data runtime behavior changed.

## Verification

- `npm ci --ignore-scripts`: PASS.
- `npm test -- --maxWorkers=1`: 55 files / 316 tests PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS; existing bundle-size warning only.
- `npm audit --audit-level=high`: PASS, zero vulnerabilities.

The provider implementation status remains
**IMPLEMENTATION COMPLETE — EXTERNAL CREDENTIALS REQUIRED**. Issue #39 stays
open for genuine authenticated Alpaca, OANDA and cTrader event evidence.
