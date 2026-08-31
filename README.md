# AI Trading Platform — Autonomous Prototype

This repository is a **PROTOTYPE/DRAFT** running in **AUTONOMOUS CODEX MODE**.
Codex performs analysis, design, documentation, implementation, tests and repair,
commits directly on `main`, pushes `origin/main`, and manages GitHub Issues.
No feature branch, Pull Request or intermediate Product Owner approval is required.

Every feature has an Issue before code, relevant CNPM documentation and its own
test Markdown. Codex runs functional/integration/regression/security checks,
fixes failures until PASS or a genuine hard blocker, commits with `Refs #...`,
verifies GitHub and closes the Issue only after its Definition of Done.

## Fixed stack and safety

- React + TypeScript + Vite.
- Spring Boot + Java 21.
- Gradle Kotlin DSL; backend commands use the Gradle Wrapper, never Maven.
- PostgreSQL + Flyway.
- Python when needed for backtest/AI.

Necessary dependencies and safe migrations can be handled autonomously.
No force push or history rewriting. Never weaken tests/security checks or commit
secrets/passwords/.env. Preserve old documents and fixed technology choices.
No credit/payment implementation in the current phase.

Strategy DSL is method-neutral and central to Python backtests, Pine Script and
MQL5 generation. Do not default to ICT/SMC. Historical results never guarantee
future profit.

## Requirements and governance

The [product requirements](docs/product-requirements.md) describe the intended
trading UI, persistent private AI Chat and Trading Journal; they are not a claim
that these features are implemented on main.

Read [AGENTS.md](AGENTS.md), the [Constitution](.specify/memory/constitution.md),
[autonomous workflow](docs/governance/prototype-workflow.md) and
[skill guide](docs/agent-skills.md).
[Historical governance](docs/governance/legacy/README.md) is preserved but inactive.

