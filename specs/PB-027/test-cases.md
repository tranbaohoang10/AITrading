# PB-027 test cases — Refs #16

Synthetic local/test systems only. Status is execution evidence, not design intent.

## ID-T01

- Requirement / AC: IDENTITY-01,03,05
- Objective: Reproduce stale expected identity on existing private routes
- Preconditions: Two synthetic authenticated users, disposable PostgreSQL
- Test Data / Input: A header with B cookie; conversations read/create and logout
- Steps: Run unchanged-source regression, record failure; apply guard; rerun
- Expected Result: 401 before private access; B content/session unchanged
- Actual Result: Verified in final local suites/browser; initial failures and re-runs recorded in results.
- Status: PASS
- Evidence: [Execution results](test-evidence/results.md), [counts/audits](test-evidence/verification.json).

## ID-T02

- Requirement / AC: IDENTITY-01,03
- Objective: Reject missing, malformed, duplicate and wrong identity
- Preconditions: Logged-in synthetic account
- Test Data / Input: Every private module; valid CSRF for unsafe verbs
- Steps: Send negative headers; then matching header
- Expected Result: Negative requests denied without side effects; same-account operations retain contracts
- Actual Result: Verified in final local suites/browser; initial failures and re-runs recorded in results.
- Status: PASS
- Evidence: [Execution results](test-evidence/results.md), [counts/audits](test-evidence/verification.json).

## ID-T03

- Requirement / AC: IDENTITY-01,03
- Objective: Preserve auth bootstrap and revocation
- Preconditions: Anonymous plus logged-in/revoked accounts
- Test Data / Input: CSRF/register/login/me/logout/profile/password
- Steps: Exercise bootstrap, bound self-check, stale logout and password revocation
- Expected Result: Bootstrap succeeds; mismatched logout leaves B active; revoked identity denied
- Actual Result: Verified in final local suites/browser; initial failures and re-runs recorded in results.
- Status: PASS
- Evidence: [Execution results](test-evidence/results.md), [counts/audits](test-evidence/verification.json).

## ID-T04

- Requirement / AC: IDENTITY-02,04
- Objective: Capture identity before asynchronous token retrieval
- Preconditions: Mock fetch with deferred CSRF
- Test Data / Input: A operation while context remounts B
- Steps: Resolve token after replacement, inspect operation headers and old completion
- Expected Result: A header stays A; old response cannot update B; no global identity rebinding
- Actual Result: Verified in final local suites/browser; initial failures and re-runs recorded in results.
- Status: PASS
- Evidence: [Execution results](test-evidence/results.md), [counts/audits](test-evidence/verification.json).

## ID-T05

- Requirement / AC: IDENTITY-02,04
- Objective: Preserve uncertain writes and retry intent
- Preconditions: Existing module provider tests
- Test Data / Input: Timeout, 429 after acknowledgement, mismatched identity and uncertain delete404
- Steps: Fail staged operations, retry and compare UUID/payload; remount account
- Expected Result: No new intent or false completion; 401 clears stale state; transient same-account errors preserve draft
- Actual Result: Verified in final local suites/browser; initial failures and re-runs recorded in results.
- Status: PASS
- Evidence: [Execution results](test-evidence/results.md), [counts/audits](test-evidence/verification.json).

## ID-T06

- Requirement / AC: IDENTITY-03,05
- Objective: Verify real two-tab session change
- Preconditions: Local built API and browser; synthetic A/B
- Test Data / Input: Private A draft and B session; matching A happy path
- Steps: Create as A, switch another tab to B, submit/read/logout from old A tab, inspect B
- Expected Result: Old A request rejected; no A draft in B; B remains signed in after stale logout
- Actual Result: Verified in final local suites/browser; initial failures and re-runs recorded in results.
- Status: PASS
- Evidence: [Execution results](test-evidence/results.md), [counts/audits](test-evidence/verification.json).

## ID-T07

- Requirement / AC: IDENTITY-05
- Objective: Full regression and security
- Preconditions: Final source and owned test systems
- Test Data / Input: Backend/frontend/Python suites, audits, build/lint
- Steps: Run suites/audits; inspect diff, secrets scope and protected artifacts
- Expected Result: All relevant checks pass; limitations explicit; no altered business expectations
- Actual Result: Verified in final local suites/browser; initial failures and re-runs recorded in results.
- Status: PASS
- Evidence: [Execution results](test-evidence/results.md), [counts/audits](test-evidence/verification.json).

## ID-T08

- Requirement / AC: IDENTITY-05
- Objective: Verify publication and DoD
- Preconditions: All local checks pass
- Test Data / Input: Normal main commit Refs16+15
- Steps: Push, compare exact GitHub SHA, inspect actual CI, update/close Issue
- Expected Result: Exact SHA and required CI pass before Issue completed
- Actual Result: Not executed yet.
- Status: NOT RUN
- Evidence: Pending.
