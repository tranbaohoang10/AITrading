> Historical record of GOV-PROTOTYPE-001 (prototype 2.0.0). Its no-push and
> waiting-for-review statements describe that completed local-document task,
> not the successor request in Issue #3. See autonomous-migration.md for the
> autonomous-mode transition and its actual delivery status. Original history
> below is preserved.

# Governance Migration — Codex-only Prototype Mode

- Change ID: `GOV-PROTOTYPE-001`.
- Date: 30/08/2026, Asia/Ho_Chi_Minh.
- Performer: Codex.
- Authority: direct Product Owner instruction to switch this repository to
  PROTOTYPE/DRAFT and Codex end-to-end delivery.
- Constitution: 1.0.0 → 2.0.0 (major change to responsibilities/workflow).
- Scope: governance and supporting documentation only.
- Delivery status: local document changes awaiting Product Owner review.
- Current branch at task start: `feature/mvp-ui`; not renamed or recreated.
- GitHub Issue / commit / push / Pull Request / merge: not performed in this task.
  This is a governance-only transition, not a new product feature.

## Authorization and impact

The Product Owner explicitly requested: “Hãy trước tiên chuyển governance của
repository sang Codex-only Prototype Mode.” This authorizes replacing the old
three-agent roles and gates for the prototype, including the Constitution.
It does not assert that the Product Owner has reviewed this resulting patch,
approved a PR or permitted a merge.

The old mvp-ui implementation path restrictions remain historical feature scope;
this separate, explicitly requested governance task does not implement or expand
that product feature. Future product changes still need their own Issue and
prototype design/test artifacts.

Replaced active entrypoints now point to the prototype workflow. Five original
documents are preserved without content changes under `docs/governance/legacy/`.
Five old agent entrypoints retain their original content with a legacy notice.
No runtime tool permissions are loosened.

The existing generic Spec Kit templates and skills remain unchanged. Their
three-agent wording, generic branch examples and optional-test examples are not
prototype authority. The active skill guide requires the prototype checklist to
take precedence when using them. No scaffolding command was executed.

The previous proposed Constitution amendment 1.1.0 remains a proposal; this task
does not manufacture approval for it. No prior history row or feature verdict is
rewritten. Reverting to the official-KL workflow would require a new owner decision
and an append-only amendment, not a silent mode switch.

## PRE-EXISTING CHANGES

The Product Owner identified these old mvp-ui re-review documents as pre-existing
work, excluded from this task:

- `specs/mvp-ui/defects/BUG-001.md`.
- `specs/mvp-ui/review/review-report.md`.

At this task's checks, `git status --short` and later
`git status --short --untracked-files=all` returned no changes before edits.
This observation does not reclassify the owner-identified work as ours. No
attempt was made to revert, stash, commit or otherwise reconcile those files.

Baseline SHA-256:

- BUG-001.md: `F44619387EE1AD6DE42658417FC45C68BF47A9321F5EE6E6B7FD778DCB1053F9`.
- review-report.md: `ECF2A993DC75DCA1DEAC6EFBDDCD862079629FAC760678616B960481D051F651`.

All 14 existing files under `specs/**` were also hashed before edits to verify
preservation of the entire existing feature record.

## GOVERNANCE CHANGES CREATED BY THIS TASK

| Path | Change |
| --- | --- |
| `AGENTS.md` | Active Codex-only role, prototype workflow, scope, tests, security and Git rules |
| `README.md` | Identify prototype status and link active governance; distinguish roadmap from implementation |
| `.specify/memory/constitution.md` | Version 2.0.0; retire three-agent gates, retain stack/safety, define new artifacts and owner authority |
| `.agents/rules/00-project-governance.md` | Align automatically read workspace rules with prototype mode |
| `docs/agent-skills.md` | Apply skills by activity; prevent legacy/template requirements from restoring retired gates |
| `agents/agent-2-developer.md` | Add legacy notice only |
| `agents/agent-3-tester.md` | Add legacy notice only |
| `.agents/agents/agent-1-analyst/agent.md` | Add legacy notice after frontmatter; retain old role body |
| `.opencode/agents/agent-3-tester.md` | Add legacy notice after frontmatter; retain tool permissions and role body |
| `GEMINI.md` | Add legacy notice only |
| `docs/governance/prototype-workflow.md` | Ordered delivery process, required CNPM artifacts, test-case format, security matrix and DoD |
| `docs/governance/prototype-migration.md` | This scope/authority/preservation/review record |
| `docs/governance/legacy/README.md` | Inventory and explicit inactive status of historical governance |
| `docs/governance/legacy/agents-before-prototype.md` | Unmodified snapshot of original AGENTS.md |
| `docs/governance/legacy/readme-before-prototype.md` | Unmodified snapshot of original README.md |
| `docs/governance/legacy/constitution-1.0.0.md` | Unmodified snapshot of original Constitution |
| `docs/governance/legacy/workspace-rules-before-prototype.md` | Unmodified snapshot of original workspace rules |
| `docs/governance/legacy/skill-matrix-before-prototype.md` | Unmodified snapshot of original skill matrix |
| `docs/revision-history/index.md` | New append-only project summary recording this transition |

