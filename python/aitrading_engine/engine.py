"""One-position closed-bar simulation with explicit provenance and accounting."""
from decimal import Context, Decimal as D, ROUND_HALF_EVEN, localcontext
import json

from . import VERSION
from .common import Budget, canonical, digest, plain
from .contract import dataset, object_fields, parse, require, strategy, time_text
from .indicators import IndicatorEvaluator

MAX_OUTPUT = 32 * 1024 * 1024


def simulate(validated, data, budget):
    config, candles = validated.document, data.candles
    indicators = IndicatorEvaluator(validated, candles, budget)
    risk, execution = config["risk"], config["execution"]
    initial = risk["initialCapital"]
    balance, peak, max_drawdown, fees = initial, initial, D(0), D(0)
    fraction = (execution["spreadBps"] / 2 + execution["slippageBps"]) / 10000
    commission = execution["commissionBps"] / 10000
    position, pending = None, None
    events, trades, bars = [], [], []

    def event(kind, index, **fields):
        budget.spend()
        item = {"id": len(events) + 1, "kind": kind, "barIndex": index, **fields}
        events.append(item)
        return item["id"]

    def fill(raw, buy):
        return raw * (1 + fraction if buy else 1 - fraction)

    def close(index, raw, reason, signal):
        nonlocal position, balance, fees
        direction = position["direction"]
        price = fill(raw, direction == -1)
        fee = price * position["quantity"] * commission
        gross = (price - position["entryPrice"]) * position["quantity"] * direction
        balance += gross - fee
        fees += fee
        at_open = reason == "RULE_EXIT"
        details = {"side": position["side"], "rawPrice": raw, "price": price,
                   "quantity": position["quantity"], "fee": fee, "reason": reason,
                   "executionTime": time_text(candles[index]["time"]) if at_open else None,
                   "timePrecision": "OPEN" if at_open else "BAR_INTERVAL",
                   "barOpenTime": time_text(candles[index]["time"]),
                   "barCloseTime": time_text(candles[index]["time"] + data.interval),
                   "signalBar": signal["signalBar"] if signal else None,
                   "signalTime": signal["signalTime"] if signal else None}
        exit_id = event("EXIT", index, **details)
        trades.append({**position, "exitEventId": exit_id, "exitBar": index,
                       "exitPrice": price, "exitFee": fee, "exitReason": reason,
                       "exitTime": details["executionTime"], "exitTimePrecision": details["timePrecision"],
                       "grossPnl": gross, "netPnl": gross - position["entryFee"] - fee})
        position = None

    for i, candle in enumerate(candles):
        budget.spend()
        if pending is not None:
            order, pending = pending, None
            if order["action"] == "EXIT":
                close(i, candle["open"], "RULE_EXIT", order)
            elif balance <= 0:
                event("SKIP", i, reason="NONPOSITIVE_EQUITY", signalBar=order["signalBar"], signalTime=order["signalTime"])
            else:
                direction = 1 if order["side"] == "long" else -1
                price = fill(candle["open"], direction == 1)
                margin = balance * risk["allocationPct"] / 100
                notional = margin * risk["leverage"]
                quantity = notional / price
                entry_fee = price * quantity * commission
                balance -= entry_fee
                fees += entry_fee
                entry_id = event("ENTRY", i, side=order["side"], rawPrice=candle["open"], price=price,
                                 quantity=quantity, fee=entry_fee, executionTime=time_text(candle["time"]),
                                 timePrecision="OPEN", signalBar=order["signalBar"], signalTime=order["signalTime"])
                position = {"side": order["side"], "direction": direction, "entryEventId": entry_id,
                            "entryBar": i, "entryTime": time_text(candle["time"]),
                            "signalBar": order["signalBar"], "signalTime": order["signalTime"],
                            "entryPrice": price, "quantity": quantity, "margin": margin,
                            "entryNotional": notional, "entryFee": entry_fee,
                            "stopPrice": price * (1 - direction * risk["stopLossPct"] / 100),
                            "takeProfitPrice": price * (1 + direction * risk["takeProfitPct"] / 100)}
        if position is not None:
            stop, target, direction = position["stopPrice"], position["takeProfitPrice"], position["direction"]
            hit_stop = candle["low"] <= stop if direction == 1 else candle["high"] >= stop
            hit_target = candle["high"] >= target if direction == 1 else candle["low"] <= target
            if hit_stop:
                raw = min(candle["open"], stop) if direction == 1 else max(candle["open"], stop)
                close(i, raw, "STOP_LOSS", None)
            elif hit_target:
                close(i, target, "TAKE_PROFIT", None)
        unrealized = D(0) if position is None else (candle["close"] - position["entryPrice"]) * position["quantity"] * position["direction"]
        equity = balance + unrealized
        peak = max(peak, equity)
        drawdown = (peak - equity) / peak * 100
        max_drawdown = max(max_drawdown, drawdown)
        rules = {key: indicators.condition(node, i) for key, node in config["rules"].items()}
        close_time = time_text(candle["time"] + data.interval)
        if position is not None:
            if rules[position["side"] + "Exit"] is True:
                pending = {"action": "EXIT", "side": position["side"], "signalBar": i, "signalTime": close_time}
        elif rules["longEntry"] is True and rules["shortEntry"] is True:
            event("SKIP", i, reason="SIMULTANEOUS_ENTRIES", signalTime=close_time, confirmationTime=close_time)
        elif rules["longEntry"] is True or rules["shortEntry"] is True:
            pending = {"action": "ENTRY", "side": "long" if rules["longEntry"] is True else "short", "signalBar": i, "signalTime": close_time}
        if pending:
            event("SIGNAL", i, **pending, confirmationTime=close_time)
        bars.append({"index": i, "openTime": time_text(candle["time"]), "closeTime": close_time,
                     "indicators": {key: values[i] for key, values in indicators.values.items()},
                     "pivotConfirmations": {key: None if points[i] is None else {"originalIndex": points[i][0], "price": points[i][1]} for key, points in indicators.confirmations.items()},
                     "rules": rules, "balance": balance, "unrealizedGross": unrealized,
                     "equity": equity, "drawdownPct": drawdown,
                     "positionSide": None if position is None else position["side"]})
    closed_net = sum((v["netPnl"] for v in trades), D(0))
    wins = [v["netPnl"] for v in trades if v["netPnl"] > 0]
    losses = [v["netPnl"] for v in trades if v["netPnl"] < 0]
    final_equity = bars[-1]["equity"]
    open_position = None if position is None else {**position, "markPrice": candles[-1]["close"],
                                                   "markTime": bars[-1]["closeTime"], "unrealizedGross": bars[-1]["unrealizedGross"]}
    return {"bars": bars, "events": events, "trades": trades, "openPosition": open_position,
            "termination": {"reason": "DATASET_END", "cancelledOrder": pending},
            "metrics": {"initialCapital": initial, "finalBalance": balance, "finalEquity": final_equity,
                        "netProfit": final_equity - initial, "returnPct": (final_equity - initial) / initial * 100,
                        "closedNetPnl": closed_net, "totalFees": fees, "maxDrawdownPct": max_drawdown,
                        "closedTrades": len(trades), "winningTrades": len(wins), "losingTrades": len(losses),
                        "breakevenTrades": len(trades) - len(wins) - len(losses),
                        "winRatePct": D(len(wins)) / len(trades) * 100 if trades else None,
                        "profitFactor": sum(wins, D(0)) / -sum(losses, D(0)) if losses else None}}


