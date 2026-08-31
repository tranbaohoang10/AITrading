# PB-012 — Backtest controls, results and chart visualization

## Mục tiêu
Replace authenticated backtest demo panes with real owned jobs, persisted metrics,
equity/drawdown,trades and frozen-data signal/execution overlays. Reuse the existing
responsive shell and chart; do not redo delivered features.

## Phạm vi
React job provider/API contracts, explicit submit/status/cancel/retry/history,
result/trade views and safe JSON export. Add a read-only owned frozen-candle paging
endpoint so old runs remain inspectable after source dataset deletion. No migration
or simulation/strategy semantics change expected. No AI/broker/payment/live trading.

## Use Case
UC-RESULT-01: researcher selects an owned VALIDATED strategy revision and dataset,
then explicitly starts a backtest. UC-RESULT-02: selects a persisted job and inspects
its actual result and exact provenance. UC-RESULT-03: explores equity/drawdown,
signal/entry/exit bars and individual trades, or cancels/retries a failed job.

## Use Case Description
Signed-in user opens Backtest. UI clearly identifies the saved revision,dataset,
symbol/timeframe and costs; unsaved editor changes never silently become run input.
Start submits one durable UUID and locks uncertain intent. Refresh observes real
QUEUED/RUNNING or terminal state without inventing progress. SUCCEEDED loads only
the matching immutable result/snapshot; failed/empty/loading states show no demo
metrics. A late response for A must never appear under selected B. Source deletion
does not erase result/chart provenance. Mobile and desktop expose the same actions.

## Acceptance Criteria
- RESULT-01: actual authenticated routes show explicit owned job setup/history and
  lifecycle; only validated matching saved inputs; duplicate/uncertain request
  identity preserved; cancellation/retry/delete follow server semantics.
- RESULT-02: actual stored metrics/equity/drawdown/trades/open position and costs;
  decimal strings remain exact for inspection; no mock metrics or fabricated
  prices/progress; null zero-trade win rate/profit factor shown as undefined.
- RESULT-03: immutable run metadata/revision/source/hash/date/engine policies;
  frozen OHLCV chart with correctly aligned signal/entry/exit markers, separate
  from mutable current-market selection; no invented intrabar execution time.
- RESULT-04: full job/result/candle response identity and bounded input validation,
  async identity isolation/draft retention; safe inert text and bounded chart/list
  rendering; explicit JSON export of the selected owned result only.
- RESULT-05: desktop/tablet/mobile/keyboard workflow; meaningful pending/empty/
  failure/uncertain/retry/cancel/delete confirmations; history survives reload;
  no automatic backtest on strategy editing or AI response.
- RESULT-06: tests for happy/zero-trade/loss/open-position/boundaries/invalid
  response/races/permission/source deletion and actual HTTP/browser/DB/Python
  integration, relevant regression/security/audits, exact GitHub SHA and CI PASS.

## UI Requirements
Reuse dark responsive layout, explicit inputs and frozen result provenance.
Native SVG curves/markers, exact text/accessible keyboard inspection; paginate
large candle/trade windows. Keep historical reusable mock-shell tests isolated
from the real authenticated provider; never expose their demo data as real output.

## Data / ERD Impact
Read existing V7 backtest snapshots/results and owned saved strategies/datasets.
New owner-only GET /api/backtests/{id}/candles with bounded paging; requires
SUCCEEDED and serves only frozen snapshot candles. No new table/applied migration.

## Security Requirements
BOLA/IDOR and current credentials on frozen-candle read; existing auth/CSRF/rate
controls for jobs; no caller owner/path/code or arbitrary fetch. Ignore late
cross-user/job responses. Escape all labels/errors; no HTML/script renderer.
Keep keys/tokens out of browser storage/export/logs. Export research JSON only
after explicit user action. No data from an unrelated selected live chart.

## Test Requirements
Separate Markdown cases with ID/AC/objective/preconditions/input/steps/expected/
actual/status/evidence. API contract/adversarial and React async/state tests;
real browser synthetic job→result→chart/trades/export at three viewport sizes,
reload/source-delete/isolation. Existing backend/Python/frontend/build/audits.

## Definition of Done
All AC mapped to actual evidence, relevant tests PASS, no fake UI outcomes,
scoped Vietnamese Refs #issue commit/main push, exact remote SHA and actual CI
verified. Close completed only then; continue next READY item in full-build run.

## Dependencies
PB-001/#4,PB-006/#9,PB-011/#13 must be DONE before code. PB-008 remains blocked
on real-provider smoke and is not a prerequisite here.
