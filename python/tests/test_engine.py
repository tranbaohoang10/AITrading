"""Synthetic, hand-computed and adversarial reference-engine verification."""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from decimal import Decimal as D, localcontext
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aitrading_engine.common import Budget, EngineError, canonical, decimal_text
from aitrading_engine.contract import MAX_INPUT, schema_supported, time_text
from aitrading_engine.engine import encode_result, run
from aitrading_engine.indicators import smooth

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "backend/src/test/resources/dsl"
BASE_TIME = 1704067200  # 2024-01-01T00:00:00Z


def series(field="close", lag=0):
    return {"kind": "series", "field": field, "lag": lag}


def ref(identity, lag=0):
    return {"kind": "indicator", "id": identity, "lag": lag}


def constant(value):
    return {"kind": "constant", "value": value}


def compare(left=None, op="gt", right=None):
    return {"kind": "compare", "op": op, "left": left or series(), "right": right or constant(0)}


def candle(index, open_price, high=None, low=None, close=None, volume=10):
    close = open_price if close is None else close
    high = max(open_price, close) if high is None else high
    low = min(open_price, close) if low is None else low
    return dict(zip(("timestamp", "open", "high", "low", "close", "volume"),
                    (time_text(BASE_TIME + index * 3600), *map(str, (open_price, high, low, close, volume)))))


def request(prices=(100, 100, 100), family="price-action"):
    dsl = json.loads((FIXTURES / (family + ".json")).read_text(encoding="utf-8"))
    return {"protocolVersion": "1.0.0", "dsl": dsl,
            "dataset": {**dsl["market"], "sourceType": "SYNTHETIC", "closedThrough": "2030-01-01T00:00:00Z",
                        "candles": [candle(i, price) for i, price in enumerate(prices)]}}


def execution_request(prices=(100, 100, 100)):
    value = request(prices)
    value["dsl"]["rules"]["longEntry"] = compare()
    value["dsl"]["risk"].update(initialCapital=1000, allocationPct=100, stopLossPct=50, takeProfitPct=100)
    value["dsl"]["execution"].update(commissionBps=0, spreadBps=0, slippageBps=0)
    return value


def raw(value):
    return json.dumps(value, ensure_ascii=True, separators=(",", ":")).encode()


def execute(value):
    return run(raw(value))


def values(result, identity):
    return [None if row["indicators"][identity] is None else D(row["indicators"][identity]) for row in result["bars"]]