Governance [Issue #3](https://github.com/tranbaohoang10/AITrading/issues/3) changes
documents only and ends after commit/push verification and Issue closure.
It does not merge the existing product work from `feature/mvp-ui` or start the
next feature.

## Autonomous product build

The subsequent Product Owner request starts continuous product work. The durable
[master backlog](docs/product-backlog.md), [execution state](docs/execution-state.md)
and [CNPM index](docs/cnpm-index.md) track that run separately from governance #3.

The frontend foundation is recovered from feature/mvp-ui with provenance in
[PB-001](specs/PB-001/spec.md). It currently demonstrates responsive workspace,
read-only sample scripts and labelled synthetic backtest panes. PB-004 persists
private chat; PB-008 adds the disabled-by-default AI boundary below, with real
provider verification still blocked on credentials. PB-010 is an offline engine;
authenticated web backtest jobs remain PB-011.
PB-003 adds real authentication/account persistence around that demo workspace.

From frontend/ with Node 22.12+ (verified Node 24.8.0) and npm:

```powershell
npm ci --ignore-scripts
npm run dev -- --host 127.0.0.1
npm run lint
npm run build
npm test
npm audit --audit-level=high
```

Keep the dev server local. Branding is centralized in frontend/src/brand.ts.
The Java/PostgreSQL backend and offline Python engine are described below.
No production readiness is implied by the prototype workspace.

## Backend foundation (PB-002 delivered)

Java21 is required; use backend/gradlew or backend/gradlew.bat for all backend
commands. Gradle distribution checksum is pinned. No global Gradle/Maven needed.

Run real isolated DB tests from the repository root with installed PostgreSQL
binaries (Windows default: C:/Program Files/PostgreSQL/17/bin; otherwise set
AITRADING_TEST_PG_BIN). The harness creates its own cluster under ignored tmp/,
uses random credentials, runs Wrapper tests/build and stops only that cluster:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21'
python scripts/test_backend.py
python scripts/check_dependencies.py backend/build/reports/dependencies.txt backend/build/reports/dependency-audit.json
```

For a persistent local developer DB, optionally use docker compose up -d db after
setting a unique AITRADING_DB_PASSWORD in your shell. No .env file is required or
committed. Set AITRADING_DB_URL to jdbc:postgresql://127.0.0.1:55432/aitrading and
AITRADING_DB_USER to aitrading, then run backend/gradlew.bat bootRun. Keep the password
in environment only; never paste it into Issues/logs. The API binds 127.0.0.1:8080.
GET /api/health reports DB readiness; unimplemented endpoints default-deny.

Stop local DB with docker compose stop db; do not delete its volume if data matters.
Applied Flyway migrations are never edited/reset. Test clusters are retained under
tmp/ after shutdown for diagnosis; they are never committed. Actual verification
and limitations live in specs/PB-002/test-cases.md, not inferred from setup commands.

## Authentication (PB-003 delivered)

The real UI entrypoint requires a server-verified account. Start the API on
loopback8080 and Vite on127.0.0.1:5173; /api is proxied to the backend. Register a
synthetic/local account, then sign in. Email is a normalized login identifier;
this prototype does not verify mailbox ownership or provide email password reset.
Never reuse a real service password for testing. Passwords are Argon2id-hashed;
sessions live server-side in PostgreSQL with HttpOnly/SameSite cookies and CSRF.
Use Account in desktop/mobile navigation to edit your name, change password or
sign out. Password change revokes all sessions and requires signing in again.

PB-027 adds `X-Workspace-User` to every private API read/write, including account
profile/password/logout. Capture the account ID from `/api/auth/me` after login;
keep that expected ID for the workspace and its asynchronous operations. Do not
discover a replacement session's ID just before sending an old draft. Missing,
malformed, duplicate or mismatched identity returns401 before resource access.
The header is a precondition, never an owner selector; backend ownership still
comes from the authenticated principal. CSRF remains required for unsafe requests.
Health, registration, login and CSRF remain bootstrap endpoints; `/auth/me` permits
unbound self-discovery but checks the header when supplied. Stale logout does not
invalidate the replacement account. The UI clears its stale workspace on401;
already-rendered data is not proactively erased merely by another tab changing
session. Late responses are discarded after account remount. Uncertain writes
retain their exact UUID/payload through retry, including rate-limit rejection.

PB-003 is verified on GitHub at099d6a5, Actions33349231331 success, Issue6 completed.
PB-004 replaces the authenticated chat demo; chart/strategy/backtest samples remain
explicitly labelled until their own features.

For a completely disposable browser-test workspace, with installed PostgreSQL
binaries and JAVA_HOME pointing to Java21, run from repository root:

```text
python scripts/test_backend.py --serve
```

This mode builds/serves, **does not run tests**. Run npm run dev in frontend in a
separate terminal. The harness prints an owned tmp/pg-test-... directory and API
PID. Create the printed stop-api file to stop only that API and DB; create the
printed restart-api file to restart only that API against the same test database.
No production/user database is used. Test passwords stay in the process environment
and ignored temporary file, removed on shutdown; do not paste them in Issues.
Ordinary integration verification remains python scripts/test_backend.py.

For deployment beyond this local machine, provide TLS at a trusted endpoint,
Secure cookies and an explicit AITRADING_ALLOWED_ORIGINS value. Forwarding headers
are not trusted by default; do not expose the development proxy or HTTP API publicly.
The current feature is not a production identity/security certification.

## Persistent conversations (PB-004 delivered)

Sign in, open AI Chat on mobile/tablet or use the desktop chat pane. New Chat
creates an owned conversation. Save message persists text; it does not call an AI
provider. Ask AI is a separate explicit PB-008 action. Select past conversations, rename, delete with confirmation, and
load more/earlier pages. Reload messages before retrying a stale-version conflict.
After an uncertain network save, Retry save keeps the same request ID and text
to avoid duplication. No automatic unsafe replay occurs.

Prototype limits:100 conversations/account,2000 messages/conversation,4000 characters
per message,120 mutations/account/15min; list pages20/default50max and message
pages50/default100max. Lists sort by creation time, newest first, so rename/send
does not shift page boundaries. Conversation deletion permanently removes its
messages; it is distinct from preserving Git/governance history. Do not store
secrets in research prompts. Provider/context generation follows PB-008.

PB-004 delivery: cc99d4d, Actions33350972824 PASS, Issue #7 completed.

## Neutral Strategy DSL (PB-005 delivered)

Authenticated API: GET /api/dsl/schema and /api/dsl/capabilities; POST
/api/dsl/validate with application/json and the session's X-CSRF-TOKEN. The POST
takes the document directly and returns `{valid,document,errors}`. A valid document
contains canonicalJson, SHA256 hash, schemaVersion, validatorVersion and minimumBars;
invalid semantics return422 with bounded diagnostics, malformed JSON400. No save,
backtest, AI call or code execution occurs in this validation API. Python now has
the offline PB-010 engine below; Pine/MQL5 remain unimplemented. A hash is a
fingerprint, not authorization or a signature.

Schema1.0.0 and [design/indicator semantics](specs/PB-005/design.md) define closed-bar,
next-open execution, confirmed pivots, typed measurable rules, risk and resource
bounds. [Neutral fixtures](backend/src/test/resources/dsl) are synthetic examples,
not profitable-strategy recommendations. Existing mock DSL is deliberately rejected.
PB-007 provides owned draft/version storage and UI below. PB-005 itself added no dependency or migration.

Run `python scripts/check_dsl_fixtures.py` to verify canonical bytes/hash independently;
the ordinary backend test harness also runs DSL unit and real authenticated HTTP tests.

PB-005 delivery:28a68e0, Actions33352803357 PASS, Issue #8 completed.

## Private market data (PB-006)

The authenticated Chart now displays persisted OHLCV, not the old sample chart.
Use Import CSV to upload a UTF-8 `.csv` file or paste its contents, choose symbol,
timeframe and provenance, then explicitly import. Load synthetic sample only fills
the form; it is labelled SYNTHETIC and is not a market feed. User uploads remain
unverified sources. No external URL is fetched.

The exact header is `timestamp,open,high,low,close,volume`. Use increasing UTC
timestamps such as `2024-01-01T00:00:00Z`, aligned to the selected timeframe, and
closed historical candles. Prices are positive plain decimals with up to8 decimal
places; volume is nonnegative. Limits:1MiB CSV,5000 rows,50 datasets/account.
Invalid/duplicate/out-of-order candles reject the entire import. Gaps are counted
and shown, never filled. See [CSV contract](specs/PB-006/design.md) for exact limits.

Select a saved dataset, inspect exact OHLC/volume/time, use Older/Newer windows and
50/100/200bar sizes. The inspection slider supports arrows, Home and End. Metadata
includes raw CSV and canonical data SHA256 fingerprints; neither certifies source
authenticity. After a failed uncertain import, Retry retains the same request ID
and payload. Delete requires confirmation and permanently removes only that owned
dataset and its candles. Strategy/backtest execution remains separate future work.

Test evidence and publication status: [PB-006](specs/PB-006/test-evidence/results.md).

PB-006 delivery:7c7c198, Actions33355769629 PASS, Issue #9 completed.

## My Script and saved strategy revisions (PB-007)

After signing in, open Strategy DSL, My Code or Strategies. New strategy creates
an empty owned DRAFT. Edit title/JSON, then Save draft to preserve incomplete text,
or Save validated revision to revalidate and save canonical DSL metadata. Validate
alone makes no database change. A VALIDATED revision is not a backtest result or
a guarantee that future runtimes support it. No code is executed in this editor.

Every save creates an immutable revision. History previews are read-only; Use
revision in editor copies old text into current edits and a later save creates
a new revision. Unsaved edits persist across tabs and responsive navigation, not
across signout or a forced page reload. Replacing dirty edits asks confirmation.
Concurrent stale saves fail with409 and keep local text. Reload current revision
requires explicit discard when dirty. On uncertain outcomes, Retry keeps the
original request ID/payload; do not refresh away pending work.

Limits:100 strategies/account,100 revisions/strategy,64KiB UTF-8 draft,120-character
title; read300/write60 requests/account/15min. Deletion requires confirmation and
matching revision, removes only that strategy/history, and keeps datasets/chat.
Chart context is beside the editor on wide screens, or Show chart/Show editor on
smaller screens. Symbol/timeframe mismatch with saved validated strategy is explicit.
Selecting a chart dataset does not bind it to a strategy or start backtesting.
See [design](specs/PB-007/design.md) and [test evidence](specs/PB-007/test-evidence/results.md).

PB-007 delivery:6de03ea, Actions33358050136 PASS, Issue #10 completed.

## Offline Python backtesting (PB-010)

The standard-library engine revalidates Strategy DSL1.0.0 and a matching contiguous
closed UTC OHLCV dataset, then computes causal indicators, next-open fills, costs,
SL/TP, trades and marked equity. Output includes per-bar/event traces and a hashed
run card. PB-011 adds the owned API job boundary below; web controls/visualization
remain PB-012. No external source, live trading or profitability is implied.

Run `python -m unittest discover -s python/tests -v`. See the
[worker setup and synthetic example](python/README.md),
[execution/precision/security contract](specs/PB-010/design.md) and
[test plan](specs/PB-010/test-cases.md). No new Python dependency is required.

## AI provider boundary (PB-008 — verified Gemini / optional OpenAI)

Business logic depends on the neutral `AiProvider` contract. Select one adapter at
server startup: official Gemini Developer API (`generateContent`) or optional
OpenAI Responses, both through Java21 HttpClient without an SDK dependency.
AI is disabled by default. Gemini prototype configuration in the **server process
environment**, with the key supplied privately by the operator:

```text
AITRADING_AI_PROVIDER=gemini
GEMINI_API_KEY=<server-side secret; do not paste into chat>
AITRADING_AI_MODEL=gemini-3.5-flash
AITRADING_AI_ENABLED=true
```

Do not copy a real key into this document, source, browser settings, `.env`, logs,
screenshots, chat or Issues. Restart the API after changing configuration. The
selector defaults to `gemini`; its absent/empty model defaults to `gemini-3.5-flash`.
`AITRADING_AI_MODEL` overrides that default; enabled/key remain explicit. Unknown or
incomplete configuration fails closed without a fake answer or fallback. Optional
OpenAI uses `AITRADING_AI_PROVIDER=openai`, `OPENAI_API_KEY` and an available
structured-output `AITRADING_AI_MODEL`. Only the selected adapter's key is used;
OpenAI credentials or paid OpenAI access are not a prototype prerequisite.

**Gemini free-tier smoke: synthetic test accounts and prompts only; never real
private user data.** The UI displays this warning. Google's published
[pricing/data-use table](https://ai.google.dev/gemini-api/docs/pricing) states that
free-tier content may be used to improve products. Free quota/model access is
account-dependent; neither free availability nor zero retention is guaranteed.

Sign in, select an owned conversation, save a user message, and click Check AI
availability. Ask AI sends only that conversation's latest at most20 saved messages
and16000 characters; it requires an empty unsaved draft. The UI displays availability,
model, pending/error/refusal/status/cancellation distinctly. Only a validated real
answer is persisted as an assistant message. Without configuration, saved chat
works and Ask AI stays disabled; no canned answer replaces the missing provider.

After an uncertain outcome, Check AI status or Retry same AI request uses the same
durable identity without hidden provider replay. After page reload, select the
conversation and Check AI availability to recover its latest attempt. A terminal
failed attempt needs a new explicit Ask AI. Acknowledged CANCELLED prevents later
persistence, but cannot guarantee cancellation of provider billing. An expired
45-second lease becomes a failed attempt on the next status/start check.

Limits:20s whole provider exchange,256KiB response,2048 output tokens,100 attempts
per conversation,one pending per conversation,four concurrent provider calls per
API process; starts10/reads300/cancels30 per account/15min, in addition to existing
chat write limits. No transaction spans the external request. Both adapters' `store:false`
is not a zero-retention guarantee; each provider/account data policy applies. Do not send
secrets. Output is untrusted research text, never trade execution or guaranteed advice.

Local loopback HTTP/real PostgreSQL and UI tests are separate from the required
real Gemini smoke. Gemini3.5Flash synthetic two-turn/context/restart smoke and
publication CI passed; Issue #12 is completed. See the current [provider-neutral amendment](specs/PB-008/provider-neutral.md),
[test cases](specs/PB-008/provider-neutral-test-cases.md) and
[evidence](specs/PB-008/test-evidence/provider-neutral-results.md). Original OpenAI
CNPM/evidence remain as historical records. V13 permits Gemini without changing
V6 or relabelling historical OpenAI attempts.

`python scripts/test_backend.py` strips both real provider keys from its test child
environment. `--serve` intentionally inherits operator configuration. For an owned
unconfigured restart smoke, start it with AI disabled and selector Gemini, then run
`python scripts/smoke_ai.py --owned tmp/pg-test-<printed-id> --report tmp/ai-smoke.json`.
Only after secure Gemini configuration, use a fresh owned `--serve` harness and
append `--real-gemini` to the smoke command. It creates new synthetic accounts,
checks isolation/CSRF/replay, and restarts only that owned API. It never requests a
key on the command line or substitutes a stub for a real-provider result.
The smoke expects `gemini-3.5-flash` by default; use `--model` or its process
`AITRADING_AI_MODEL` to match an explicitly configured alternate model. It verifies
two synthetic turns and their exact context hashes, excludes decoy conversations,
and compares persisted messages after restart. Do not pass private data to it.

## Owned backtest API jobs (PB-011)

Set `AITRADING_PYTHON_EXECUTABLE` to the absolute path of Python3.12+ and optionally
`AITRADING_PROJECT_ROOT` to this trusted checkout root before starting the API.
Keep the Python sources and bundled DSL schema together. The disposable test
harness sets these paths automatically from its actual interpreter/checkout.
No pip dependency, shell command, API key or external market service is needed.
Missing setup returns WORKER_UNCONFIGURED; it never produces demo results.

Authenticated `POST /api/backtests` accepts exactly requestId,strategyId,revision,
datasetId. Use a saved VALIDATED revision and your own contiguous matching dataset
with enough warm-up bars. The server freezes input/hash/provenance, then its
bounded scheduler runs the trusted Python engine. GET /api/backtests lists owned
metadata; GET /api/backtests/{id} reports QUEUED/RUNNING/SUCCEEDED/FAILED/CANCELLED,
without fabricated progress percentages. GET .../{id}/result returns actual
successful persisted JSON, otherwise409. Monetary values are decimal strings.
These routes require the normal session/CSRF controls, never caller owner IDs.

POST .../{id}/cancel with `{}` acknowledges cancellation; late output cannot
publish. POST .../{id}/retry with a new requestId copies only a FAILED/CANCELLED
job's frozen input. Same request identity replays the stored operation; changed
intent409. DELETE .../{id} with `{}` removes only an owned terminal job. Deleting
the original strategy/dataset does not delete the job snapshot or result. Do not
use source deletion to erase private job data; delete the job separately.

Limits:20 stored jobs/account,100/database;2 active/account,16 queued-or-running/
database,two running/database; request starts/retries10,reads300,cancel/delete30
per account/15min. Queued jobs expire after5min; interrupted running leases expire
after60s without automatic replay. Python has a25s supervisor wall limit,20s CPU,
512MiB OS memory limit,2MiB input/32MiB output and4KiB stderr. Windows committed
memory and Unix address space are different measures. Resource setup is mandatory
and fail-closed; this is not a sandbox for arbitrary uploaded code. No credentials
are inherited by the worker. Source/engine/version/hash provenance is retained.

PB-011 introduced the job API; PB-012 connects the authenticated Backtest Results
and Trades panes to those actual saved jobs. Existing simulation limitations apply.
See [job design](specs/PB-011/design.md), [tests](specs/PB-011/test-cases.md) and
[evidence](specs/PB-011/test-evidence/results.md).

To reproduce the synthetic API/restart smoke, first start the disposable harness
with --serve, then run `python scripts/smoke_backtest.py --owned tmp/pg-test-...`
with the exact owned directory it printed and `--report tmp/job-smoke.json`.
This creates only synthetic local data, restarts that owned API and verifies
session/job/result persistence. Create that harness's stop-api sentinel afterward.

### Backtest workspace (PB-012)

Open Backtest, choose an owned saved strategy, a VALIDATED revision and a matching
gap-free dataset, inspect the saved DSL/costs, then explicitly Start saved backtest.
Unsaved editor text is never executed. Refresh selected job to observe real state;
there is no estimated progress or automatic retry. Uncertain submissions retain
one request ID; keep the page open and use Retry same job request. On reload,
inspect saved job history before starting another job. Cancel/retry/delete follow
the server lifecycle; cancellation and deletion require explicit UI confirmation.

Successful runs show actual exact-string metrics, equity/drawdown, closed trades,
open position, costs, provenance and JSON export. Undefined ratios are not zero.
The frozen chart reads GET /api/backtests/{id}/candles?start=0&limit=100 (limit1–500),
independently of the currently selected market dataset. It remains available after
source deletion; the route requires current credentials, ownership and SUCCEEDED.
Markers identify global event bars; protective exits retain BAR_INTERVAL precision,
not a guessed intrabar timestamp. Inspect exact prices/times and event details.
Desktop/tablet/mobile share provider state; historical mock-shell fixtures are not
used inside the authenticated backtest panes. No live trading or AI execution.

See [PB-012 design](specs/PB-012/design.md) and [test cases](specs/PB-012/test-cases.md).
`python scripts/backtest_ui_fixtures.py --check` reconciles six synthetic UI fixtures
with the real unchanged engine and hand-calculated outcomes; CI runs this check.

### Trading Journal (PB-013)

Open Trading Journal to record private manual linear trades. Enter a symbol,
timeframe, settlement unit (for example USD), LONG/SHORT, actual quantity, prices,
fees, ISO UTC entry/exit timestamps and an entry reason. OPEN has no exit and is
not realized. CLOSED requires exit>=entry. Save explicitly; records support
versioned edits, guarded draft replacement and confirmed deletion. Amounts are
decimal strings with up to8 fractional places, bounded to1e12; no price rounding,
implicit leverage multiplier, inverse-contract model, FX or broker-order execution.

Gross=(exit−entry)×quantity×direction; net=gross−entryFee−exitFee. Both fees are
recognized on exit with the closed trade. Reports select one settlement unit and
an explicit IANA timezone, current/previous/next month or inclusive YYYY-MM-DD
range of1–366days. Daily values include zero days; open counts refer to entries in
the range, not portfolio positions. Concurrent changes require refreshing the
paged report. Notes/entry reason remain private text; no AI quality score yet.

An optional owned dataset must match symbol/timeframe. Its actual candles appear
beside the saved trade on wide screens and below it on narrow screens. Gaps remain
visible; candles do not verify manual fills. Deleting the source preserves the
journal and makes its chart unavailable; unlink/replace it before editing again.

API: GET `/api/journal`, `/api/journal/summary` with `from,to,zone,currency`;
GET `/api/journal/{id}`; POST root/ID with `{requestId,expectedVersion,entry}`;
DELETE ID with `{expectedVersion}`. Unsafe requests require fresh CSRF and
`X-Workspace-User` matching the authenticated account, not a caller-chosen owner.
Missing/mismatched workspace identity returns401 before any journal read/write. Up to
500entries/account,100accepted writes/entry,20default/50max list page; read300 and
write60/account/15min. Source/record IDs never grant access. No dependency added.

On an uncertain save, keep the tab open and retry the same frozen request. Replay
returns its applied version plus the latest current entry, not stale private note
history. After a page reload inspect saved records before issuing a new intent;
request identity is intentionally not persisted in browser storage. Explicit
deletion removes ledger metadata too: do not reuse requests for a deleted entry.
See [design](specs/PB-013/design.md) and [test cases](specs/PB-013/test-cases.md).

## PB-015 — experimental Pine research export

Select a saved **VALIDATED** strategy in Strategy DSL, then open **Pine Script**.
Generate the saved revision to create a private immutable artifact, inspect its
DSL/code SHA256 and generator/schema versions, and copy or download plain `.pine`
source. Unsaved edits are excluded and retained. DRAFT/unsupported input fails
explicitly; the authenticated view never substitutes mock Pine code.

The generated Pine v6 program is a **research indicator with its own closed-bar
simulator**, not native Strategy Tester or live order routing. It preserves the
DSL's intended next-open, stop-first, percentage-cost and sizing formulas instead
of silently mapping to a different broker emulator. It contains no strategy orders,
alerts or external symbol requests. Pine floats and comparison rounding differ
from Python Decimal34; near-threshold signals can diverge. Identical market data
and event-level validation are necessary; historical results never guarantee profit.

**Official Pine compilation/runtime is currently unverified**: TradingView's
anonymous Add to chart requires sign-in. The UI/source explicitly say experimental;
Issue17 cannot be completed based on local Java/Python/source tests. Synthetic
target scripts and the exact remaining procedure are in
[target validation](specs/PB-015/test-evidence/target-validation.md).

Target bounds:16 indicators, period/lag<=200, pivot left/right<=100, warm-up<=4500,
128KiB code and an exact contiguous window of1–5000 closed candles. In Pine inputs,
confirm the chart ticker mapping and set UTC start/end-exclusive (the initial
2024 window is an example). Use a standard chart and matching DSL timeframe;
misaligned dates, incomplete history, gaps, invalid OHLCV or nonstandard candles
are rejected. Native chart data may differ from the platform's imported CSV.

API: GET/POST `/api/strategies/{id}/versions/{revision}/pine`; POST accepts `{}`
only. Both enforce owner/session/expected-account; POST also requires CSRF. A
retry returns the same artifact for that revision/generator even after newer
revisions are saved. Up to100 artifacts/account; existing strategy rates apply
(300 reads/60 writes per15min). Deleting the strategy cascades its artifacts.
V9 adds the artifact table; no existing migration/dependency/stack change.
See [design](specs/PB-015/design.md) and [test cases](specs/PB-015/test-cases.md).

## PB-016 — experimental MQL5 research export

Select a saved VALIDATED strategy, then open MQL5. Generate/reload its private
immutable artifact, inspect revision/DSL/code hashes and versions, then copy or
download `.mq5` text. Unsaved drafts remain unchanged and are not exported. V10
adds the owned artifact table; GET/POST
`/api/strategies/{id}/versions/{revision}/mql5` follows the same account, CSRF,
quota/rate and replay rules as Pine. No existing migration/dependency changed.

This is a **CSV research script**, not a live EA, broker integration or native
Strategy Tester strategy. It never places orders, reads broker prices or loads
DLLs. Put a plain UTF-8 CSV named `research.csv` in the terminal's local
`MQL5/Files` sandbox, compile source with official MetaEditor and explicitly set
ConfirmCsvSymbol/ConfirmCsvTimeframe from the saved DSL before running the script
in an authorized initialized target environment. Input header is exactly
`timestamp,open,high,low,close,volume`; timestamps use UTC `YYYY-MM-DDTHH:mm:ssZ`.
All bars must be closed, aligned and contiguous, at most5000 rows/1MiB. The script
rejects paths/traversal and malformed OHLCV before reporting simulation output.
It does not infer broker timezone or treat tick volume as real volume.

Target limits are16 indicators, period/lag200, pivot sides100, warm-up4500 and
128KiB source. Binary doubles differ from Python Decimal34 and can alter boundary
signals. No broker lots/ticks/margin/funding/liquidation or profit guarantee.
Eight synthetic exports compiled with official MetaEditor with zero errors and
warnings; **actual MQL runtime/event and negative CSV verification remain pending**.
Do not treat local tests/compiler success as runtime certification. See
[target evidence/procedure](specs/PB-016/test-evidence/target-validation.md),
[design](specs/PB-016/design.md) and [test cases](specs/PB-016/test-cases.md).

## PB-024 — private activity and operational audit

Account → Load activity displays your recent authentication, resource changes and
backtest transitions. Metadata only, retained30days; successful reads and anonymous
attempts are not shown. Refresh or load older pages; no edit/delete API. V11 adds
immutable audit events, transactional job triggers and bounded retention. Existing
migrations, algorithm, dependencies and stack remain unchanged.

GET `/api/audit?limit=25&before=<id>` requires current session and matching
X-Workspace-User; limit1..50 and120 reads per15minutes/account. Server request UUIDs
correlate errors, HTTP outcomes and async job transitions. No raw body, query,
headers, credentials, prompts or trade details enter audit rows. Account deletion
cascades its audit rows. Database administrators remain trusted.

HTTP audit failure logs a fixed warning and preserves an already committed result;
job audit failure rolls back the job transition. Public health probes database
and audit reads, not all provider/worker/write permissions. This is a scoped
operational trail, not forensic completeness or a compliance guarantee. See
[operations/retention runbook](docs/operations-audit.md),
[design](specs/PB-024/design.md) and [test cases](specs/PB-024/test-cases.md).

## PB-022 — backtest notification inbox

Backtest → Check notifications retrieves your completion/failure/cancellation
inbox and unread count. Refresh/older pages fetch actual server state; Mark read
persists acknowledgement and Open job uses the existing private result view.
This is an inbox checked on demand, not realtime push, email or external messages.
No notification is invented for jobs already completed before V12 was installed.

V12 creates one notification atomically when a job transitions from queued/running
to terminal. Repeated callbacks do not duplicate it; a retry is a separate job.
If notification persistence fails, the job transaction rolls back and existing
lease recovery applies. Metadata contains only job ID, fixed state/error and
timestamps, never strategy text, prompts, trade data or credentials.

GET `/api/backtests/notifications?limit=25&before=<id>` and POST
`/api/backtests/notifications/{id}/read` (body `{}`) require current account/session;
POST additionally requires CSRF. Existing backtest read300/mutate30 per15minutes
budgets apply. Read acknowledgement is idempotent. Deleted jobs leave their notices
until retention; opening an unavailable job reports an error. Account deletion
cascades notices. Retention hides rows after30days and purges at most5000/minute;
operators monitor cleanup lag/disk as described in the audit runbook. See
[design](specs/PB-022/design.md) and [test cases](specs/PB-022/test-cases.md).
