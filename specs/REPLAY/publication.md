# Replay delivery publication

07/09/2026, Asia/Ho_Chi_Minh. Refs #39, #43, #46, #47.

## Repository and implementation

- Start: `39b45b6cb44077b354a281019e5bb85d74e8af8d`, current origin/main at mission start.
- Implementation: `317b60356f9c89e69c230d40ee890fd94fafa1e0`, 113 scoped files.
- CI fixture correction: `057628ca0a585274b78607b9cc930b88d1d38cef`.
- Branch: main. Both pushes were normal fast-forward updates and the exact remote SHA was verified. No branch, PR, force push or applied-migration rewrite.
- Six unrelated untracked files were preserved and excluded: `.agents/mcp_config.json`, `AITrading_Replay_Redis_Journal_Implementation_Plan.docx`, `frontend/bottom.txt`, `frontend/top.txt`, `screenshot.png`, `specs/PB-038/chart-workspace-qa.md`.

## Exact-SHA CI evidence

[Run 34134266248](https://github.com/tranbaohoang10/AITrading/actions/runs/34134266248) completed SUCCESS at `057628ca0a585274b78607b9cc930b88d1d38cef`.

| Check | Result |
| --- | --- |
| Frontend lint/build/tests/full npm audit | PASS; 48 files, 292 tests, zero vulnerabilities |
| Java Gradle Wrapper/PostgreSQL/Redis | PASS; downloaded JUnit artifact: 44 classes, 331 tests, zero failures/errors/skips |
| Java dependency inventory/audit | PASS; 144 coordinates, zero findings |
| Python deterministic/adversarial suite | PASS; 58 tests |
| Verification tools | PASS; 6 tests |
| DSL canonical and backtest UI fixtures | PASS |
| Readiness/CNPM/migration ledger | PASS; 19 migrations, 30 tables |

All listed CI steps exited 0. The previous run 34134055259 failed because a readiness test fixture still expected V1–V18; the correction and successful rerun are preserved in test-cases.md. No test or security gate was disabled. Vite's informational chunk-size warning remains.

## Delivered behavior and limits

- Real Coinbase and Binance historical Replay; provider identity and selected snapshot persist in PostgreSQL. Frontend receives revealed candles only; Step transfers the new window. No future-derived indicator input or cross-provider stitching.
- Market entry at next revealed open; adverse slippage/commission; Long/Short simulation, risk percent/amount/quantity, SL/TP draft drag and one write on active pointer-up, conservative stop-first intrabar ambiguity, exactly-once atomic Journal projection.
- Optional Redis market cache, bounded singleflight/owner-safe lease, actual current-bar updates and actual outage fallback. JDBC sessions and durable Replay/Journal stay in PostgreSQL.
- Actual Coinbase closed OHLCV parity against official REST, browser network recovery and separate controlled provider socket lifecycle tests. These are separate evidence sources, not a claim that an external provider outage was forced.
- Journal day/week/month, Monday 35/42-slot calendar, purple activity independent of P&L, day notes, 65-row numbered pagination/filter checks and saved execution review at 1440/1024/390.
- Frankfurter: actual 300-observation EOD reference chart, intraday disabled and trading Replay unsupported. Alpaca IEX/raw paging is implemented and fixture-tested; actual stock E2E remains BLOCKED_EXTERNAL without credentials and applicable entitlement. FRED MACRO and Alpha Vantage remain audited candidates with runtime adapters disabled/not implemented; they are not delivered candle feeds.
- Initial simulation restrictions: one active position/session, no leverage or currency conversion, no unverified lot/contract sizing, bounded selected history (20,000 bars; provider-specific smaller archive range), 50 sessions/account, existing Journal quota. No real broker orders. No claim of universal/global earliest coverage or commercial redistribution rights.
- Performance evidence is instrumented 20k-bar render isolation, incremental command payloads, bounded transport/cache and browser node continuity; it is not a measured browser FPS or heap benchmark.

## Browser and issue evidence

[QA-01–49 scorecard](qa-scorecard.md), [chronological tests](test-cases.md), [browser assertions](test-evidence/browser-scenarios.json), [provider audit](../../docs/market-data/provider-audit.md).

The user test website at http://127.0.0.1:5175/ serves the verified application with its existing owned database preserved. Health returned 200 after publication; API smoke passed seven groups against 8081. Synthetic QA data is clearly test data; provider charts use actual upstream observations.

Issue #43's missing responsive/Frankfurter evidence is now supplied; #46 and #47 have local and implementation-CI evidence. Explicit closure follows verification of the documentation commit containing this record. Issue #39 remains OPEN for the inherited live Alpaca entitlement check. Final documentation SHA, CI URL and Issue state are reported in the GitHub Issue updates and delivery response, avoiding a self-referential SHA rewrite cycle.
