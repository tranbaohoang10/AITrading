# PB-005 test plan — Issue #8

Created before implementation31/08/2026. All below NOT RUN; actual results/evidence
will be appended, never infer PASS from test existence. Local synthetic data only.
Unit setup: schema and JSON fixture files; HTTP setup: owned disposable PG cluster,
Java21 application, synthetic authenticated users A/B with separate CSRF sessions.

| ID / AC | Objective/data/steps | Expected result | Actual/status |
| --- | --- | --- | --- |
| DSL-01 /01,05 | Validate six neutral family fixtures and inspect capabilities/schema | All valid same grammar; version1.0.0, no runtime implementation claim | NOT RUN |
| DSL-02 /01,06 | Submit null/empty/root array, missing/unknown keys, wrong types, unknown mock version/indicator/op | 422 fixed diagnostic at safe path; no payload echo | NOT RUN |
| DSL-03 /02 | Missing/duplicate/cyclic refs, forward DAG, wrong trendline pivot ref | Valid forward DAG succeeds; invalid refs fail deterministically | NOT RUN |
| DSL-04 /02 | Compare price/volume/oscillator, constants, invalid smoothing source/RSI unit | Typed mismatch rejected, matching units accepted, no constant-only signals | NOT RUN |
| DSL-05 /02,03 | Exact period/lag/depth/node/warmup bounds, pivots/cross/ATR/EMA chains | Computed lower bound correct; maxima accepted, excessive resources rejected | NOT RUN |
| DSL-06 /03 | Risk min/max/precision/leverage-stop relation, missing exits, both sides disabled, future/MTF/pyramiding | Explicit valid contracts accepted; unsafe/unsupported rejected | NOT RUN |
| DSL-07 /04 | Equivalent numbers/whitespace/reversed keys; independent golden hashes, metadata change, parallel calls | Exact canonical bytes/hash stable; metadata changes hash only; immutable results | NOT RUN |
| DSL-08 /06 | Duplicate keys, trailing tokens, invalid Unicode/UTF8, nonfinite/extreme numbers, huge/deep bodies/chunked | 400/413/422 bounded; no crash, parse ambiguity or truncation acceptance | NOT RUN |
| DSL-09 /06 | Anonymous, no/wrong CSRF, hostile Origin, revoked session; other-user independent request | 401/403; no identity mixing; current A/B validate independently | NOT RUN |
| DSL-10 /06 | Per-user throttle near limit, concurrent requests, spoof XFF; reset window | Atomic 200/429, Retry-After; B independent; recovery after window | NOT RUN |
| DSL-11 /06 | Unknown `$ref` URL/script/SQL/path/type payloads and HTML metadata | No execution/fetch, reject unknown fields; bounded text stays inert; no input in errors/logs | NOT RUN |
| DSL-12 /07 | Full backend+DB/frontend/verifier suites, build/lint/audits and actual GitHub CI | All applicable checks PASS; preserved V1–V3/history and unrelated files | NOT RUN |

UI/browser N/A: no UI change. Provider/backtest/trade P&L/external target runtime
checks N/A for PB-005 validation-only scope; mandatory in their own backlog items.
DB outage/session restoration is existing integration regression, validation itself
has no durable database write besides existing session/throttle infrastructure.

## Actual local results — 31/08/2026

All original NOT RUN rows above retain the pre-implementation plan. Current
execution is recorded here; exact methods/counts in test-evidence/backend-tests.json.

| Cases | Automated evidence | Actual result/status |
| --- | --- | --- |
| DSL-01 | neutralFamiliesMatchIndependentGoldenBytesHashAndWarmup; schema fingerprint; authenticatedApiReturnsSchemaCapabilitiesAndDeterministicIdentityWithoutPersistence | Six families, exact hashes/warm-up, version freeze and validation-only capability PASS |
| DSL-02 | missingUnknownRootTypeAndVersionFailWithoutEcho; malformedSemanticAndUnknownFieldsHaveBoundedRedactedErrors | Unknown/missing/types/version rejected; redacted422/400 PASS |
| DSL-03 | resolvesForwardDagAndRejectsCyclesMissingDuplicateAndWrongPivotRefs | Forward definitions accepted; duplicate/cycle/missing/type reference errors PASS |
| DSL-04 | enforcesDimensionalTypesAndMeasurableSources | Price/volume/oscillator mismatch, constant-only and wrong source rejected PASS |
| DSL-05 | preciseWarmupIncludesSourceLagCrossPivotAndEvenUnusedDefinitions; maxDepthAndConditionCountAreAcceptedButNextLevelRejected; indicatorListAndWarmupBudgetsAreBounded; exactGlobalConditionAndWarmupLimitsDoNotHaveOffByOneErrors | Exact128/129 conditions,10000/10001 bars,8/9 depth,32/33 indicators; minimumBars and limits PASS |
| DSL-06 | riskBoundsAndExecutionRulesRejectUnsafeOrImplicitAlternatives; rejectsOpaqueFutureOrUnsupportedObjectsAndRetainsInertMetadata | Leverage*stop boundary, disabled sides, next-open and unsupported contracts PASS |
| DSL-07 | canonicalPreservesExactDecimalsUnicodeAndEquivalentNumericForms; metadataLabelsHaveNoHiddenTradingSemantics; parallelValidationCannotMixMutableTraversalStateOrErrors; independent Python script | Exact normalization/Unicode/hash, immutable outputs and64interleaved validations PASS |
| DSL-08 | textBoundariesUnicodeAndNumberResourceAbuseFailSafely; malformedDuplicateTrailingDeepAndOversizedInputsAreRejected; exactBodyLimitIncludesChunkedRequestsAndOtherRoutesRemainSmaller | Exact64KiB accepted;64KiB+1 rejected including chunked; other routes16KiB; malformed/UTF8/extremes rejected PASS |
| DSL-09 | boundaryDeniesAnonymousCsrfOriginAndRevokedSessions; existing auth/chat regressions | Actual HTTP401/403, revoked A, independent B and existing DB-outage recovery PASS |
| DSL-10 | userThrottleIsAtomicIndependentAndCannotBeSpoofedByForwardedHeaders | Concurrent200/429 at limit,900s Retry-After, separate B and next window PASS |
| DSL-11 | rejectsOpaqueFutureOrUnsupportedObjectsAndRetainsInertMetadata; unsupportedKeywordsRemoteRefsAndOpenObjectsCannotBecomeTrustedSchema; diagnosticCapDoesNotReturnUserSuppliedIdsOrUnboundedErrors | No execution/network sink; fixed messages/known paths, exact20errors with no private IDs PASS |
| DSL-12 | Full56Java/HTTP/DB,57frontend,6verifier,6canonical; builds/lint/audits | LOCAL PASS; actual GitHub CI/publication still pending, do not close Issue yet |

Initial empty-input failure and production correction retained in results.md.
No expected-result relaxation or existing test deletion. Diagnostic assertions
were strengthened from generic unsupported shape to exact numeric field error.
