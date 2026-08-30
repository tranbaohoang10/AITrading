# Prototype architecture and CNPM physical view

Status: PB-001 delivered; PB-002 foundation implementing. Diagrams distinguish
current boundaries from future modules. No AI/trading runtime is claimed yet.

```mermaid
flowchart LR
  Browser[React + TypeScript + Vite browser]
  API[Spring Boot Java21 API]
  DB[(PostgreSQL / Flyway)]
  Python[Future Python DSL backtest / AI]
  Provider[Future AI provider]
  Browser -. authenticated REST in PB-003 onward .-> API
  API -->|JDBC, owned application schema| DB
  API -. bounded validated jobs PB-011 .-> Python
  API -. server-side keys PB-008 .-> Provider
```

Frontend is a separate local demo today. Backend foundation exposes only minimal
DB readiness; all future private API paths deny access until their authenticated
feature is implemented. No browser→DB/Python/provider-key shortcut is allowed.
Native PostgreSQL tests use a fresh project-owned cluster, not the user service.
Local developer compose, if used, binds DB port to loopback and needs an environment
password; it never defaults to trust authentication or a hardcoded credential.

```mermaid
flowchart TB
  Researcher((Researcher)) --> Shell([Inspect demo trading workspace])
  Operator((Developer/operator)) --> Start([Start local API and isolated DB tests])
  Operator --> Ready([Inspect minimal readiness])
```

This is the currently supported use-case diagram. Add authenticated research,
chat/strategy/backtest/journal/knowledge use cases only as their PB items are built.
Per-feature sequence/class diagrams are in specs/PB-001 and specs/PB-002.

ERD currently has no business entities. Flyway owns trading.flyway_schema_history
(installed_rank PK, version, description, type, script, checksum, installed_by,
installed_on, execution_time, success). PB-003 creates users/sessions; later
features own their additive migrations and ownership foreign keys. Never invent a
completed overall ERD from planned tables. PB-026 reconciles this file with code.
