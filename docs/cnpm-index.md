# CNPM / thesis artifact index

This index is assembled as features complete; it is not evidence that future
diagrams/functions exist. Feature specs hold Use Case/description/AC; design files
hold sequence/class/data diagrams; test-cases are separate per feature.

| Final deliverable | Source and completion rule |
| --- | --- |
| 1. Project overview | README, product-requirements, product-backlog; PB-026 reconciles implemented scope |
| 2. Overall Use Case Diagram | docs/architecture.md, created with foundation and updated for implemented actors/functions |
| 3. Physical View / System Architecture | docs/architecture.md and backend foundation design; actual deployment boundaries |
| 4. Use Case Descriptions | specs/PB-*/spec.md, traceable AC IDs |
| 5. Test Cases | specs/PB-*/test-cases.md and sanitized test-evidence; no combined substitute |
| 6. Sequence Diagrams | specs/PB-*/design.md for important business flows |
| 7. GUI/UI | Per-feature design plus real browser screenshots and state evidence |
| 8. Overall Class Diagram | docs/architecture.md derived from implemented classes; feature class diagrams |
| 9. ERD | docs/architecture.md reconciled against Flyway migrations and actual constraints |

31/08/2026: PB-006 adds owned CSV import/chart use cases, sequence/class/ERD for
V4 and real desktop/mobile/tablet/browser-restart evidence in specs/PB-006.
PB-005 schema-only delivery has no new ERD entity or UI screenshot requirement.

31/08/2026: PB-007 adds private strategy/history use cases and V5 ERD/sequence/class
diagrams, My Script editor and browser responsive/restart/conflict evidence.

31/08/2026: PB-010 adds offline backtest UC/sequence/class design, deterministic
DSL/data/result contract and separate hand-computed/causal/security test cases.
No new ERD or UI; Java jobs are explicitly deferred to PB-011.

31/08/2026: PB-008 adds explicit AI request/status/cancel UC, sequence/class/V6 ERD,
security and separate test cases, plus actual unavailable-provider browser evidence
at desktop/tablet/mobile sizes. Real configured-provider smoke remains BLOCKED;
artifacts describe implemented boundaries without claiming the feature DONE.

31/08/2026: PB-011 adds owned job API UC/description/sequence/class/V7 ERD, explicit
process/resource/lifecycle/security contracts and separate tests. Actual HTTP/
Python/PostgreSQL result and JVM restart evidence are under specs/PB-011. No UI
source change or new screenshot requirement; real web integration remains PB-012.

31/08/2026: PB-012 adds explicit backtest UI use cases, sequence/class diagrams,
frozen-candle API and real metrics/trades/event visualizations. V7 ERD is reused;
no new table. Detailed tests, actual engine UI fixtures and real responsive browser
evidence are in specs/PB-012. This does not claim AI/provider work is complete.
