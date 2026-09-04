# Prototype readiness and capability matrix

Status date: 02/09/2026 Asia/Ho_Chi_Minh. This repository is a research
**PROTOTYPE/DRAFT**, not a production trading system. The evidence-backed required
scope is complete through PB-025; PB-026 performs final assembly and verification.

## Capability matrix

| Capability | PB / state | Evidence-backed boundary |
| --- | --- | --- |
| Responsive research shell | PB-001 DONE | Desktop/tablet/mobile and accessibility tests; no production-readiness claim |
| Backend/database/auth | PB-002/003 DONE | Java21, PostgreSQL/Flyway, Argon2id, persistent sessions, CSRF/rates/owner checks |
| Private chat and AI | PB-004/008 DONE | Durable owner-only messages; Gemini selected by neutral provider, OpenAI optional, disabled without key; no fake response |
| Neutral Strategy DSL and storage | PB-005/007 DONE | Versioned validated canonical JSON; no eval; method-neutral and explicit acceptance |
| Market CSV/chart | PB-006 DONE | Owned bounded CSV OHLCV; no arbitrary URL or paid external feed |
| AI strategy proposal | PB-009 DONE | Structured proposal/clarification, validation and explicit accept/reject; no auto-run |
| Python backtest/API/UI | PB-010/011/012 DONE | Deterministic causal engine, frozen owned jobs and actual results; historical output is research only |
| Journal and AI evaluation | PB-013/014 DONE | Exact documented linear accounting and grounded feedback; no broker reconciliation or advice guarantee |
| Pine/MQL research export | PB-015/016 DONE | Eight official synthetic traces each; no live orders/network/DLL; chart/terminal input differences remain |
| Cross-target consistency | PB-017 DONE | Eight shared fixtures, 51 bars, event/accounting comparison, zero unexplained divergence |
| Private documents/RAG | PB-018 DONE | Versioned TXT/PDF, bounded retrieval and citations; uploaded content stays untrusted |
| Chart image analysis | PB-019 DONE | Bounded canonical image, evidence/inference separation; no URL or DSL mutation |
| Notifications/audit/security | PB-022/023/024 DONE | Private terminal inbox, redacted activity, adversarial regression; not forensic/compliance certification |
| Integrated recovery | PB-025 DONE | Actual HTTP/PostgreSQL/Python/browser journey and restart; synthetic data only |
| Expected-account binding | PB-027 DONE | Private APIs reject stale/wrong account context in addition to resource ownership |
| Broker/paper orders | PB-020 DEFERRED_OPTIONAL | No broker account, orders or live trading; requires a separately authorized provider/sandbox |
| External market connector | PB-021 DEFERRED_OPTIONAL | Owned CSV is the implemented source; licensing/provider selection deferred |

Credit/payment, live-money execution, profitability promises, production HA,
backup/restore certification, external data licensing and regulatory/compliance
certification are not implemented. AI/provider availability and data policies are
external. Gemini free-tier access is not guaranteed. Pine uses chart data and
floating point; MQL5 uses an explicit CSV sandbox; Python uses Decimal34. PB-017
proves the pinned fixtures, not universal equivalence for all market histories.

## Reproducible setup and verification

Prerequisites: Git, Java 21, PostgreSQL 16/17 binaries, Python 3.12+, and Node 24
with npm. Use the repository Gradle wrapper and locked npm dependencies. Do not
create a `.env` file in the repository or put credentials on a command line.

```text
git clone https://github.com/tranbaohoang10/AITrading.git
cd AITrading
cd frontend && npm ci --ignore-scripts && npm run lint && npm run build && npm test
cd ..
py -3 -m unittest discover -s python/tests -v
py -3 scripts/verify_readiness.py
py -3 scripts/test_backend.py
```

On Linux CI use `python3` in place of `py -3`. `scripts/test_backend.py` creates
an owned loopback PostgreSQL cluster under `tmp/pg-test-*`, applies Flyway V1–V18,
runs Gradle tests/build/inventory, stops it and removes its generated credential.
It strips provider keys from its child. The normal API needs trusted absolute
`AITRADING_PYTHON_EXECUTABLE` and `AITRADING_PROJECT_ROOT`; database credentials
and optional AI configuration are server environment values described in README.

No AI key is required for core/local verification. A configured real-provider
smoke must use only synthetic data and the existing feature procedure. Do not paste
keys into chat, Issues, screenshots, logs, source or evidence. No broker login or
external Pine/MQL rerun is part of fresh readiness verification.

## GUI/UI evidence

Actual responsive screenshots and browser-state Markdown are retained under:

- PB-001 shell; PB-003 account; PB-004 chat; PB-006 market; PB-007 strategy;
- PB-008 AI unavailable/real synthetic provider state;
- PB-012 results; PB-013 journal; PB-015 Pine; PB-016 MQL5;
- PB-022 notifications; PB-024 audit; PB-027 stale-account isolation;
- PB-025 actual desktop/mobile restart recovery (Markdown evidence).

These files contain synthetic/test accounts and data. The final verifier checks
that the expected evidence roots and at least one responsive image remain present;
it does not treat image pixels as proof of authorization or financial correctness.

## Traceability and reports

- [Product backlog](product-backlog.md) maps PB status, dependencies and Issues.
- [CNPM index](cnpm-index.md) maps the nine thesis deliverable groups.
- [Architecture](architecture.md) derives current use cases/classes/ERD from code.
- [Migration ledger](readiness-migrations.json) binds immutable SQL by SHA-256.
- `scripts/verify_readiness.py` emits deterministic readiness JSON/Markdown and
  fails closed for incomplete state, unsafe paths, stale claims and tampering.
- Feature evidence, publication commits and CI remain under each `specs/PB-*` root
  and append-only `docs/execution-state.md`.
