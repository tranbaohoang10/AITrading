# PB-011 test cases — Issue #13, 31/08/2026

| Case | AC | Expected evidence |
| --- | --- | --- |
| JOB-T01 |01 | Owned validated immutable snapshot, matching market/gaps/warm-up/cutoff; raw/foreign IDs and injection rejected |
| JOB-T02 |02 | Actual durable create/list/status/result/delete; pagination, bounds, quotas and safe statuses |
| JOB-T03 |03 | Actual supervised Python correct args/clean environment; resource setup/no child, input/output/stderr/time limits; owned cleanup |
| JOB-T04 |04 | Real Java→Python→PG hand example, repeat determinism, canonical/input/DSL/data/result hashes and exact trade trace |
| JOB-T05 |04 | Malformed/duplicate/trailing/oversized/wrong hash/version/provenance/exit result rejection; no partial success |
| JOB-T06 |05 | Parallel duplicate UUID and changed intent; claim/quota concurrency; same explicit retry preserved |
| JOB-T07 |05 | Cancel queued/running, late output/credential revocation/DB failure; monotonic state and no result |
| JOB-T08 |05 | Source edit/delete after snapshot, account isolation, persistence across real API restart; expired run not auto-replayed |
| JOB-T09 |02,06 | Anonymous/BOLA/session/CSRF/Origin/mass assignment/read/start/cancel rate tests |
| JOB-T10 |06 | Full backend/frontend/Python/verifier/build/audit, diff/secret/scope, exact GitHub SHA and actual CI |

Record exact executed evidence, no source-inspection substitute for actual worker.
UI screenshot N/A here: no UI source change; PB-012 must test actual integrated UI.
