# CNPM / thesis artifact index

This is the PB-026 navigation index for the implemented prototype. Feature specs
remain the detailed source; sanitized runtime evidence is not replaced by this
summary. The offline readiness verifier checks every local link and feature root.

| # | Final deliverable | Current source and completion evidence |
| --- | --- | --- |
| 1 | Project overview | [README](../README.md), [requirements](product-requirements.md), [backlog](product-backlog.md), [capability/readiness](prototype-readiness.md) |
| 2 | Overall Use Case Diagram | [Aggregate architecture](architecture.md#overall-use-case-diagram); detailed use cases in each `specs/PB-*/spec.md` |
| 3 | Physical View / System Architecture | [Physical view](architecture.md#physical--system-view), [PB-002 design](../specs/PB-002/design.md), [PB-025 integration design](../specs/PB-025/design.md) |
| 4 | Use Case Descriptions | Feature `spec.md` files for PB-001–PB-019 and PB-022–PB-027; [PB-026 spec](../specs/PB-026/spec.md) |
| 5 | Test Cases | Feature `test-cases.md`, sanitized `test-evidence`, [PB-026 cases](../specs/PB-026/test-cases.md) and [readiness evidence](../specs/PB-026/test-evidence/results.md) |
| 6 | Sequence Diagrams | Feature `design.md` files; [PB-026 readiness sequence](../specs/PB-026/design.md#readiness-sequence) |
| 7 | GUI/UI | Real responsive screenshots under PB-001/003/004/006/007/008/012/013/015/016/022/024/027 evidence; [UI evidence inventory](prototype-readiness.md#guiui-evidence) |
| 8 | Overall Class Diagram | [Aggregate class view](architecture.md#overall-class--component-view) plus feature class diagrams |
| 9 | ERD | [Aggregate ERD](architecture.md#aggregate-erd-and-migration-ledger), exact [V1–V17 SHA ledger](readiness-migrations.json), feature migration diagrams |

## Feature artifact roots

Required implemented roots are PB-001 through PB-019, PB-022 through PB-025 and
PB-027. PB-026 is the current assembly/readiness root. Each has `spec.md`,
`design.md`, `test-cases.md` and sanitized evidence. PB-020 broker integration and
PB-021 external market connector are explicitly `DEFERRED_OPTIONAL`; no empty
implementation documents are manufactured for them.

## Evidence rules

- A diagram is a model of implemented code/migrations, not execution evidence.
- A screenshot demonstrates only the recorded synthetic browser state.
- Pine/MQL target PASS comes from PB-015/PB-016 official evidence; PB-017 compares
  event-level target traces. PB-026 does not rerun or fabricate those targets.
- AI real-provider evidence uses synthetic data and never includes a key value.
- DONE requires its Issue, publication evidence and required CI; the readiness
  report cannot promote an incomplete or optional item.