class ContractTests(unittest.TestCase):
    def invalid(self, value, code=None):
        with self.assertRaises(EngineError) as failure:
            execute(value)
        if code:
            self.assertEqual(failure.exception.code, code)

    def test_six_java_canonical_and_warmup_goldens(self):
        goldens = json.loads((FIXTURES / "goldens.json").read_text(encoding="utf-8"))
        self.assertEqual(len(goldens), 6)
        for family, expected in goldens.items():
            with self.subTest(family=family):
                card = execute(request(family=family))["runCard"]
                self.assertEqual(card["canonicalDsl"], expected["canonicalJson"])
                self.assertEqual(card["dslHash"], expected["hash"])
                self.assertEqual(card["minimumBars"], expected["minimumBars"])

    def test_schema_missing_unknown_type_and_unsupported(self):
        for field in ("script", "$ref", "$type", "ownerId", "hash", "validated", "multiTimeframe", "trailingStop", "url"):
            value = request()
            value["dsl"][field] = "https://127.0.0.1/../../secret; DROP TABLE x"
            self.invalid(value, "DSL_SCHEMA")
        for key in request()["dsl"]:
            value = request()
            del value["dsl"][key]
            self.invalid(value, "DSL_SCHEMA")
        for invalid in (None, [], True, 3, "code"):
            value = request()
            value["dsl"] = invalid
            self.invalid(value, "DSL_SCHEMA")
        for field, invalid in (("maxPositions", True), ("fill", "same_bar_close"), ("commissionBps", -1), ("slippageBps", 101)):
            value = request()
            value["dsl"]["execution"][field] = invalid
            self.invalid(value, "DSL_SCHEMA")

    def test_unicode_controls_duplicate_numeric_and_byte_parser_limits(self):
        for text in (b'{"a":1,"a":2}', b'{}{}', b'\xef\xbb\xbf{}', b'\xff', b'NaN', b'Infinity', b'1e100000', b'1e-9', b'1' * 65, b'[' * 1000 + b']' * 1000):
            with self.subTest(text=text[:30]), self.assertRaises(EngineError):
                run(text)
        for text in ("\ud800", "\udfff", "a\x00b", "a\x7fb", "a\x85b", "x" * 121):
            value = request()
            value["dsl"]["name"] = text
            self.invalid(value)
        value = request()
        value["dsl"]["name"] = "🧪 tiếng Việt / \\\"quoted"
        self.assertIn("🧪 tiếng Việt", execute(value)["runCard"]["canonicalDsl"])
        with self.assertRaisesRegex(EngineError, "INPUT_LIMIT"):
            run(b" " * (MAX_INPUT + 1))
        base = raw(request())
        self.assertTrue(run(base + b" " * (MAX_INPUT - len(base))))

    def test_semantic_cycles_duplicates_refs_units_and_entry_rules(self):
        samples = [
            ([{"id": "a", "type": "SMA", "source": ref("a"), "period": 2}], "REFERENCE_CYCLE"),
            ([{"id": "a", "type": "SMA", "source": ref("b"), "period": 2}], "MISSING_REFERENCE"),
            ([{"id": "a", "type": "RSI", "source": series("volume"), "period": 2}], "PRICE_SOURCE_REQUIRED"),
            ([{"id": "a", "type": "EMA", "source": constant(2), "period": 2}], "SERIES_SOURCE_REQUIRED"),
            ([{"id": "a", "type": "ATR", "period": 2}, {"id": "a", "type": "ATR", "period": 2}], "DUPLICATE_ID"),
            ([{"id": "a", "type": "TRENDLINE", "pivotRef": "b"}, {"id": "b", "type": "ATR", "period": 2}], "PIVOT_REFERENCE_REQUIRED")]
        for indicators, code in samples:
            value = request()
            value["dsl"]["indicators"] = indicators
            self.invalid(value, code)
        for condition, code in ((compare(series(), right=series("volume")), "UNIT_MISMATCH"),
                                (compare(constant(1), right=constant(2)), "MEASURABLE_OPERAND_REQUIRED")):
            value = request()
            value["dsl"]["rules"]["longEntry"] = condition
            self.invalid(value, code)
        value = request()
        value["dsl"]["rules"]["longEntry"] = None
        self.invalid(value, "ENTRY_REQUIRED")
        value = request()
        value["dsl"]["rules"]["shortExit"] = compare()
        self.invalid(value, "DISABLED_SIDE_EXIT")
        value = request()
        value["dsl"]["risk"].update(leverage=10, stopLossPct=11)
        self.invalid(value, "LEVERAGED_STOP_LIMIT")

    def test_complexity_limits_and_trusted_schema_rejection(self):
        value = request()
        value["dsl"]["indicators"] = [{"id": "s" + str(i), "type": "SMA", "period": 2000,
                                         "source": series() if i == 0 else ref("s" + str(i - 1))} for i in range(6)]
        self.invalid(value, "WARMUP_LIMIT")
        value = request()
        node = compare()
        for _ in range(8):
            node = {"kind": "not", "child": node}
        value["dsl"]["rules"]["longEntry"] = node
        self.invalid(value, "CONDITION_LIMIT")
        value = request()
        value["dsl"]["labels"] = ["x"] * 2049
        self.invalid(value, "TREE_LIMIT")
        for extra in ({"not": {}}, {"$ref": "https://untrusted/schema"}, {"pattern": "(a+)+$"}):
            with self.assertRaisesRegex(EngineError, "SCHEMA_CONFIGURATION"):
                schema_supported(extra)

    def test_market_identity_precision_and_provenance(self):
        value = request((100,))
        value["dataset"]["candles"][0].update(open="100.00000000", high="110", low="90", close="105.12345678", volume="0")
        result = execute(value)
        identity = "ohlcv-v1\nBTC_USDT\n1h\nUTC\n2024-01-01T00:00:00Z,100,110,90,105.12345678,0\n"
        self.assertEqual(result["runCard"]["dataset"]["dataHash"], hashlib.sha256(identity.encode()).hexdigest())
        self.assertFalse(result["runCard"]["dataset"]["sourceVerified"])
        other = deepcopy(value)
        other["dataset"]["candles"][0]["open"] = "100"
        self.assertEqual(execute(other)["runCard"]["dataset"]["dataHash"], result["runCard"]["dataset"]["dataHash"])

    def test_existing_java_ohlcv_golden_and_all_timeframes(self):
        value = request((100,))
        value["dsl"]["market"]["symbol"] = value["dataset"]["symbol"] = "TEST_USD"
        value["dataset"]["candles"][0].update(open="100.12345678", high="102", low="99", close="101", volume="0")
        self.assertEqual(execute(value)["runCard"]["dataset"]["dataHash"], "bc335f1445da4379646442822952a0855b77cc13a3a1e2847e3853f0278d35f8")
        for timeframe, interval in (("1m", 60), ("5m", 300), ("15m", 900), ("30m", 1800), ("1h", 3600), ("4h", 14400), ("1d", 86400)):
            value = request((1, 1))
            value["dsl"]["market"]["timeframe"] = value["dataset"]["timeframe"] = timeframe
            value["dataset"]["candles"][1]["timestamp"] = time_text(BASE_TIME + interval)
            self.assertEqual(execute(value)["bars"][0]["closeTime"], time_text(BASE_TIME + interval))

    def test_exact_numeric_equivalence_and_no_bool_coercion(self):
        value = request()
        original = raw(value)
        equivalent = original.replace(b'"initialCapital":10000', b'"initialCapital":1.000e4').replace(b'"lag":0', b'"lag":-0.000')
        self.assertEqual(run(equivalent)["runCard"]["dslHash"], run(original)["runCard"]["dslHash"])
        for field in ("initialCapital", "leverage", "allocationPct"):
            value = request()
            value["dsl"]["risk"][field] = True
            self.invalid(value, "DSL_SCHEMA")

    def test_bad_market_metadata_dates_time_order_and_gaps(self):
        for field, invalid in (("symbol", "OTHER"), ("timeframe", "5m"), ("timezone", "Europe/Paris"), ("sourceType", "VERIFIED")):
            value = request()
            value["dataset"][field] = invalid
            self.invalid(value)
        for text in ("2024-02-30T00:00:00Z", "2024-01-01T24:00:00Z", "2024-01-01T00:00:60Z", "1969-12-31T23:00:00Z", "2101-01-01T00:00:00Z", "2024-01-01T00:00:00+00:00", "2024-01-01T00:00:00.000Z", "2024-01-01T00:01:00Z"):
            value = request()
            value["dataset"]["candles"][0]["timestamp"] = text
            self.invalid(value)
        for index in (0, 2, -1):
            value = request()
            value["dataset"]["candles"][1]["timestamp"] = time_text(BASE_TIME + index * 3600)
            self.invalid(value, "NONCONTIGUOUS_DATA")
        value = request()
        value["dataset"]["closedThrough"] = "2024-01-01T02:59:59Z"
        self.invalid(value, "OPEN_CANDLE")
        value["dataset"]["closedThrough"] = "2024-01-01T03:00:00Z"
        self.assertEqual(len(execute(value)["bars"]), 3)

    def test_candle_number_format_range_and_counts(self):
        for invalid in (0, -1, True, "0", "-1", "1e2", "NaN", "1000000000001", "1.000000001", "01.2.3", " 1", "1;exec()", "=cmd"):
            value = request()
            value["dataset"]["candles"][0]["open"] = invalid
            self.invalid(value)
        for field, number in (("low", "101"), ("high", "99"), ("volume", "-0")):
            value = request()
            value["dataset"]["candles"][0][field] = number
            self.invalid(value)
        for count in (0, 5001):
            value = request()
            value["dataset"]["candles"] = [candle(i, 100) for i in range(count)]
            self.invalid(value, "CANDLE_COUNT")


