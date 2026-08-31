# Offline Strategy DSL reference engine

PB-010 / Issue #11, Python3.12+ standard library only. No pip install, API, database,
network, broker or AI provider needed. Keep this package and the repository's
bundled `backend/src/main/resources/dsl/strategy-1.0.0.schema.json` together.
No caller-supplied schema/code/path is accepted. Read the contract and financial
simulation limitations in [design](../specs/PB-010/design.md).

From repository root, run tests on Windows or Linux:

```text
python -m unittest discover -s python/tests -v
```

The worker is `python -I python/run_backtest.py`, with one UTF-8 JSON request on
stdin until EOF, one JSON response on stdout. `-I` isolates environment/cwd module
resolution; launcher adds only its own fixed package directory. No arguments are
supported. Limit2MiB input/32MiB output; cooperative15s/5million operation budget.
The caller must supervise idle input, hard process timeout, memory and output pipe
limits. PB-011 implements that Java job boundary below. Never expose this worker as
an unauthenticated service or pass commands/paths from a request.

Portable synthetic example without PowerShell text-pipeline encoding changes:

```python
from pathlib import Path
import subprocess
import sys

sample = Path("python/examples/long-next-open.json").read_bytes()
result = subprocess.run(
    [sys.executable, "-I", "python/run_backtest.py"],
    input=sample, capture_output=True, timeout=20, check=True,
)
print(result.stdout.decode("utf-8"))
```

Expected hand result: signal bar0 at01:00 UTC, buy10 units at100 atbar1 open,
exit signal bar1 at02:00, sell at110 atbar2 open; closed net100, equity1100,
no open position. Last bar's new entry signal is canceled at dataset end. This
zero-cost synthetic example is not a market strategy recommendation. Tests also
cover nonzero adverse spread/slippage/commission, losses, short trades and gaps.

Success: `{ok:true,result:{runCard,bars,events,trades,openPosition,termination,
metrics,resultHash}}`. Every monetary/indicator Decimal is a plain JSON string;
indices/counters are integers. Rules are true/false/null for undefined/disabled.
Prices retain Decimal34 significant-digit arithmetic, not binary floating point.
Trade protective exitTime may be null with BAR_INTERVAL precision. Never invent
an intrabar timestamp from OHLC. Metrics use closed trades except final marked
equity and netProfit; no artificial closing fee or terminal liquidation.

Run card contains full canonical DSL, fingerprints, explicit candle cutoff/source
and algorithm policies; treat it as private strategy data. Hashes do not prove
ownership, source authenticity or profitability. Input timestamp cutoff is
caller-provided historical provenance, not a claim of server clock validation.

Failure: `{ok:false,error:{code:"FIXED_CODE"}}`, exit2 for invalid/unsupported/
over-budget input, exit3 for internal/configuration failure. No traceback, input
echo or partial result. Callers must check exit code and response shape; never
treat a failed process as a zero-trade successful backtest.

No frontend button invokes this worker yet; PB-012 owns the web controls/results.
PB-011 uses run_supervised_backtest.py, which installs mandatory OS CPU/memory
limits before loading this unchanged engine. Java supplies fixed arguments,
sanitized environment and bounded pipes/wall time/cancellation. See the
[owned job API design](../specs/PB-011/design.md). Five additional Python tests
exercise actual child CPU/memory/protocol/environment limits; no limit is applied
to the test runner itself. This is not an arbitrary-code execution sandbox.
