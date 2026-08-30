# Autonomous Governance Migration — Issue #3

Issue: https://github.com/tranbaohoang10/AITrading/issues/3
Change ID: GOV-AUTONOMOUS-003. Date: 30/08/2026, Asia/Ho_Chi_Minh.
Target Constitution: 3.0.0. Performer: Codex.

## Requirement and scope

The Product Owner's attached request explicitly asks for autonomous work on main,
no Agent/branch/PR/approval gates, necessary dependency/migration self-service,
Issue/Refs traceability, CNPM, broad testing, security-first and safe history.
This task must publish governance only, verify the exact commit on GitHub, close
Issue #3 after DoD, then STOP without implementing a product feature.

The Issue contains UC-GOV-001 and AC-AUTO-001 through AC-AUTO-008, scope, UI/data
impact, security/test requirements and DoD. Detailed test cases are in
autonomous-test-cases.md. No business UML, application code, dependency install
or actual migration is necessary for this document-only task.

## Branch and pre-existing work

At task start: feature/mvp-ui at 0029c82cf3f7a8d7482913d240e8cb6dddc54cb6.
Local main and freshly fetched origin/main were both
7db6a9e2ff666c0d4f7a2977ac22b8180ba5cbce.
The 19 pending governance paths from the prior task were carried to main using
git switch main. No merge/cherry-pick or history rewrite was performed.

The product commits 9511cce and 0029c82 remain on feature/mvp-ui. They are not part
of this governance task. The old specs/mvp-ui/defects/BUG-001.md and
specs/mvp-ui/review/review-report.md were clean before switching; their committed
versions remain on feature/mvp-ui. They are absent on main because that branch
does not contain the product commits, not because this task edits/deletes them
in a commit. Never include their content in the governance commit.

## Changes and preservation

- Update AGENTS.md, README.md, Constitution and prototype-workflow.md for direct
  main delivery, no routine approval, retry-to-PASS and current safety constraints.
- Update docs/agent-skills.md to make legacy tool templates optional and inactive
  as approval/branch gates.
- Prepare updates to workspace rules and four core skills so they agree with
  autonomous dependencies, scope and failure handling.
- Retain the five legacy role notices and all prior 1.0.0 snapshots from the
  previous task, without modifying original role bodies/tool permissions.
- Preserve six 2.0.0 documents and four original core skills as ten byte-identical
  snapshots under docs/governance/legacy/codex-prototype-2.0.0/.
- Keep GOV-PROTOTYPE-001's original history and append the successor record.
- Add docs/product-requirements.md to retain UI, persistent private AI Chat and
  Trading Journal requirements, without implementing them.
- Add this migration record and a separate autonomous-test-cases.md.

No product source/tests, existing mvp-ui records, manifests/lockfiles, migrations,
CI configuration, runtime permissions or branch protections are in scope.

## Rollback and security

Do not force push or rewrite history. Use new compensating commits with Refs #3
if a published governance correction is needed. Preserve legacy snapshots and
history even when policy changes. Inspect staged paths and content before commit;
never stage secrets, .env, product files or unrelated work.

## Initial delivery attempt — historical blocker

Issue #3 created; working branch is main. Draft documents outside .agents updated.
The tool auto-review rejected writing the workspace rules and four core skills:
it requires direct confirmation in chat for the persistent expansion of agent
authority, rather than only the attached request. No workaround or alternate
writer is used to bypass that rejection. Existing tool permissions are unchanged.

The protected .agents updates, final consistency verification, commit, push,
remote SHA verification and Issue closure remain BLOCKED pending that explicit
confirmation. This is an external tool-authorization blocker, not a project-level
manual approval gate being added to the requested workflow. Do not mark DONE or
close the Issue while active documents disagree.

## Pre-confirmation local inventory (historical; includes prior governance work)

