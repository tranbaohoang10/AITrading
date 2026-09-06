# Test evidence

- `MarketIntelligenceServiceTests`: bounded validation and missing-key fail-closed behavior.
- Frontend workspace test covers both tabs and unavailable state; final combined suite is PASS, 274 tests / 40 files. Backend full suite is PASS, 303 tests / 36 XML suites. GitHub Actions run [34025148491](https://github.com/tranbaohoang10/AITrading/actions/runs/34025148491) passed at final SHA `c1ddac30081c4ed0661383e21bc8cc452b25e2e9`.
- Live provider output is BLOCKED until a server-side key and adapter/retention policy are supplied; no synthetic data is used.
