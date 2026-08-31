# PB-011 — Owned backtest jobs

31/08/2026. [Issue #13](https://github.com/tranbaohoang10/AITrading/issues/13)
created before code. PB-003/PB-007/PB-010 DONE; independent of blocked PB-008.

UC-JOB-01: owner explicitly submits an immutable VALIDATED strategy revision and
an immutable dataset. API validates both, freezes input and provenance, creates a
durable job and executes only the fixed Python engine. UC-JOB-02: owner lists and
reads phase/status and persisted successful result. UC-JOB-03: owner cancels,
explicitly retries a failed/cancelled run or deletes a terminal job. Original
source deletion cannot alter an accepted snapshot. No automatic backtest from AI.

| AC | Required behavior |
| --- | --- |
| JOB-01 | Owned validated revision+matching contiguous closed dataset; frozen canonical input/hash and provenance; no client code/path/data injection |
| JOB-02 | Durable bounded job lifecycle, owner reads/results/mutations, real phase progress, atomic terminal state/result |
| JOB-03 | Fixed executable/launcher/no shell, sanitized environment, bounded pipes, wall/CPU/memory/process limits and cleanup |
| JOB-04 | Actual Java/Python/PostgreSQL output agrees with hand fixture; validate shape/hash/input identity before persistence |
| JOB-05 | Idempotency, concurrent quota/claim/cancel, snapshot preservation, lease/restart and credential-revocation safety |
| JOB-06 | HTTP/PG/Python/security/regression/build/audit and exact GitHub/CI evidence |

Security: owner checks on every user operation; current credentials; no arbitrary
subprocess or paths/environment; DSL stays data. Resource controls protect a
trusted engine, not a sandbox for arbitrary code. No payment/broker/live trading.
Fixed technology stack and existing engine semantics retained. UI visualization
and job controls belong to PB-012; PB-011 is the independently testable API layer.

DoD: full AC/test evidence, no failed required checks, scoped Vietnamese Refs #13
commit, normal main push, exact GitHub SHA and actual CI PASS, Issue completed.
Do not claim mock worker output is real engine execution or skipped resource
checks PASS. Operator Python setup is resolvable local work, not an approval gate.