The following 32 paths are pending locally. Ten are tracked modifications;
the remaining paths are new documentation. Four core skill updates remain
unapplied and therefore do not appear in this inventory.

- `.agents/agents/agent-1-analyst/agent.md`.
- `.agents/rules/00-project-governance.md`.
- `.opencode/agents/agent-3-tester.md`.
- `.specify/memory/constitution.md`.
- `AGENTS.md`.
- `GEMINI.md`.
- `README.md`.
- `agents/agent-2-developer.md`.
- `agents/agent-3-tester.md`.
- `docs/agent-skills.md`.
- `docs/governance/autonomous-migration.md`.
- `docs/governance/autonomous-test-cases.md`.
- `docs/governance/legacy/README.md`.
- `docs/governance/legacy/agents-before-prototype.md`.
- `docs/governance/legacy/codex-prototype-2.0.0/agents-2.0.0.md`.
- `docs/governance/legacy/codex-prototype-2.0.0/constitution-2.0.0.md`.
- `docs/governance/legacy/codex-prototype-2.0.0/goal-driven-execution-before-autonomous.md`.
- `docs/governance/legacy/codex-prototype-2.0.0/readme-2.0.0.md`.
- `docs/governance/legacy/codex-prototype-2.0.0/skill-guide-2.0.0.md`.
- `docs/governance/legacy/codex-prototype-2.0.0/stack-and-scope-lock-before-autonomous.md`.
- `docs/governance/legacy/codex-prototype-2.0.0/surgical-changes-before-autonomous.md`.
- `docs/governance/legacy/codex-prototype-2.0.0/think-before-coding-before-autonomous.md`.
- `docs/governance/legacy/codex-prototype-2.0.0/workflow-2.0.0.md`.
- `docs/governance/legacy/codex-prototype-2.0.0/workspace-rules-2.0.0.md`.
- `docs/governance/legacy/constitution-1.0.0.md`.
- `docs/governance/legacy/readme-before-prototype.md`.
- `docs/governance/legacy/skill-matrix-before-prototype.md`.
- `docs/governance/legacy/workspace-rules-before-prototype.md`.
- `docs/governance/prototype-migration.md`.
- `docs/governance/prototype-workflow.md`.
- `docs/product-requirements.md`.
- `docs/revision-history/index.md`.

The 19 paths from GOV-PROTOTYPE-001 are intentionally included in the requested
eventual governance commit; the old product/re-review commits are excluded.
No current application code or existing mvp-ui document appears in this list.

## Direct confirmation and resumed delivery — 30/08/2026

The Product Owner subsequently confirmed directly in chat: “Tôi xác nhận và
phê duyệt trực tiếp.” The message explicitly authorizes workspace rules and skill
updates under .agents, autonomous main work, necessary commands/dependencies,
self-repair, Issue management, commit and push to origin/main for this prototype.
It also explicitly preserves all safety limits and prohibits safety workarounds.

The previously rejected write was resubmitted through the official escalation
mechanism after that new direct confirmation and succeeded (exit 0). No alternate
writer or permission change bypassed the rejection. Workspace rules and the four
core skills now express the autonomous mode consistently with Constitution 3.0.0.

The final intended patch contains 36 files: the 32 paths listed above plus:

- `.agents/skills/surgical-changes/SKILL.md`.
- `.agents/skills/goal-driven-execution/SKILL.md`.
- `.agents/skills/stack-and-scope-lock/SKILL.md`.
- `.agents/skills/think-before-coding/SKILL.md`.

The earlier BLOCKED statements describe the first attempt, not the resumed run.
The requested commit message is:

```text
chore(governance): chuyển prototype sang chế độ Codex tự chủ

Refs #3
```

Local validation results are recorded in autonomous-test-cases.md. The exact SHA,
push result, remote verification and final Issue state must be recorded in Issue
#3 after publishing; a commit cannot claim to have verified its own future push.
Do not close the Issue until those checks pass. No product feature follows.