class IndicatorTests(unittest.TestCase):
    def test_sma_ema_extrema_full_window_hand_values(self):
        value = request((1, 2, 3, 7, 5))
        value["dsl"]["indicators"] = [{"id": kind.lower(), "type": kind, "period": 3, "source": series()} for kind in ("SMA", "EMA", "HIGHEST", "LOWEST")]
        result = execute(value)
        self.assertEqual(values(result, "sma"), [None, None, D(2), D(4), D(5)])
        self.assertEqual(values(result, "ema"), [None, None, D(2), D("4.5"), D("4.75")])
        self.assertEqual(values(result, "highest"), [None, None, D(3), D(7), D(7)])
        self.assertEqual(values(result, "lowest"), [None, None, D(1), D(2), D(3)])

    def test_rsi_flat_up_down_and_wilder_seed(self):
        for prices, expected in (((10, 10, 10, 10), 50), ((1, 2, 3, 4), 100), ((4, 3, 2, 1), 0)):
            value = request(prices)
            value["dsl"]["indicators"] = [{"id": "r", "type": "RSI", "period": 2, "source": series()}]
            self.assertEqual(values(execute(value), "r"), [None, None, D(expected), D(expected)])
        value = request((10, 12, 10, 12))
        value["dsl"]["indicators"] = [{"id": "r", "type": "RSI", "period": 2, "source": series()}]
        self.assertEqual(values(execute(value), "r"), [None, None, D(50), D(75)])

    def test_atr_previous_close_and_wilder(self):
        value = request()
        value["dataset"]["candles"] = [candle(0, 10, 11, 9, 10), candle(1, 12, 14, 11, 12), candle(2, 13, 14, 12, 13), candle(3, 13, 15, 11, 14)]
        value["dsl"]["indicators"] = [{"id": "atr", "type": "ATR", "period": 2}]
        self.assertEqual(values(execute(value), "atr"), [None, None, D(3), D("3.5")])

    def test_forward_dag_lag_and_nested_warmup(self):
        value = request((1, 2, 3, 4, 5, 6))
        value["dsl"]["indicators"] = [{"id": "nested", "type": "SMA", "period": 2, "source": ref("first", 1)},
                                         {"id": "first", "type": "EMA", "period": 2, "source": series("close", 1)}]
        result = execute(value)
        self.assertEqual(result["runCard"]["minimumBars"], 5)
        self.assertEqual(values(result, "nested"), [None, None, None, None, D(2), D(3)])

    def test_undefined_source_resets_contiguous_seed(self):
        source = [D(1), D(3), None, D(7), D(9), D(11)]
        self.assertEqual(smooth(source, 2, "EMA", Budget()), [None, D(2), None, None, D(8), D(10)])

    def test_pivots_confirmation_ties_and_original_index_trendline(self):
        value = request((1, 5, 2, 7, 3, 3, 2))
        value["dsl"]["indicators"] = [{"id": "line", "type": "TRENDLINE", "pivotRef": "p"},
                                         {"id": "p", "type": "PIVOT_HIGH", "left": 1, "right": 1},
                                         {"id": "lo", "type": "PIVOT_LOW", "left": 1, "right": 1}]
        result = execute(value)
        self.assertEqual(values(result, "p"), [None, None, D(5), D(5), D(7), D(7), D(7)])
        self.assertEqual(values(result, "line"), [None, None, None, None, D(8), D(9), D(10)])
        self.assertEqual(result["bars"][2]["pivotConfirmations"]["p"], {"originalIndex": 1, "price": "5"})
        self.assertEqual(values(result, "lo"), [None, None, None, D(2), D(2), D(2), D(2)])
        self.assertIsNone(result["bars"][5]["pivotConfirmations"]["lo"])

    def test_cross_equality_both_directions_and_undefined_not(self):
        for direction, expected in (("above", [None, False, True, False, False]), ("below", [None, False, False, False, True])):
            value = request((1, 2, 3, 2, 1))
            value["dsl"]["rules"]["longEntry"] = {"kind": "cross", "direction": direction, "left": series(), "right": constant(2)}
            self.assertEqual([v["rules"]["longEntry"] for v in execute(value)["bars"]], expected)
        value = request((1, 2, 3))
        value["dsl"]["rules"]["longEntry"] = {"kind": "not", "child": compare(series(lag=2))}
        result = execute(value)
        self.assertEqual([v["rules"]["longEntry"] for v in result["bars"]], [None, None, False])
        self.assertEqual(result["events"], [])

    def test_three_valued_all_any_and_comparison_operators(self):
        for kind, true_node, expected in (("all", False, False), ("all", True, None), ("any", True, True), ("any", False, None)):
            value = request((1,))
            value["dsl"]["rules"]["longEntry"] = {"kind": kind, "children": [compare(series(lag=1)), compare(op="gt" if true_node else "lt")]}
            self.assertIs(execute(value)["bars"][0]["rules"]["longEntry"], expected)
        for op, expected in (("gt", False), ("gte", True), ("lt", False), ("lte", True), ("eq", True), ("neq", False)):
            value = request((2,))
            value["dsl"]["rules"]["longEntry"] = compare(op=op, right=constant(2))
            self.assertIs(execute(value)["bars"][0]["rules"]["longEntry"], expected)

    def test_all_family_prefix_invariance_with_future_mutation(self):
        for family in json.loads((FIXTURES / "goldens.json").read_text()):
            full = request(tuple(100 + (i * 7 % 19) for i in range(50)), family)
            for i, row in enumerate(full["dataset"]["candles"]):
                price = int(row["close"])
                full["dataset"]["candles"][i] = candle(i, price - 1, price + 3, price - 3, price)
            complete = execute(full)
            for count in (1, 7, 22, 37):
                prefix = deepcopy(full)
                prefix["dataset"]["candles"] = prefix["dataset"]["candles"][:count]
                partial = execute(prefix)
                self.assertEqual(partial["bars"], complete["bars"][:count], (family, count))
                self.assertEqual(partial["events"], [e for e in complete["events"] if e["barIndex"] < count], (family, count))
            altered = deepcopy(full)
            for i in range(25, 50):
                altered["dataset"]["candles"][i] = candle(i, 1000 + i)
            changed = execute(altered)
            self.assertEqual(changed["bars"][:25], complete["bars"][:25], family)
            self.assertEqual([e for e in changed["events"] if e["barIndex"] < 25], [e for e in complete["events"] if e["barIndex"] < 25], family)


