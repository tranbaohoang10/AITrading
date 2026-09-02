# PB-017 design — Refs #26

## Sequence

```mermaid
sequenceDiagram
  actor PO as Product Owner
  participant V as CrossTargetVerifier
  participant P as Python fixture
  participant T as Pine evidence
  participant M as MQL5 evidence
  PO->>V: verify manifest
  V->>P: validate identity and expected rows
  V->>T: validate pinned assertions and official evidence
  V->>M: parse official START/BAR/END trace
  V->>V: exact/tolerant field comparison
  V-->>PO: deterministic PASS/FAIL report
```

## Classes

```mermaid
classDiagram
  class EvidenceManifest
  class ExpectedRows
  class PineEvidenceParser
  class Mql5EvidenceParser
  class CrossTargetVerifier
  class ConsistencyReport
  EvidenceManifest --> CrossTargetVerifier
  ExpectedRows --> CrossTargetVerifier
  PineEvidenceParser --> CrossTargetVerifier
  Mql5EvidenceParser --> CrossTargetVerifier
  CrossTargetVerifier --> ConsistencyReport
```

The standard-library Python CLI reuses the proven MQL5 verifier. It validates the
MQL CSV bytes against the Python dataset, pinned Pine fixture arrays against the
same Python rows, then validates official target evidence. Six Pine fixtures have
retained compact raw traces; the two earlier fixtures retain official complete
trace plus runtime assertion evidence. Reports distinguish those modes rather
than inventing missing raw bytes.

No database/UI/migration/dependency impact. Files are allowlisted by a strict
manifest and resolved inside the repository root. Inputs have byte/row/field
limits and duplicate JSON/trace fields fail.