def run(raw, budget=None):
    """Bytes in, fully validated detached JSON-compatible result out."""
    budget = budget or Budget()
    with localcontext(Context(prec=34, rounding=ROUND_HALF_EVEN)):
        request = parse(raw, budget)
        object_fields(request, ("protocolVersion", "dsl", "dataset"), "REQUEST_FIELDS")
        require(request["protocolVersion"] == VERSION, "PROTOCOL_VERSION")
        validated = strategy(request["dsl"], budget)
        data = dataset(request["dataset"], validated.document["market"], budget)
        result = simulate(validated, data, budget)
        result["runCard"] = {"engineVersion": VERSION, "protocolVersion": VERSION,
                             "schemaVersion": VERSION, "validatorVersion": VERSION,
                             "canonicalization": "aitrading-canonical-1", "dataFormat": "ohlcv-v1",
                             "decimalPolicy": "decimal34-half-even-v1", "dslHash": validated.hash,
                             "canonicalDsl": validated.canonical, "minimumBars": validated.minimum_bars,
                             "dataset": data.metadata, "inputHash": digest(canonical(request)),
                             "policy": validated.document["execution"],
                             "limitations": ["Unverified research data; historical results do not guarantee profit.",
                                             "No funding, liquidation, broker tick/lot or live-order simulation.",
                                             "Protective execution time is only known within its candle."]}
        result = plain(result)
        budget.spend()
        result["resultHash"] = digest(canonical(result))
        budget.spend()
        return result


def encode_result(result, budget):
    encoded = json.dumps({"ok": True, "result": result}, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    require(len(encoded) <= MAX_OUTPUT, "OUTPUT_LIMIT")
    budget.spend()
    return encoded
