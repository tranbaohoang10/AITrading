"""Causal v1 series; no write to an index earlier than confirmation."""
from collections import deque
from decimal import Decimal as D
import operator

OPS = {"gt": operator.gt, "gte": operator.ge, "lt": operator.lt,
       "lte": operator.le, "eq": operator.eq, "neq": operator.ne}


def smooth(source, period, mode, budget):
    values, window, extremes = [], deque(), deque()
    total, previous = D(0), None
    alpha = D(2) / (period + 1) if mode == "EMA" else D(1) / period
    for index, value in enumerate(source):
        budget.spend()
        if value is None:
            window.clear()
            extremes.clear()
            total, previous = D(0), None
            values.append(None)
            continue
        window.append(value)
        total += value
        if len(window) > period:
            total -= window.popleft()
        if mode in ("HIGHEST", "LOWEST"):
            while extremes and (extremes[-1][1] <= value if mode == "HIGHEST" else extremes[-1][1] >= value):
                budget.spend()
                extremes.pop()
            extremes.append((index, value))
            while extremes and extremes[0][0] <= index - period:
                extremes.popleft()
        if len(window) < period:
            values.append(None)
            continue
        if mode in ("HIGHEST", "LOWEST"):
            result = extremes[0][1]
        elif mode == "SMA" or previous is None:
            result = total / period
        else:
            result = previous + alpha * (value - previous)
        values.append(result)
        previous = result
    return values


class IndicatorEvaluator:
    def __init__(self, strategy, candles, budget):
        self.candles, self.budget = candles, budget
        self.values, self.confirmations = {}, {}
        definitions = {v["id"]: v for v in strategy.document["indicators"]}
        for identity in strategy.order:
            node = definitions[identity]
            kind = node["type"]
            if kind in ("PIVOT_HIGH", "PIVOT_LOW"):
                left, right = int(node["left"]), int(node["right"])
                field = "high" if kind == "PIVOT_HIGH" else "low"
                values, points, recent = [], [], None
                for i in range(len(candles)):
                    budget.spend()
                    pivot = i - right
                    point = None
                    if pivot >= left:
                        candidate = candles[pivot][field]
                        budget.spend(left + right + 1)
                        if all(j == pivot or (candidate > candles[j][field] if kind == "PIVOT_HIGH" else candidate < candles[j][field]) for j in range(pivot - left, i + 1)):
                            recent = candidate
                            point = (pivot, candidate)
                    values.append(recent)
                    points.append(point)
                self.confirmations[identity] = points
            elif kind == "TRENDLINE":
                recent, values = deque(maxlen=2), []
                for i, point in enumerate(self.confirmations[node["pivotRef"]]):
                    budget.spend()
                    if point is not None:
                        recent.append(point)
                    if len(recent) < 2:
                        values.append(None)
                    else:
                        (x1, y1), (x2, y2) = recent
                        values.append(y2 + (y2 - y1) * (i - x2) / (x2 - x1))
            elif kind == "ATR":
                source = [None]
                for i in range(1, len(candles)):
                    budget.spend()
                    row, last = candles[i], candles[i - 1]["close"]
                    source.append(max(row["high"] - row["low"], abs(row["high"] - last), abs(row["low"] - last)))
                values = smooth(source, int(node["period"]), "WILDER", budget)
            else:
                source = [self.operand(node["source"], i) for i in range(len(candles))]
                period = int(node["period"])
                if kind == "RSI":
                    gains, losses = [None], [None]
                    for i in range(1, len(source)):
                        budget.spend()
                        change = None if source[i] is None or source[i - 1] is None else source[i] - source[i - 1]
                        gains.append(None if change is None else max(change, D(0)))
                        losses.append(None if change is None else max(-change, D(0)))
                    avg_gain, avg_loss = smooth(gains, period, "WILDER", budget), smooth(losses, period, "WILDER", budget)
                    values = []
                    for gain, loss in zip(avg_gain, avg_loss):
                        budget.spend()
                        values.append(None if gain is None or loss is None else D(50) if gain == loss == 0 else D(100) if loss == 0 else D(0) if gain == 0 else D(100) - D(100) / (1 + gain / loss))
                else:
                    values = smooth(source, period, kind, budget)
            self.values[identity] = values

    def operand(self, node, index):
        self.budget.spend()
        if index < 0:
            return None
        kind = node["kind"]
        if kind == "constant":
            return node["value"]
        at = index - int(node["lag"])
        if at < 0:
            return None
        return self.candles[at][node["field"]] if kind == "series" else self.values[node["id"]][at]

    def condition(self, node, index):
        self.budget.spend()
        if node is None:
            return None
        kind = node["kind"]
        if kind == "not":
            child = self.condition(node["child"], index)
            return None if child is None else not child
        if kind in ("all", "any"):
            children = [self.condition(child, index) for child in node["children"]]
            if kind == "all":
                return False if False in children else None if None in children else True
            return True if True in children else None if None in children else False
        left, right = self.operand(node["left"], index), self.operand(node["right"], index)
        if left is None or right is None:
            return None
        if kind == "compare":
            return OPS[node["op"]](left, right)
        before_left, before_right = self.operand(node["left"], index - 1), self.operand(node["right"], index - 1)
        if before_left is None or before_right is None:
            return None
        return (left > right and before_left <= before_right) if node["direction"] == "above" else (left < right and before_left >= before_right)
