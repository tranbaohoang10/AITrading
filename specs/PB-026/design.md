# PB-026 design — Refs #28

## Readiness sequence

```mermaid
sequenceDiagram
  actor O as Developer/operator
  participant D as Repository docs
  participant V as ReadinessVerifier
  participant M as Flyway V1-V17
  participant T as Locked test suites
  participant C as GitHub CI
  O->>D: inspect setup, capability matrix and CNPM index
  O->>V: run bounded offline verification
  V->>M: compare exact migration names and SHA-256
  V->>D: verify PB state, links, architecture and safe claims
  O->>T: run backend/frontend/Python/security checks
  T-->>O: deterministic local evidence
  O->>C: normal main publication
  C-->>O: exact-SHA required result
```

## Components

```mermaid
classDiagram
  class ReadinessVerifier
  class BacklogParser
  class MigrationLedger
  class ArtifactIndex
  class SecretShapeScanner
  class ReadinessReport
  ReadinessVerifier --> BacklogParser
  ReadinessVerifier --> MigrationLedger
  ReadinessVerifier --> ArtifactIndex
  ReadinessVerifier --> SecretShapeScanner
  ReadinessVerifier --> ReadinessReport
```

`scripts/verify_readiness.py` uses only the Python standard library. It reads
bounded repository text, refuses symlinks and paths outside the root, parses JSON
with duplicate-key rejection, binds all Flyway files to a pinned SHA ledger, and
emits sorted JSON plus stable Markdown. It does not call GitHub or any external
service, so CI/fresh-checkout execution does not depend on mutable network data.

## Data, UI and deployment impact

No ERD/migration/runtime/dependency/UI change. `docs/architecture.md` is the
current aggregate view derived from existing classes and V1–V17; feature diagrams
remain detailed evidence. `docs/cnpm-index.md` is the navigation layer for the nine
deliverable groups. Existing real browser evidence is indexed; no screenshot is
invented or rerun solely for assembly.