class ExecutionTests(unittest.TestCase):
    def test_combined_costs_and_resizing_after_realized_loss(self):
        value = execution_request((100,) * 5)
        value["dsl"]["risk"]["initialCapital"] = 1010
        value["dsl"]["execution"].update(commissionBps=100, spreadBps=100, slippageBps=50)
        value["dsl"]["rules"]["longExit"] = compare()
        result = execute(value)
        first, second = result["trades"]
        self.assertEqual((first["entryFee"], first["exitFee"], first["grossPnl"], first["netPnl"]), ("10.1", "9.9", "-20", "-40"))
        self.assertEqual(second["entryNotional"], "970")
        self.assertEqual([t["entryBar"] for t in result["trades"]], [1, 3])
        with localcontext() as context:
            context.prec = 34
            self.assertEqual(D(result["metrics"]["finalBalance"]), D(1010) + sum(D(t["netPnl"]) for t in result["trades"]))

    def test_next_open_long_hand_trade_and_no_forced_close(self):
        value = execution_request((100, 100, 110))
        value["dsl"]["rules"]["longExit"] = compare()
        result = execute(value)
        trade = result["trades"][0]
        self.assertEqual((trade["signalBar"], trade["entryBar"], trade["exitBar"]), (0, 1, 2))
        self.assertEqual((trade["entryPrice"], trade["quantity"], trade["exitPrice"], trade["netPnl"]), ("100", "10", "110", "100"))
        self.assertEqual(result["metrics"]["finalEquity"], "1100")
        self.assertEqual(result["metrics"]["winRatePct"], "100")
        self.assertEqual(result["termination"]["cancelledOrder"]["signalBar"], 2)
        self.assertEqual(len([e for e in result["events"] if e["kind"] == "ENTRY"]), 1)
        self.assertEqual(trade["entryTime"], result["bars"][0]["closeTime"])

    def test_short_costs_leverage_and_ledger(self):
        value = execution_request((100, 100, 90))
        value["dsl"]["rules"].update(longEntry=None, shortEntry=compare(), shortExit=compare())
        value["dsl"]["risk"].update(allocationPct=50, leverage=2)
        value["dsl"]["execution"].update(commissionBps=100)
        result = execute(value)
        trade = result["trades"][0]
        self.assertEqual((trade["entryFee"], trade["exitFee"], trade["grossPnl"], trade["netPnl"]), ("10", "9", "100", "81"))
        self.assertEqual(trade["margin"], "500")
        self.assertEqual(result["bars"][1]["equity"], "990")
        self.assertEqual(result["metrics"]["finalBalance"], "1081")
        self.assertEqual(result["metrics"]["totalFees"], "19")
        self.assertEqual(result["metrics"]["maxDrawdownPct"], "1")

    def test_adverse_spread_slippage_on_both_sides(self):
        for side, entry, exit_price in (("long", "101", "99"), ("short", "99", "101")):
            value = execution_request()
            value["dsl"]["risk"]["initialCapital"] = 1010 if side == "long" else 990
            value["dsl"]["rules"] = {"longEntry": None, "shortEntry": None, "longExit": None, "shortExit": None}
            value["dsl"]["rules"][side + "Entry"] = compare()
            value["dsl"]["rules"][side + "Exit"] = compare()
            value["dsl"]["execution"].update(spreadBps=100, slippageBps=50)
            trade = execute(value)["trades"][0]
            self.assertEqual((trade["entryPrice"], trade["exitPrice"], trade["quantity"], trade["netPnl"]), (entry, exit_price, "10", "-20"))

    def test_stops_targets_both_hit_and_gaps_long_short(self):
        cases = [("long", 100, 120, 80, "STOP_LOSS", "90"),
                 ("long", 80, 85, 75, "STOP_LOSS", "80"),
                 ("long", 120, 125, 115, "TAKE_PROFIT", "110"),
                 ("short", 100, 120, 80, "STOP_LOSS", "110"),
                 ("short", 120, 125, 115, "STOP_LOSS", "120"),
                 ("short", 80, 85, 75, "TAKE_PROFIT", "90")]
        for side, open_price, high, low, reason, price in cases:
            value = execution_request()
            value["dsl"]["risk"].update(stopLossPct=10, takeProfitPct=10)
            value["dsl"]["rules"].update(longEntry=None, shortEntry=None)
            value["dsl"]["rules"][side + "Entry"] = compare()
            value["dataset"]["candles"][2] = candle(2, open_price, high, low)
            result = execute(value)
            trade = result["trades"][0]
            self.assertEqual((trade["exitReason"], trade["exitPrice"]), (reason, price))
            self.assertIsNone(trade["exitTime"])
            self.assertEqual(trade["exitTimePrecision"], "BAR_INTERVAL")

    def test_entry_bar_barriers_actual_fill_stop_and_exit_priority(self):
        value = execution_request((100, 100))
        value["dsl"]["risk"].update(initialCapital=1010, stopLossPct=10, takeProfitPct=10)
        value["dsl"]["execution"].update(spreadBps=100, slippageBps=50)
        value["dataset"]["candles"][1] = candle(1, 100, 115, 85)
        trade = execute(value)["trades"][0]
        self.assertEqual(trade["entryBar"], trade["exitBar"])
        self.assertEqual((trade["stopPrice"], trade["exitPrice"], trade["netPnl"]), ("90.9", "89.991", "-110.09"))
        value = execution_request()
        value["dsl"]["rules"]["longExit"] = compare()
        value["dataset"]["candles"][2] = candle(2, 110, 300, 1)
        trade = execute(value)["trades"][0]
        self.assertEqual((trade["exitReason"], trade["exitPrice"]), ("RULE_EXIT", "110"))

    def test_no_implicit_reverse_pyramiding_or_simultaneous_entry(self):
        value = execution_request((100,) * 8)
        result = execute(value)
        self.assertEqual(len([e for e in result["events"] if e["kind"] == "ENTRY"]), 1)
        self.assertIsNotNone(result["openPosition"])
        value["dsl"]["rules"]["shortEntry"] = compare()
        result = execute(value)
        self.assertEqual(result["trades"], [])
        self.assertIsNone(result["openPosition"])
        self.assertEqual(len(result["events"]), 8)
        self.assertTrue(all(e["reason"] == "SIMULTANEOUS_ENTRIES" for e in result["events"]))
        value = execution_request((100, 101, 101))
        value["dsl"]["rules"]["shortEntry"] = compare(right=constant(100))
        result = execute(value)
        self.assertEqual(result["openPosition"]["side"], "long")
        self.assertEqual(result["trades"], [])

    def test_dataset_end_zero_trades_pending_exit_and_open_mark(self):
        value = execution_request((100,))
        result = execute(value)
        self.assertEqual(result["trades"], [])
        self.assertIsNone(result["openPosition"])
        self.assertIsNone(result["metrics"]["winRatePct"])
        self.assertIsNone(result["metrics"]["profitFactor"])
        self.assertEqual(result["termination"]["cancelledOrder"]["action"], "ENTRY")
        value = execution_request((100, 100))
        value["dataset"]["candles"][1] = candle(1, 100, 110, 100, 110)
        value["dsl"]["execution"]["commissionBps"] = 100
        value["dsl"]["rules"]["longExit"] = compare()
        result = execute(value)
        self.assertEqual(result["trades"], [])
        self.assertEqual(result["openPosition"]["unrealizedGross"], "100")
        self.assertEqual(result["metrics"]["finalEquity"], "1090")
        self.assertEqual(result["metrics"]["totalFees"], "10")
        self.assertEqual(result["termination"]["cancelledOrder"]["action"], "EXIT")

    def test_losses_negative_equity_and_no_invented_liquidation(self):
        value = execution_request((100, 100, 200, 200))
        value["dsl"]["rules"].update(longEntry=None, shortEntry=compare())
        value["dsl"]["risk"].update(leverage=10, stopLossPct=10)
        result = execute(value)
        self.assertEqual(result["trades"][0]["netPnl"], "-10000")
        self.assertEqual(result["metrics"]["finalEquity"], "-9000")
        self.assertEqual(result["metrics"]["maxDrawdownPct"], "1000")
        self.assertEqual(result["metrics"]["profitFactor"], "0")
        self.assertEqual(result["metrics"]["losingTrades"], 1)
        self.assertTrue(any(e.get("reason") == "NONPOSITIVE_EQUITY" for e in result["events"]))


