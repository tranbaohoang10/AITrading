# PB-025 design — Refs #27

## Sequence

```mermaid
sequenceDiagram
  actor A as Synthetic user A
  participant UI as React
  participant API as Spring API
  participant DB as PostgreSQL
  participant PY as Python worker
  actor B as Synthetic user B
  A->>API: chat + validated DSL + dataset
  API->>DB: owned snapshots
  API->>PY: frozen backtest input
  PY-->>API: deterministic result
  API->>DB: result + notification + audit
  A->>API: journal + Pine/MQL + document
  B->>API: try A resource identifiers
  API-->>B: deny without disclosure
  API--xAPI: owned process restart
  A->>API: reload and replay same intents
  API-->>A: identical persisted state
```

## Components

```mermaid
classDiagram
  class OwnedHarness
  class BoundedActor
  class JourneyLedger
  class RecoveryVerifier
  class SystemReport
  OwnedHarness --> BoundedActor
  BoundedActor --> JourneyLedger
  JourneyLedger --> RecoveryVerifier
  RecoveryVerifier --> SystemReport
```

`scripts/smoke_system.py` composes public APIs through a bounded cookie client. It
does not query the database directly or import application internals. The existing
owned `test_backend.py --serve` harness supplies a fresh Flyway database, loopback
API, trusted Python executable and restart sentinel. The smoke performs one restart
only, hashes snapshots, checks replay and writes a deterministic-schema JSON report.

Provider-unconfigured behavior is exercised across chat AI, strategy proposal,
journal evaluation, grounded document RAG and image analysis. Successful provider
semantics remain covered by the DONE feature evidence; PB-025 never substitutes a
stub answer. Worker/DB fault, timeout, migration and race behavior remains in the
full executable backend regression and is summarized alongside the actual journey.

No ERD, migration, UI design, dependency or stack impact is expected. Any defect
found is fixed surgically in the owning boundary and retested here plus its suite.
