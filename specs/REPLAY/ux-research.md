# Workflow research

06/09/2026. Refs #43, #46. Original UI/code/assets only.

| Official source inspected | Relevant workflow inference for AITrading |
| --- | --- |
| [TradingView Bar Replay](https://www.tradingview.com/support/solutions/43000712747-bar-replay-how-and-why-to-test-a-strategy-in-the-past/) | separate historical mode, chosen start and step/play controls; retain visible mode identity |
| [TraderSync simulator](https://tradersync.com/market-replay-simulator/) | practice workflow links historical chart interaction to trade review |
| [TradesViz](https://www.tradesviz.com/) | keep trading journal analytics and replay context discoverable from individual trades |
| [Edgewonk](https://edgewonk.com/) | review notes and process improvement belong beside execution facts, not in editable execution inputs |
| [OpenBB](https://github.com/OpenBB-finance/OpenBB) | normalized provider data shared across presentation surfaces; no AGPL code copied |
| TradeZella feature URL | retrieval failed; further official documentation lookup pending, no unsupported findings asserted |

Design inference: one compact ticket with sizing mode and normalized target mode;
chart handles provide fast local preview; explicit Confirm enters simulation.
Journal activity border communicates activity independently of red/green P&L.
Replay UI must never present a broker execution button or use current live prices
as historical context.

07/09/2026: [TradeZella backtesting documentation](https://help.tradezella.com/en/articles/8866881-understanding-the-backtesting-window)
was retrieved after the initial feature URL failed. It documents session setup,
play/pause and manual order workflows with chart-adjustable SL/TP. The resulting
AITrading ticket and Journal review UI use original code and styling.
