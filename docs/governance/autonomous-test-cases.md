# Governance Test Cases — Issue #3

Date: 30/08/2026. Scope: documentation-only autonomous-mode migration.
Issue: https://github.com/tranbaohoang10/AITrading/issues/3

Latest local verification: PASS after direct confirmation; publication results
for GOV-T06 through GOV-T08 are recorded in Issue #3 after the commit/push.
Earlier BLOCKED rows below are historical evidence of the initial attempt.

## First attempt — historical results and case definitions

| ID | AC | Procedure | Expected result | Actual result |
| --- | --- | --- | --- | --- |
| GOV-T01 | AC-AUTO-001/002/003 | Read active AGENTS, Constitution, workspace rules and core skills; inspect direct-main/approval/dependency/failure rules | Consistent autonomous mode without retired gates | BLOCKED: .agents writes rejected by tool auto-review; other draft docs updated |
| GOV-T02 | AC-AUTO-004/005 | Check fixed-stack, DSL, credit/payment, UI/Chat/Journal, Issue, CNPM, test/security requirements | Required policy coverage; no product implementation | PASS for drafted document coverage; GOV-T01 consistency remains blocked |
| GOV-T03 | AC-AUTO-006 | Compare SHA-256 snapshots with original baseline; compare feature/mvp-ui ref and protected blobs | Old documents and two legacy re-review records unchanged | PASS: 10 new and 5 prior snapshots preserved; product ref remains 0029c82 |
| GOV-T04 | AC-AUTO-006/007 | Inspect git status, git diff, git diff --check and staged path list | Only governance/docs/core skills; no product/secret/CI/runtime changes | PASS for current local scope/whitespace; no files staged |
| GOV-T05 | AC-AUTO-005/007 | Check Markdown fences/local links and scan changed text for likely secrets without printing values | Valid documents and no suspected embedded credential | PASS: 11 drafted/current docs, valid fences/links and zero matches in the limited credential-pattern scan |
| GOV-T06 | AC-AUTO-007 | Check commit type, accented Vietnamese subject and Refs #3; compare parent with main baseline | Exact requested commit; normal ancestry; no automatic closing token | BLOCKED: no commit until governance is consistent |
| GOV-T07 | AC-AUTO-007 | Push origin/main normally; compare remote main and GitHub commit API with local SHA | Identical SHA on GitHub, no product commits introduced | BLOCKED: not pushed |
| GOV-T08 | AC-AUTO-008 | Inspect existing required checks and DoD, update Issue with evidence, explicitly close completed, read final status | DoD met, Issue CLOSED/completed, clean main, no next feature | BLOCKED: Issue remains open while delivery is blocked |

Preconditions: authenticated tranbaohoang10 GitHub CLI, verified repository
origin, baseline main and feature refs, authorized local governance work.
Data: repository Markdown and synthetic policy examples only; no credentials
or production data are read for tests. All cases map to Issue ACs above.

## Applicability

Document coverage, invalid policy combinations, omitted constraints, stale
approval gates, traceability, history, scope and secret leakage are relevant.
API/auth/database/provider/network/concurrency attack simulations and frontend/
backend builds are N/A for this patch because no application source, dependency,
schema or runtime configuration changes. This does not claim those product checks
have passed. GitHub network availability and concurrent main updates are covered
by actual delivery/ref checks. A refused tool write is BLOCKED, never N/A.

## Evidence and follow-up

Run git status, git diff and git diff --check as explicitly requested. Use
Get-FileHash for byte preservation, git rev-parse/show for branch/blob evidence,
local Markdown/link validation and a bounded credential-pattern check.
Transport/Issue evidence belongs in Issue #3 after push so the commit does not
claim to have verified its own future remote existence.

Local checks on 30/08/2026: git status, git diff and git diff --check exited 0.
Git printed existing LF/CRLF warnings; no configuration was changed.
main and origin/main remain 7db6a9e2ff666c0d4f7a2977ac22b8180ba5cbce.
feature/mvp-ui remains 0029c82cf3f7a8d7482913d240e8cb6dddc54cb6.
Protected Git blobs: BUG-001.md e03fe3d3fcdc7eef83d83f819ca848c6b8e49b39;
review-report.md 5fb05f3f5d82640776c77283bacb8e529344c067.

Credential scan limitations: detects selected GitHub/AWS/private-key patterns;
it is not a comprehensive secret scanner or product security assessment.
Overall result remains BLOCKED, not DONE, because GOV-T01/T06/T07/T08 are unresolved.

## Resumed run after direct Product Owner confirmation

The direct chat confirmation on 30/08/2026 resolved the tool-authorization
prerequisite. Official escalation successfully updated workspace rules and the
four core skills (exit 0); runtime permissions remain unchanged. The historical
first-attempt results above are retained, not current conclusions.

Current local cases GOV-T01 through GOV-T05 must be rerun before committing.
Publication cases GOV-T06 through GOV-T08 are performed after the requested
commit and recorded with the exact SHA in Issue #3. They are not claimed PASS
before the commit/push actually exists. The Issue stays open until DoD is met.

## Latest local verification — 30/08/2026

| Cases | Actual evidence | Result |
| --- | --- | --- |
| GOV-T01 | Nine active policy/skill documents checked; no direct-main prohibition or retired dependency gate; all requested policy terms present; manual semantic review agrees | PASS |
| GOV-T02 | Fixed stack, neutral DSL, CNPM/test/security and retained product requirements documented; no product implementation in diff | PASS |
| GOV-T03 | Ten 2.0.0/core-skill snapshots and five previous snapshots preserve original SHA-256; five legacy role bodies/frontmatter retained; feature/mvp-ui ref/blobs unchanged | PASS |
| GOV-T04 | Exact 36-file scope: 14 tracked governance/core-skill changes and 22 new documents; git diff --check exit 0 before staging; no product or runtime permission changes | PASS |
| GOV-T05 | 36 files scanned for selected credential patterns with no matches; 20 non-archive documents have balanced code fences; 6 local Markdown links resolve | PASS |

GitHub branch API confirms main at the expected baseline and protected=false.
GitHub Actions workflow API reports total_count=0. No CI was disabled or modified;
the repository currently has no Actions workflow to run for this documentation
commit. Post-push status/check-run evidence is recorded in the Issue.
Product build/runtime test/attack simulations remain justified N/A for this
governance-only patch; no runtime PASS is claimed.

### Staged whitespace verification

`git diff --cached --check` reports four inherited formatting diagnostics in
immutable legacy snapshots: trailing spaces on constitution-1.0.0.md lines
363–365 and a final blank line in workspace-rules-before-prototype.md line 113.
These bytes match the original archived documents and are intentionally retained.
The full staged whitespace check therefore exits 1; this is not reported as PASS.
`git diff --cached --check -- . ':(exclude)docs/governance/legacy/**'` exits 0:
there are no whitespace errors in the active governance changes. No whitespace
configuration or validation rule was disabled to hide the archive diagnostics.
