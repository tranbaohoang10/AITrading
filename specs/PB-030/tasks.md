# PB-030 — Quant terminal polish

- [x] Inspect the current rendered Quant UI and current public LuxAlgo Quant interface without copying branding or assets.
- [x] Refine shell/header/avatar, sidebar and Assistant/composer.
- [x] Add chart tools rail, compact dataset/tab controls and camera/export menu.
- [x] Add focused UI regression tests and preserve existing behavior/security contracts.
- [x] Inspect the real app at 1920, 1440, 1024 and 390 widths and repair visual issues.
- [x] Run full frontend tests, lint and build; review scope/secrets; commit/push main.
- [ ] Verify the complete required CI workflow and close Issue #31. Blocked outside frontend scope: frontend CI passed, but the backend dependency audit detected three newly published Tomcat advisories for the pre-existing `tomcat-embed-core:11.0.24` dependency.