class WorkerTests(unittest.TestCase):
    def test_documented_example_actual_cli_hand_event_trace(self):
        payload = (ROOT / "python/examples/long-next-open.json").read_bytes()
        process = subprocess.run([sys.executable, "-I", str(ROOT / "python/run_backtest.py")], input=payload, capture_output=True, timeout=20)
        self.assertEqual(process.returncode, 0)
        self.assertEqual(process.stderr, b"")
        result = json.loads(process.stdout)["result"]
        self.assertEqual([(e["kind"], e["barIndex"]) for e in result["events"]], [("SIGNAL", 0), ("ENTRY", 1), ("SIGNAL", 1), ("EXIT", 2), ("SIGNAL", 2)])
        self.assertEqual([b["equity"] for b in result["bars"]], ["1000", "1000", "1100"])
        self.assertEqual(result["trades"][0]["netPnl"], "100")
        self.assertIsNone(result["openPosition"])
        self.assertEqual(result["termination"]["cancelledOrder"], {"action": "ENTRY", "side": "long", "signalBar": 2, "signalTime": "2024-01-01T03:00:00Z"})

    def test_determinism_hash_metadata_neutrality_and_decimal_isolation(self):
        value = execution_request((100, 103, 107))
        expected = execute(value)
        encoded = encode_result(expected, Budget())
        with localcontext() as context:
            context.prec = 6
            self.assertEqual(encode_result(execute(value), Budget()), encoded)
            self.assertEqual(context.prec, 6)
            self.assertEqual(decimal_text(D("123456789.12345678")), "123456789.12345678")
        identity = expected.pop("resultHash")
        self.assertEqual(identity, hashlib.sha256(canonical(expected).encode("utf-8")).hexdigest())
        value["dsl"]["labels"] = ["ICT", "Wyckoff", "Dow", "custom"]
        changed = execute(value)
        for key in ("bars", "events", "trades", "metrics"):
            self.assertEqual(changed[key], expected[key])
        self.assertNotEqual(changed["runCard"]["dslHash"], expected["runCard"]["dslHash"])

    def test_concurrent_independent_runs(self):
        payload = raw(request(tuple(100 + i % 7 for i in range(60)), "indicator-trend"))
        expected = run(payload)
        with ThreadPoolExecutor(max_workers=4) as pool:
            self.assertTrue(all(result == expected for result in pool.map(run, [payload] * 12)))

    def test_maximum_candles_indicators_and_lag_are_bounded(self):
        value = request((100,) * 5000)
        value["dsl"]["indicators"] = [{"id": "s" + str(i), "type": "SMA", "source": series(lag=2000), "period": 2000} for i in range(32)]
        result = execute(value)
        self.assertEqual(len(result["bars"]), 5000)
        self.assertEqual(result["runCard"]["minimumBars"], 4000)
        self.assertIsNone(result["bars"][3998]["indicators"]["s31"])
        self.assertEqual(result["bars"][3999]["indicators"]["s31"], "100")
        self.assertLess(len(encode_result(result, Budget())), 32 * 1024 * 1024)

    def test_work_deadline_and_output_limit_fail_closed(self):
        for budget, code in ((Budget(operations=1), "WORK_LIMIT"), (Budget(seconds=-1), "TIME_LIMIT")):
            with self.assertRaisesRegex(EngineError, code):
                run(raw(request()), budget)
        with patch("aitrading_engine.engine.MAX_OUTPUT", 2), self.assertRaisesRegex(EngineError, "OUTPUT_LIMIT"):
            encode_result(execute(request()), Budget())

    def test_real_worker_protocol_no_arguments_or_payload_leak(self):
        launcher = str(ROOT / "python/run_backtest.py")
        for payload, args, success, code in ((raw(request()), [], True, None),
                                           (b'{"secret":"DO_NOT_ECHO"}', [], False, "REQUEST_FIELDS"),
                                           (b'{"a":1,"a":2}', [], False, "DUPLICATE_KEY"),
                                           (b"", ["../../secret;whoami"], False, "ARGUMENTS_NOT_SUPPORTED"),
                                           (b" " * (MAX_INPUT + 1), [], False, "INPUT_LIMIT")):
            process = subprocess.run([sys.executable, "-I", launcher, *args], input=payload, capture_output=True, timeout=30)
            self.assertEqual(process.stderr, b"")
            self.assertEqual(process.returncode, 0 if success else 2)
            response = json.loads(process.stdout)
            self.assertEqual(response["ok"], success)
            if not success:
                self.assertEqual(response, {"ok": False, "error": {"code": code}})
                self.assertNotIn(b"DO_NOT_ECHO", process.stdout)

    def test_inert_malicious_metadata_never_executes(self):
        value = request()
        value["dsl"]["name"] = "<script>fetch('https://127.0.0.1')</script>; __import__('os').system('whoami'); ../secret"
        result = execute(value)
        self.assertIn("__import__", result["runCard"]["canonicalDsl"])
        value["dataset"]["path"] = "../../secrets"
        with self.assertRaisesRegex(EngineError, "DATASET_FIELDS"):
            execute(value)


if __name__ == "__main__":
    unittest.main()