No product source, tests, dependencies, lockfiles, database/migrations, CI/CD,
existing specs, skill definitions or Spec Kit scripts/templates are in the
authorized write set for this task.

## Acceptance and verification plan

| AC | Expected verification |
| --- | --- |
| AC-GOV-001 | Active AGENTS, Constitution and workspace rules consistently select Codex-only prototype; legacy role notices prevent old handoffs from acting as gates |
| AC-GOV-002 | All six fixed stack items retained; no Maven or dependency change |
| AC-GOV-003 | Workflow contains all requested stages in order, with one actual Issue and ASCII branch per new product feature |
| AC-GOV-004 | Artifact checklist requires UC, detailed UC description, AC, Sequence/Class diagrams, Data/ERD, UI where applicable, Security, separate test Markdown and DoD |
| AC-GOV-005 | All requested test categories and security risks addressed with evidence and justified applicability |
| AC-GOV-006 | Modern password hashing, Argon2id preference, no plaintext/plain MD5/SHA; no authentication code introduced |
| AC-GOV-007 | Vietnamese commit format, Refs, no Closes, tested-before-close, no direct-main/force push and explicit merge permission |
| AC-GOV-008 | Credit/payment exclusion and method-neutral canonical Strategy DSL retained |
| AC-GOV-009 | Five archive hashes match baseline; legacy role bodies/frontmatter retained; all existing specs and protected re-review files unchanged |
| AC-GOV-010 | Diff contains only this table's governance paths; no product implementation, staging, commit, push, PR, merge or next feature |

Required checks: read the active policy against the Product Owner checklist;
compare archive hashes to the captured baseline; compare role notices against
original bodies; verify hashes of all existing specs; inspect `git diff`,
`git diff --check`, `git diff --name-only`, staged diff and
`git status --short --untracked-files=all`; inspect new untracked documents too.

Runtime product tests, builds and attack simulations are not run for this
documentation-only change. Their absence must not be represented as a product
PASS or proof that the application satisfies the newly documented security policy.
No dependency install or external security scan is needed for this patch.

## Verification results — 30/08/2026

| Check | Actual result |
| --- | --- |
| Manual requirement-to-policy review, AC-GOV-001 through AC-GOV-008 | PASS for documented governance coverage; not a runtime product/security test |
| SHA-256 of all existing specs | PASS: all 14 files match the pre-edit baseline, including both owner-protected re-review documents |
| SHA-256 of legacy snapshots | PASS: all 5 snapshots match the corresponding original file bytes |
| Legacy role body/frontmatter comparison | PASS: all 5 bodies retain their original text aside from the added notice; line endings normalized for comparison; runtime permissions unchanged |
| Markdown code fences and local-link validation | PASS: 9 active/new documents checked, command exit 0 |
| `git diff` and per-path diff review | PASS: active governance rewritten as documented; legacy roles receive notices; command exit 0 |
| `git diff --name-only` | PASS: exactly 10 tracked governance documents; command exit 0 |
| `git status --short --untracked-files=all` | 10 modified governance files and 9 new governance/history files; no existing spec listed |
| `git diff --cached --name-only` | Empty, exit 0; no staging performed |
| `git diff --check` | PASS on re-run, exit 0; initial newly introduced trailing whitespace corrected |

Git prints LF-to-CRLF warnings due to the existing checkout configuration.
No Git configuration was changed. Historical snapshots remain byte-identical.
No product test/build/security-runtime result is claimed. No commit, push,
Issue creation/closure, Pull Request or merge was performed.

AC-GOV-009 and AC-GOV-010 are supported by the preservation and scope checks above.
Result: **governance patch prepared; awaiting Product Owner review**.
