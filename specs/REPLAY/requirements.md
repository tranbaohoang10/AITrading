Bạn là ASTRA 6.

Repository:

tranbaohoang10/AITrading

Workspace local:

H:\AITrading

==================================================
MASTER MISSION
==================================================

Implement end-to-end kiến trúc:

1. Multi-provider Market Data
2. Redis market cache / realtime state
3. Provider-aware historical coverage
4. Historical Replay Trading
5. Simulated Long / Short
6. Risk % / Risk USD / Quantity / Lot sizing
7. Draggable Entry / SL / TP
8. Replay execution engine
9. Replay → Journal integration
10. Journal Day / Week / Month
11. Numbered pagination
12. Galaxy-purple trading-day indicator
13. Real browser QA
14. Security / concurrency / idempotency
15. CNPM thesis documentation
16. Commit / push / CI verification

Đây là IMPLEMENTATION TASK.

Không chỉ planning.

==================================================
0. CURRENT MAIN IS AUTHORITATIVE
==================================================

Trước mọi thay đổi:

- fetch origin/main
- đọc CURRENT SHA
- git status
- đọc AGENTS.md
- đọc .specify/memory/constitution.md
- đọc docs/governance/**
- đọc docs/agent-skills.md
- đọc current Issues
- đọc current specs
- đọc current tests

Không assume baseline 39b45b6... vẫn là current main.

Plan cũ chỉ là product/architecture input.

CURRENT source wins khi có conflict kỹ thuật,
nhưng Product Owner requirements trong prompt này vẫn phải được đáp ứng.

Không xóa unrelated/untracked files.

==================================================
1. FIXED STACK
==================================================

Frontend:

React
TypeScript
Vite

Backend:

Spring Boot
Java 21

Build:

Gradle Kotlin DSL

Durable DB:

PostgreSQL
Flyway

Cache / ephemeral:

Redis

Python:

chỉ nơi current architecture thực sự dùng,
ví dụ automated backtest/history ingestion tooling.

Không Maven.

Không MongoDB.

Không Redux/Zustand mới nếu không có lý do rõ.

==================================================
2. DATABASE ROLES
==================================================

PostgreSQL là SOURCE OF TRUTH cho:

users
auth identity
strategies
Strategy DSL
strategy versions
automated backtest
replay sessions
replay trades
journal
journal AI review
chat
document metadata
citation provenance
audit
idempotency
write replay

Redis KHÔNG thay PostgreSQL.

Redis chỉ dùng:

cache
current candle
latest quote
provider health
coverage cache
history cache
news/calendar cache
rate limit
quota
locks
optional replay hot state

==================================================
3. KEEP SPRING SESSION JDBC
==================================================

Không chuyển Spring Session sang Redis trong scope này.

Auth/session hiện tại giữ PostgreSQL JDBC.

Redis Session là future issue riêng.

==================================================
==================================================
PART A — MULTI-PROVIDER MARKET DATA
==================================================

==================================================
4. HARD MULTI-PROVIDER RULE
==================================================

Không tìm "one provider for everything".

AITrading phải dùng provider abstraction.

Frontend KHÔNG biết implementation-specific API details.

Backend phải normalize provider data.

Conceptual interface:

MarketDataProvider

capabilities()

searchInstruments()

getInstrument()

getHistoricalCoverage()

getHistoricalCandles()

subscribeRealtime() / stream capabilities

getProviderStatus()

Do not force exact method names
if current repository already has equivalent abstraction.

==================================================
5. PROVIDER CAPABILITY MODEL
==================================================

Create/extend truthful ProviderCapabilities.

At minimum:

providerId

displayName

assetClasses

supportedTimeframes

historical

realtime

delayed

snapshot

eod

bulkHistorical

historicalReplaySupported

symbolSearchSupported

requiresApiKey

requiresEntitlement

displayAllowed

licenseStatus

coverageDiscoveryMode

maxCandlesPerRequest

providerTimezone

notes/limitations

Never infer unsupported capability.

==================================================
6. PROVIDER LEGAL STATUS
==================================================

Each provider must be classified:

ACCEPTED

CONDITIONAL

RESEARCH_ONLY

REJECTED

BLOCKED_LICENSE

Runtime adapters may only be enabled when:

ACCEPTED

or:
CONDITIONAL + required entitlement/config exists.

==================================================
7. PROVIDER AUDIT DOCUMENT
==================================================

Create/update:

docs/market-data/provider-audit.md

Table:

Provider

Repository/API

Asset class

Historical

Intraday

Realtime

History depth

Request quota

Bulk data

API key

Display/license

Status

Reason

Date verified

Official source

Do not rely on aggregator blog posts.

Prefer official docs/terms.

==================================================
==================================================
APPROVED PROVIDER PLAN
==================================================

==================================================
8. COINBASE
==================================================

Role:

CRYPTO REALTIME
+
short/medium historical fallback.

Keep:

Coinbase Exchange public WebSocket.

Historical REST:

max provider request size according current official docs.

Do not poll REST for realtime.

Truthful label:

COINBASE · PUBLIC · REALTIME

when actually live.

==================================================
9. BINANCE PUBLIC DATA
==================================================

Repository:

binance/binance-public-data

Official Binance repository.

Use primarily for:

CRYPTO HISTORICAL

Spot

USD-M Futures

COIN-M Futures

Support bulk archived kline data.

Do not fake Binance source as Coinbase.

Examples:

BTC/USDT · BINANCE · HISTORICAL

not:

BTC/USD · COINBASE

unless data is actually Coinbase.

==================================================
10. BINANCE INGESTION
==================================================

Do NOT put giant ZIP/CSV directly into Redis.

Pipeline:

Binance Public Data
↓
download bounded daily/monthly archive
↓
checksum verify
↓
stream parse
↓
normalize Candle
↓
historical storage/cache strategy
↓
Redis hot window
↓
Replay.

Evaluate whether Phase 1 should:

A.
read bulk data on demand + Redis cache

or

B.
persist selected Replay ranges/history in PostgreSQL/object storage.

Do not create an uncontrolled full-market database.

==================================================
11. FRANKFURTER
==================================================

Repository:

lineofflight/frankfurter

Use:

FOREX REFERENCE / EOD.

Frankfurter v2 is multi-provider reference-rate data.

Can use public endpoint
or self-host.

Prefer self-host option if repeated historical use
would benefit the thesis architecture.

Important:

Frankfurter is DAILY REFERENCE RATE.

Do NOT call:

1m
5m
15m
realtime Forex candles.

Replay support:

DAILY replay may be possible only if product semantics
are explicitly designed for reference-rate data.

For intraday Replay:

UNSUPPORTED.

==================================================
12. ALPACA
==================================================

Use when credentials/configuration exist.

Role:

US STOCKS

ETFs

Crypto secondary.

Free Basic limitations must be represented honestly.

Stocks:

historical since provider-supported range

free realtime:
IEX only.

Label:

ALPACA · IEX

not:

NASDAQ realtime
or
FULL MARKET.

==================================================
13. FRED
==================================================

Use for:

MACRO / ECONOMIC SERIES

Examples:

interest rates

CPI

GDP

Treasury yields

economic observations.

Do NOT treat FRED observations as exchange candles.

FRED cannot be selected as normal Replay Trading candle provider
unless a specific time-series visualization supports it.

Keep separate asset/data type:

MACRO.

==================================================
14. ALPHA VANTAGE
==================================================

Status:

CONDITIONAL.

Use only after current official docs
and actual key entitlement are checked.

Potential use:

global equity daily

FX daily

commodities

metal history

secondary coverage.

If verified educational/open-source entitlement
provides higher request quota,
record evidence.

Do NOT assume:

realtime free

intraday free

25-year full output free.

If endpoint says premium:

disable it.

==================================================
==================================================
RESEARCH-ONLY REPOSITORIES
==================================================

==================================================
15. OPENBB
==================================================

Repository:

OpenBB-finance/OpenBB

Use as:

architecture/provider registry/reference.

Study:

multi-provider contracts

provider normalization

provider selection

capability exposure.

Do NOT blindly copy AGPL code into AITrading.

Do NOT add OpenBB Python service
unless architecture/licensing analysis proves it worthwhile.

Default:

REFERENCE ONLY.

==================================================
16. AKSHARE
==================================================

Repository:

akfamily/akshare

Potentially broad:

stocks
funds
bonds
futures
FX
macro
etc.

But:

data interfaces rely on multiple upstream sources

project states academic research purpose

interfaces may disappear.

Therefore:

RESEARCH_ONLY by default.

Do NOT enable user-facing runtime market provider
until each exact upstream interface's:

terms

stability

display rights

rate behavior

are audited.

==================================================
17. FINANCEDATAREADER
==================================================

Repository:

FinanceData/FinanceDataReader

Broad data support:

global stocks
indices
FX
crypto
futures/commodities
bonds

but it is explicitly a financial data reader/crawler
and several routes rely on third-party sources.

Therefore:

RESEARCH_ONLY.

Can use to:

compare results

prototype symbol mapping

discover coverage

not as default production runtime feed.

==================================================
18. DUKASCOPY DOWNLOADERS
==================================================

Potential repos:

aymanfouda/dukascopy-data-downloader

saleem-latif/duka-data

others.

They demonstrate access to:

FX

metals

indices CFDs

stock CFDs

intraday/ticks.

BUT:

do NOT integrate them in runtime
until official Dukascopy written permission/license
explicitly allows the intended automated use/display/storage.

Current official terms must be reviewed.

Status by default:

BLOCKED_LICENSE.

No scraping workaround.

==================================================
19. REJECT UNSAFE PROVIDERS
==================================================

Do not implement runtime data from:

tvdatafeed

TradingView scraping

Yahoo Finance scraping

unofficial hidden endpoints

Investing.com scraping

ForexFactory scraping

arbitrary broker website scraping.

Do not bypass anti-bot controls.

==================================================
20. CURRENT FREE PROVIDER LIMITATIONS
==================================================

Audit and likely reject/default-disable:

Twelve Data free:
internal/non-display limitations

Tiingo free:
internal-use-only limitations

EODHD free:
very limited personal-use calls

Marketstack free:
very limited EOD quota/history

unless current official terms have changed.

==================================================
==================================================
PART B — PROVIDER ROUTING
==================================================

==================================================
21. ASSET ROUTING FIRST TARGET
==================================================

Preferred first routing:

CRYPTO realtime:
Coinbase

CRYPTO deep historical:
Binance Public Data

CRYPTO secondary:
Alpaca if configured

STOCK / ETF:
Alpaca

FOREX reference EOD:
Frankfurter

MACRO:
FRED

GLOBAL daily fallback:
Alpha Vantage if entitlement permits.

==================================================
22. NO SILENT CROSS-PROVIDER STITCHING
==================================================

HARD RULE.

A single Replay Session must lock:

provider

symbol

timeframe

source provenance.

Do NOT create:

first 20 days Binance
+
last 10 days Coinbase

inside one Replay session
without explicit product design.

Different providers have different:

prices

volume

session rules

symbol semantics

spread

liquidity.

==================================================
23. PROVIDER SWITCH UX
==================================================

Symbol/Replay UI may show:

Data source.

Example:

BTC/USDT
Binance Historical

BTC/USD
Coinbase Public

AAPL
Alpaca IEX

EUR/USD
Frankfurter EOD

Always truthful.

==================================================
24. CANONICAL INSTRUMENT MODEL
==================================================

Design/extend normalized Instrument:

instrumentId

displaySymbol

providerSymbol

provider

assetClass

base

quote

exchange

currency

market

timezone

priceIncrement

quantityIncrement

quantityPrecision

minQuantity

minNotional

sizeUnit

contractSize

pointValue

lotSize

sizingStatus

supportedModes

supportedTimeframes

historyCoverageStatus.

==================================================
25. SYMBOL IDENTITY
==================================================

Never assume:

BTC/USD Coinbase
=
BTC/USDT Binance.

Use distinct provider instruments.

Canonical display layer can group similar assets
but execution/history provenance remains provider-specific.

==================================================
==================================================
PART C — HISTORICAL COVERAGE
==================================================

==================================================
26. EXTEND CURRENT SOL PLAN
==================================================

The previous plan restricted Replay MVP to Coinbase.

This requirement changes that.

Replay architecture must be MULTI-PROVIDER READY NOW.

At least two genuinely usable historical providers
must be demonstrated if possible:

1.
Coinbase/Binance for crypto

2.
Alpaca for stocks/ETF
or another legally accepted provider.

Frankfurter can demonstrate EOD Forex coverage
but should not be counted as intraday Replay.

==================================================
27. HISTORICAL COVERAGE CONTRACT
==================================================

HistoricalCoverage:

provider

instrument

timeframe

status

earliestAvailableUtc

latestAvailableUtc

verifiedFromUtc

verifiedThroughUtc

checkedAt

maxCandlesPerRequest

bulkAvailable

limitations.

Statuses:

KNOWN

PROBED

PARTIAL

UNKNOWN

UNSUPPORTED.

==================================================
28. COVERAGE IS PROVIDER SPECIFIC
==================================================

Example:

BTC/USDT Binance 1m
may have one coverage.

BTC/USD Coinbase 1m
another.

AAPL Alpaca 1m
another.

EUR/USD Frankfurter 1d
another.

No global "earliest chart date".

==================================================
29. COVERAGE UI
==================================================

Replay Start Dialog:

Provider

Symbol

Timeframe

Available history

Start date

Optional End date.

Date picker disables unsupported dates.

If exact earliest date unknown:

do not invent.

Show:

Coverage checking...

or:

Historical coverage partially verified.

==================================================
30. BULK HISTORY VS API HISTORY
==================================================

Provider abstraction must distinguish:

REST_PAGED

BULK_ARCHIVE

SELF_HOSTED_REFERENCE

etc.

Binance archive should not be forced
through a fake 300-candle endpoint model.

==================================================
==================================================
PART D — REDIS
==================================================

==================================================
31. REDIS ROLE
==================================================

Use:

Spring Data Redis

Lettuce

PostgreSQL authoritative.

Redis optional/degradable.

Frontend never connects Redis.

==================================================
32. REDIS REALTIME PIPELINE
==================================================

Target:

Provider WebSocket
↓
Spring Boot provider stream
↓
OHLC aggregator
↓
Redis current bar/latest state
↓
AITrading stream
↓
React CandleChart.

Current direct browser Coinbase WebSocket
may be migrated only after parity tests prove backend stream.

==================================================
33. STREAM PROTOCOL
==================================================

Reuse current technology if appropriate.

SSE is acceptable for server → browser market updates.

WebSocket is also acceptable
if current architecture already supports clean backend WebSocket.

Choose based on CURRENT code.

Do not add both merely for complexity.

Events conceptually:

snapshot

candle

status

heartbeat.

==================================================
34. REDIS KEY NAMESPACE
==================================================

Use versioned provider-aware keys.

Examples:

aitrading:v1:market:catalog:<provider>

aitrading:v1:market:instrument:<provider>:<symbol>

aitrading:v1:market:latest:<provider>:<symbol>

aitrading:v1:market:bar:<provider>:<symbol>:<timeframe>

aitrading:v1:market:history:<provider>:<symbol>:<tf>:<rangeHash>

aitrading:v1:market:coverage:<provider>:<symbol>:<tf>

aitrading:v1:provider:health:<provider>

aitrading:v1:provider:last-event:<provider>:<symbol>

aitrading:v1:quota:<provider>:<window>

aitrading:v1:ratelimit:<purpose>:<opaqueUser>:<window>

aitrading:v1:lock:history:<provider>:<rangeHash>

aitrading:v1:replay:<sessionId>:state

No raw email/user identifiers.

==================================================
35. TTL
==================================================

Use prior SOL plan as starting point:

catalog:
~5m

latest quote:
~15s

current bar:
max(2 × timeframe, 120s), bounded

recent history:
45s–60m depending timeframe

closed historical archive:
6–24h

coverage success:
~6h

coverage negative/unknown:
~5m

provider health:
~30s

news:
~20m

calendar:
~10m

lock:
~10s

replay hot state:
~30m sliding.

But audit actual provider behavior
and adjust if justified.

==================================================
36. BINANCE BULK CACHE
==================================================

Do not store whole monthly ZIP in Redis.

Use Redis for:

hot parsed candle windows

download status

coverage result

short lock.

Raw archive can be:

temporary filesystem

bounded persistent historical store

or future object storage

depending actual implementation plan.

==================================================
37. REDIS FAILURE
==================================================

If Redis down:

application should enter DEGRADED
for non-security cache features.

Use:

provider direct fetch
+
local singleflight

where safe.

Do not corrupt PostgreSQL.

Do not generate fake market data.

==================================================
==================================================
PART E — REPLAY TRADING
==================================================

==================================================
38. DOMAIN SEPARATION
==================================================

Keep separate:

Automated Backtest

Replay Trading

Paper/Broker Trading.

Automated Backtest remains current Strategy DSL engine.

Replay:

user manually trades historical prefix.

Broker/live:
deferred.

==================================================
39. NO LOOKAHEAD
==================================================

Backend MUST NOT expose future candles
during Replay.

Not merely CSS hidden.

Future indicators
future crosshair
future AI context

must be unavailable.

Backend prefetch allowed,
but payload only revealed prefix.

==================================================
40. REPLAY SESSION
==================================================

Persist:

provider

provider instrument

symbol

timeframe

requestedStart

optionalEnd

currentCursor

initialBalance

currentBalance

currency

commission

slippage

ambiguity policy

instrument metadata snapshot

status

version.

==================================================
41. REPLAY UI
==================================================

Toolbar:

Replay

Previous/Step as applicable

Play/Pause

Step Forward

Speed

Go To

Long

Short

Open Position

Balance

Equity

End Replay.

==================================================
==================================================
PART F — POSITION SIZING
==================================================

==================================================
42. MODES
==================================================

Support:

Risk %

Risk USD/account currency

Manual Quantity

Lot only when instrument metadata supports it.

==================================================
43. ACCOUNT BALANCE
==================================================

At Replay creation:

Initial capital

example:
10,000 USD.

Display:

Starting Balance

Current Balance

Equity

Realized P&L

Open P&L.

Clearly:

SIMULATION.

==================================================
44. LOT SEMANTICS
==================================================

Never label universal quantity as lot.

Crypto:
base quantity.

Stocks:
shares.

Forex:
lot only if actual contract metadata exists.

Futures:
contracts only if actual contract metadata exists.

If unknown:

quantity only.

==================================================
45. RISK %
==================================================

riskAmount =
balance × riskPercent / 100.

Previous SOL suggestion:

default 1%

max 10%

Re-evaluate whether 10% is a product validation maximum
or only warning threshold.

Do not silently constrain without spec.

==================================================
46. RISK USD
==================================================

User enters:

100 USD

for example.

Derived:

% balance

quantity

potential stop loss.

==================================================
47. MANUAL SIZE
==================================================

User enters quantity/lot.

System calculates:

risk USD

risk %

reward USD

reward %

R:R.

==================================================
48. FRONTEND PREVIEW / BACKEND AUTHORITY
==================================================

Dragging uses frontend deterministic preview.

Confirm uses backend BigDecimal recomputation.

Frontend values are never authoritative.

==================================================
==================================================
PART G — ENTRY / SL / TP
==================================================

==================================================
49. CHART OVERLAY
==================================================

Position overlay:

Entry

Stop Loss

Take Profit

profit zone

loss zone

handles

compact stats.

==================================================
50. LONG
==================================================

SL < Entry < TP.

==================================================
51. SHORT
==================================================

TP < Entry < SL.

==================================================
52. DRAG
==================================================

Before confirm:

Entry
SL
TP

all draggable locally.

Recalculate immediately.

No HTTP request per pixel.

==================================================
53. AFTER CONFIRM
==================================================

Entry becomes locked.

SL/TP can be changed if product permits.

Send one PATCH on pointer-up.

Use:

expectedVersion

requestId/idempotency where appropriate.

==================================================
54. TARGET INPUT
==================================================

Support clear TP modes:

Price

USD

Account %

R multiple

while storing normalized target price.

Do not expose a confusing 20-field ticket.

==================================================
==================================================
PART H — EXECUTION
==================================================

==================================================
55. FIRST SCOPE
==================================================

Simulated market order only.

No real broker order.

No Limit/Stop order in first phase.

==================================================
56. FILL
==================================================

Use deterministic no-lookahead fill policy.

Previous plan suggests:

Confirm
→ PENDING_ENTRY
→ fill on next revealed candle OPEN

with adverse slippage.

Validate this against current backtest conventions.

Document exact rule.

==================================================
57. GAP
==================================================

Handle gap through:

Entry

SL

TP.

No perfect fictional fill.

==================================================
58. INTRABAR BOTH TOUCHED
==================================================

If one OHLC candle touches both SL and TP:

OHLC does not tell order.

Never choose TP because it improves result.

Default first scope:

STOP_FIRST_CONSERVATIVE

and store:

BOTH_TOUCHED

STOP_FIRST.

Display warning.

==================================================
59. MANUAL CLOSE
==================================================

Allow user to close position
at current executable Replay price.

Exit reason:

MANUAL

SL

TP

END_OF_REPLAY

as applicable.

==================================================
==================================================
PART I — POSTGRESQL / JOURNAL
==================================================

==================================================
60. REPLAY TABLES
==================================================

Use append-only Flyway migration.

Design minimal normalized:

replay_session

replay_trade

replay_command/idempotency

and necessary indexes.

==================================================
61. JOURNAL SOURCE
==================================================

Journal entry should support:

MANUAL

REPLAY

future:
BROKER_IMPORT.

Replay-generated execution fields:

read-only.

Review fields:

editable.

==================================================
62. CLOSE TRANSACTION
==================================================

Closing Replay trade should atomically:

close replay trade

compute realized P&L

update replay balance

create/update Journal projection exactly once

persist provenance

persist idempotency result.

==================================================
63. PROVENANCE
==================================================

Journal Trade Detail:

Source:
Replay Trading

Provider

Provider instrument

Timeframe

Replay session

Simulation:
Yes.

==================================================
64. PROVIDER HISTORY MAY DISAPPEAR
==================================================

Do NOT delete Journal entry.

If chart data unavailable:

show:

Historical chart data is unavailable from the current provider.

Keep execution facts.

==================================================
==================================================
PART J — JOURNAL UX
==================================================

==================================================
65. MAIN TABS
==================================================

Overview

Trades

AI Review.

Actually separate views.

==================================================
66. PERIOD
==================================================

Day

Week

Month.

==================================================
67. MONTH
==================================================

Real Monday–Sunday calendar.

35/42 cells.

Correct weekday placement.

Each day:

date

net P&L

closed count.

Weekly P&L summary where appropriate.

==================================================
68. GALAXY RIM
==================================================

Day with closed trading activity:

subtle purple/violet galaxy luminous border.

Purpose:

activity

NOT profit/loss.

Profit P&L:
green.

Loss:
red.

Breakeven:
neutral
+
weaker violet activity ring.

No trade:
no glow.

Do not create giant neon purple cards.

Respect prefers-reduced-motion.

Prefer no continuous animation.

==================================================
69. DAY VIEW
==================================================

Daily summary.

Chronological trades.

P&L.

wins/losses/breakeven.

Daily note.

Cumulative realized P&L only when computed from real trades.

==================================================
70. WEEK
==================================================

7-day professional layout.

Weekly metrics.

Click day → Day detail.

==================================================
71. TRADES
==================================================

Filters:

date

symbol

side

state

source

Replay session.

Numbered pagination:

Previous

1

2

3

...

Next.

Page size:

10 / 20 / 50.

Server-side totals.

==================================================
72. TRADE DETAIL
==================================================

Execution section.

Entry

Exit

Quantity

fees

SL

TP

P&L

Chart context

Provenance

Review notes

AI Review

Ambiguity warning where applicable.

==================================================
73. CHART MARKERS
==================================================

When history exists:

show semantic:

Entry

Exit

SL

TP.

Do not replace saved historical context
with current live price.

==================================================
==================================================
PART K — EXTERNAL PRODUCT RESEARCH
==================================================

==================================================
74. RESEARCH BEFORE UI IMPLEMENTATION
==================================================

Inspect current official UX/docs from:

TradingView

TradeZella

TraderSync

TradesViz

Edgewonk

OpenBB

Only learn:

workflow

information hierarchy

interaction.

Do not copy code/assets.

Record findings in Issue/spec.

==================================================
==================================================
PART L — PROVIDER QA
==================================================

==================================================
75. QA-01 PROVIDER CAPABILITY MATRIX
==================================================

Automated test verifies each enabled provider
reports truthful capabilities.

A provider marked realtime
must have real realtime transport.

A provider marked intraday Replay
must have actual candle history.

==================================================
76. QA-02 LABEL TRUTHFULNESS
==================================================

Test:

Binance data cannot render
COINBASE badge.

Alpaca IEX cannot render
NASDAQ FULL MARKET.

Frankfurter cannot render
REALTIME.

==================================================
77. QA-03 PROVIDER ISOLATION
==================================================

Redis keys for:

BTC/USD Coinbase

BTC/USDT Binance

must never collide.

==================================================
78. QA-04 SYMBOL NORMALIZATION
==================================================

Test:

same display asset
different provider symbol

remains distinct internally.

==================================================
79. QA-05 COVERAGE
==================================================

For every enabled Replay provider:

valid range accepted

before earliest verified date rejected

future date rejected

unknown coverage handled honestly.

==================================================
80. QA-06 HISTORICAL PAGING
==================================================

Coinbase:
provider-limit chunking.

Binance:
bulk archive chunk/download.

Alpaca:
pagination/token behavior.

No missing/duplicate candle across boundaries.

==================================================
81. QA-07 DATA ORDER
==================================================

All normalized candles:

strict UTC timestamps

ascending order

deduped.

No duplicate bucket.

==================================================
82. QA-08 GAP POLICY
==================================================

Missing provider candle:

do not synthesize fake OHLC.

Represent gap.

==================================================
83. QA-09 PROVIDER FALLBACK
==================================================

Do not silently fallback to another provider
inside active Replay.

If active provider unavailable:

pause / DATA_UNAVAILABLE.

User explicitly chooses alternative data source.

==================================================
==================================================
PART M — REDIS QA
==================================================

==================================================
84. QA-10 REDIS MISS/HIT
==================================================

First identical history request:

MISS.

Second:

HIT.

Verify provider call count.

==================================================
85. QA-11 REDIS OFF
==================================================

Stop Redis.

Verify:

application remains usable in DEGRADED mode
where policy allows.

No corrupted trade.

==================================================
86. QA-12 MALFORMED CACHE
==================================================

Insert malformed cached payload.

Application rejects it safely
and refreshes/fails.

No crash/XSS.

==================================================
87. QA-13 LOCK
==================================================

Concurrent same-range cache miss:

only one external refresh
where lock/singleflight should apply.

==================================================
88. QA-14 TTL
==================================================

Expiry triggers refresh.

No stale forever.

==================================================
89. QA-15 REALTIME CURRENT CANDLE
==================================================

Coinbase live.

Observe WebSocket/provider stream.

Verify Redis current bar:

open

high

low

close

volume

bucketStart

lastEventAt

changes from real events.

==================================================
90. QA-16 REALTIME RECOVERY
==================================================

Disconnect provider connection.

Status:

LIVE
→ RECONNECTING/DELAYED/DISCONNECTED

as actual.

Reconnect.

Snapshot reconcile.

No duplicate candle.

==================================================
==================================================
PART N — REPLAY QA
==================================================

==================================================
91. QA-17 NO LOOKAHEAD
==================================================

Critical.

Replay at candle N.

Frontend/API must not expose candle N+1.

Change all future candles in fixture.

Current state must remain identical.

==================================================
92. QA-18 INDICATOR NO LOOKAHEAD
==================================================

Indicator at cursor N
only uses <= N.

==================================================
93. QA-19 LONG RISK %
==================================================

Known deterministic scenario.

Balance:

10,000 USD.

Risk:
1%.

Backend expected risk amount:

100 USD

before fees/slippage adjustments.

Verify derived quantity.

==================================================
94. QA-20 LONG RISK USD
==================================================

Risk:

100 USD.

Verify:

derived %

quantity

SL loss.

==================================================
95. QA-21 MANUAL QUANTITY
==================================================

Enter quantity.

Verify:

risk %

risk USD

reward

R:R.

==================================================
96. QA-22 SHORT
==================================================

Repeat risk math for SHORT.

==================================================
97. QA-23 INVALID LEVELS
==================================================

LONG:

SL >= Entry rejected.

TP <= Entry rejected.

SHORT inverse.

==================================================
98. QA-24 DRAG
==================================================

Drag SL and TP.

Stats update during pointer movement.

No network request storm.

One persistence call on pointer-up after confirm.

==================================================
99. QA-25 BOTH TOUCHED
==================================================

Fixture candle touches SL and TP.

Expected:

STOP_FIRST_CONSERVATIVE

BOTH_TOUCHED warning.

Never optimistic TP-first.

==================================================
100. QA-26 GAP STOP
==================================================

Gap beyond stop.

Fill uses documented gap rule,
not ideal stop price.

==================================================
101. QA-27 DOUBLE CONFIRM
==================================================

Two identical Confirm requests.

Exactly one replay trade.

==================================================
102. QA-28 STALE VERSION
==================================================

Concurrent browser tab modifies position.

Stale expectedVersion:

409.

No silent overwrite.

==================================================
==================================================
PART O — JOURNAL QA
==================================================

==================================================
103. QA-29 AUTO JOURNAL
==================================================

Replay closes.

Journal entry appears exactly once.

==================================================
104. QA-30 PROVENANCE
==================================================

Verify:

source=REPLAY

provider

session

simulation flag.

==================================================
105. QA-31 EXECUTION READ-ONLY
==================================================

Replay-generated trade:

cannot rewrite executed price/qty
through normal Journal editing.

Notes/reason remain editable.

==================================================
106. QA-32 MONTH CALENDAR
==================================================

Verify real weekday placement.

Leap year.

Month starting Sunday/Monday.

35/42 cell layout.

==================================================
107. QA-33 GALAXY PROFIT
==================================================

Closed profitable day:

purple activity rim

green P&L.

==================================================
108. QA-34 GALAXY LOSS
==================================================

Closed losing day:

same purple activity rim

red P&L.

==================================================
109. QA-35 BREAKEVEN
==================================================

Closed zero-net day:

weaker violet activity indicator

neutral P&L.

==================================================
110. QA-36 EMPTY DAY
==================================================

No trade:

no galaxy rim.

==================================================
111. QA-37 PAGINATION
==================================================

Seed synthetic:

65 Journal trades.

Page size:
20.

Verify:

Page 1

Page 2

Page 3

Page 4

Previous

Next

stable no duplicates.

==================================================
112. QA-38 FILTERS
==================================================

Test server-side:

symbol

side

state

source

Replay session

date period.

Changing filter resets page 1.

==================================================
==================================================
PART P — SECURITY QA
==================================================

==================================================
113. QA-39 OWNER ISOLATION
==================================================

Account A cannot access:

Replay Session B

Replay Trade B

Journal B

Redis-private cache B.

==================================================
114. QA-40 CSRF
==================================================

All unsafe authenticated mutations:

CSRF protected.

==================================================
115. QA-41 IDOR/BOLA
==================================================

UUID substitution fails safely.

==================================================
116. QA-42 REDIS KEY INJECTION
==================================================

Untrusted:

symbol

provider

user identity

cannot escape key namespace.

==================================================
117. QA-43 SECRET LEAK
==================================================

API keys:

not in:

frontend bundle

logs

Redis values

Git history.

==================================================
118. QA-44 EXTERNAL RESPONSE
==================================================

Provider malformed JSON/CSV:

validated/bounded.

No arbitrary HTML execution.

==================================================
==================================================
PART Q — PERFORMANCE QA
==================================================

==================================================
119. QA-45 CHART RENDER
==================================================

Realtime candle updates
do not remount entire workspace.

==================================================
120. QA-46 CLOCK
==================================================

1-second clock
does not rerender 20k candle dataset.

==================================================
121. QA-47 REPLAY
==================================================

Step does not download entire history every time.

Use window/prefetch/cache.

==================================================
122. QA-48 BINANCE ARCHIVE
==================================================

Large archive parsed streaming/chunked.

No unbounded memory read.

==================================================
123. QA-49 MULTI-CLIENT
==================================================

Two clients requesting same hot history:

external provider request count remains bounded
through Redis/singleflight.

==================================================
==================================================
PART R — BROWSER QA
==================================================

==================================================
124. REAL BROWSER QA REQUIRED
==================================================

Use synthetic accounts only.

Run actual local app.

Capture screenshots/network evidence.

Widths:

1440

1024

390.

==================================================
125. E2E SCENARIO A — CRYPTO
==================================================

Provider:

Binance historical
or Coinbase depending capability.

1.
Open BTC instrument.

2.
Open Replay.

3.
Choose valid date ~1 month ago.

4.
Verify provider badge.

5.
Verify future hidden.

6.
Initial balance 10,000 USD.

7.
Long.

8.
Risk 1%.

9.
Drag SL.

10.
Drag TP.

11.
Verify:
risk USD
reward USD
quantity
R:R.

12.
Confirm.

13.
Advance.

14.
Close via SL/TP/manual.

15.
Open Journal.

16.
Verify purple activity rim.

17.
Open Day.

18.
Trade Detail.

19.
Verify provider provenance and markers.

==================================================
126. E2E SCENARIO B — SHORT
==================================================

Repeat with Short.

==================================================
127. E2E SCENARIO C — STOCK
==================================================

If Alpaca configured:

AAPL
1m or supported timeframe.

Verify:

provider = ALPACA

feed = IEX where applicable.

Start historical Replay.

One simulated trade.

Journal provenance.

If entitlement unavailable:

mark BLOCKED_EXTERNAL,
do not fake PASS.

==================================================
128. E2E SCENARIO D — FOREX
==================================================

EUR/USD Frankfurter.

Verify:

EOD/reference only.

No intraday Replay offered.

No LIVE badge.

If daily Replay is not implemented:
UI explicitly reports unsupported.

==================================================
129. E2E SCENARIO E — REDIS DOWN
==================================================

Start app with Redis.

Warm history cache.

Stop Redis.

Verify:

DEGRADED

core persistent app survives.

No lost Journal data.

==================================================
==================================================
PART S — REGRESSION
==================================================

==================================================
130. MUST NOT BREAK
==================================================

Assistant

auth

Symbol Search

Forex flags

timezone

current realtime chart

drawings

ordinary Long/Short drawing tool

indicators

multi-chart

automated Strategy Backtest

Pine export

MQL5 export

manual Journal

Library/RAG

Image Analysis

Market Intelligence.

==================================================
131. FULL TESTS
==================================================

Run:

targeted frontend tests

full frontend tests

npm run lint

npm run build

targeted backend tests

full Gradle test

Gradle build

Redis integration tests

security/dependency checks

git diff --check

current repo-specific CI checks.

Do not weaken tests to PASS.

==================================================
==================================================
PART T — DOCUMENTATION / ISSUES
==================================================

==================================================
132. ISSUE SPLIT
==================================================

Reconcile existing Issues first.

Recommended scopes:

Issue A:
Multi-provider Market Data và provider audit

Issue B:
Redis cache và backend realtime market stream

Issue C:
Historical Replay và coverage

Issue D:
Risk sizing và simulated Long/Short

Issue E:
Replay → Journal

Issue F:
Journal UX / daily note / galaxy / QA

Do not create duplicate Issues
if equivalent existing Issue exists.

==================================================
133. THESIS ARTIFACTS
==================================================

For each main feature:

Use Case

Use Case Description

Sequence Diagram

related Class Diagram

ERD impact

Test Cases

Security requirements.

==================================================
134. COMMIT RULES
==================================================

Vietnamese with diacritics.

Examples:

feat(market): mở rộng kiến trúc dữ liệu đa nhà cung cấp

Refs #...

feat(cache): tích hợp Redis cho dữ liệu thị trường thời gian thực

Refs #...

feat(replay): hoàn thiện giao dịch mô phỏng trên dữ liệu lịch sử

Refs #...

feat(risk): hoàn thiện quản lý vốn và SL TP mô phỏng

Refs #...

feat(journal): đồng bộ Replay và hoàn thiện nhật ký giao dịch

Refs #...

No force push.

==================================================
135. DELIVERY ORDER
==================================================

Do NOT big-bang blindly.

Recommended:

PHASE 0
Current audit + provider/legal audit + baseline tests.

PHASE 1
Provider capability abstraction.

PHASE 2
Redis infrastructure.

PHASE 3
Historical coverage and multi-provider history.

PHASE 4
Realtime backend stream parity.

PHASE 5
Replay persistence/no-lookahead.

PHASE 6
Position sizing/Entry/SL/TP.

PHASE 7
Execution engine.

PHASE 8
Journal integration.

PHASE 9
Journal UX.

PHASE 10
Security/performance/browser QA/full regression.

Commit/push per stable Issue scope.

==================================================
==================================================
DEFINITION OF DONE
==================================================

==================================================
136. MULTI-PROVIDER DONE
==================================================

[ ] provider audit exists

[ ] legal status classified

[ ] provider capabilities truthful

[ ] Coinbase works

[ ] Binance historical works

[ ] Frankfurter truthful EOD works

[ ] Alpaca works when configured or exact external blocker documented

[ ] no unsafe scraping provider enabled

[ ] provider labels truthful

[ ] no silent data stitching

[ ] coverage provider-specific

==================================================
137. REDIS DONE
==================================================

[ ] Redis infrastructure

[ ] market catalog cache

[ ] history hot cache

[ ] coverage cache

[ ] current candle state

[ ] provider health

[ ] lock/singleflight

[ ] Redis-down degradation

[ ] no Spring Session migration

[ ] no frontend Redis

==================================================
138. REPLAY DONE
==================================================

[ ] provider selectable

[ ] provider-aware historical range

[ ] no-lookahead

[ ] play/pause/step

[ ] Long

[ ] Short

[ ] account balance

[ ] Risk %

[ ] Risk USD

[ ] manual quantity

[ ] lot only when valid metadata exists

[ ] draggable Entry

[ ] draggable SL

[ ] draggable TP

[ ] backend authoritative math

[ ] simulated confirm

[ ] deterministic fill

[ ] SL trigger

[ ] TP trigger

[ ] manual close

[ ] gap handling

[ ] ambiguity conservative

[ ] persistence/resume

==================================================
139. JOURNAL DONE
==================================================

[ ] Replay auto-recorded

[ ] no duplicates

[ ] provenance

[ ] execution read-only

[ ] Day

[ ] Week

[ ] Month

[ ] true calendar

[ ] numbered pagination

[ ] filters

[ ] daily note

[ ] entry/exit/SL/TP markers

[ ] galaxy activity rim

[ ] profit green

[ ] loss red

[ ] breakeven defined

[ ] provider-history-unavailable state

==================================================
140. QA DONE
==================================================

[ ] all QA-01 through QA-49 executed

[ ] frontend full PASS

[ ] backend full PASS

[ ] Redis tests PASS

[ ] security PASS

[ ] browser 1440 PASS

[ ] browser 1024 PASS

[ ] browser 390 PASS

[ ] crypto Replay E2E PASS

[ ] Short E2E PASS

[ ] stock provider tested or externally blocked with evidence

[ ] FX EOD behavior verified

[ ] Redis down verified

[ ] CI PASS

==================================================
==================================================
FINAL REPORT
==================================================

==================================================
141. RETURN EXACTLY
==================================================

# AITrading Multi-Provider Replay Delivery

## Repository
Start SHA:
Final SHA:
Branch:
Working tree:

## Provider audit

| Provider | Asset | History | Realtime | Replay | License/status | Result |
| --- | --- | --- | --- | --- | --- | --- |

## Repositories evaluated

OpenBB

Binance Public Data

Frankfurter

AKShare

FinanceDataReader

Dukascopy candidates

For each:
USED / REFERENCE / RESEARCH_ONLY / REJECTED / BLOCKED_LICENSE.

## Multi-provider architecture

## Redis architecture

## Realtime candle evidence

## Historical coverage

## Replay Trading

## Position sizing

## Entry / SL / TP

## Execution assumptions

## Intrabar ambiguity

## Journal integration

## Journal UX

## Database/Flyway

## Security

## Performance

## QA scorecard

List QA-01 through QA-49:

PASS

FAIL

BLOCKED_EXTERNAL

with evidence.

## Browser QA

### 1440

### 1024

### 390

## Tests
commands
exit codes
counts

## Issues

## Commits

## CI

## Remaining external limitations

## Deferred

## Final Status

DONE

or:

HARD BLOCKER: ...

==================================================
142. HARD RULES
==================================================

DO NOT:

fake market data

fake realtime

fake candles

fake provider coverage

fake lot semantics

mix provider data silently

scrape TradingView

scrape Yahoo

scrape ForexFactory

scrape Investing.com

use Dukascopy automation without proper legal approval

label Frankfurter realtime

label Alpaca IEX full US market

store durable trades only in Redis

connect React to Redis

move Spring Session to Redis

expose provider secrets

use future candles in Replay

optimistically choose TP when SL and TP
touch same OHLC candle

place real broker orders

mark BLOCKED_EXTERNAL tests as PASS.

Begin from CURRENT origin/main.