"""Revalidate closed trusted DSL schema plus semantic units/DAG and OHLCV.

No supplied schema, hash, file path, executable expression or validation flag is
accepted. The schema location is fixed relative to this repository package.
"""
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import json
from pathlib import Path
import re

from .common import EngineError, canonical, decimal_text, digest

D = Decimal
MAX_INPUT = 2 * 1024 * 1024
TF = {"1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400}
FIELDS = ("open", "high", "low", "close", "volume")
SCHEMA_PATH = Path(__file__).resolve().parents[2] / "backend/src/main/resources/dsl/strategy-1.0.0.schema.json"
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"), parse_int=D, parse_float=D)


def require(condition, code):
    if not condition:
        raise EngineError(code)


def safe_text(text):
    return len(text) <= 4096 and all(not (ord(c) < 32 or 127 <= ord(c) <= 159 or 0xD800 <= ord(c) <= 0xDFFF) for c in text)


def number(text):
    require(len(text) <= 64, "NUMBER_LIMIT")
    try:
        value = D(text)
    except InvalidOperation:
        raise EngineError("NUMBER_LIMIT") from None
    require(value.is_finite() and abs(value) <= D("1e12"), "NUMBER_LIMIT")
    digits = list(value.as_tuple().digits)
    scale = -value.as_tuple().exponent
    while digits and digits[-1] == 0:
        digits.pop()
        scale -= 1
    require(not digits or scale <= 8, "NUMBER_LIMIT")
    return value


def pairs(values):
    result = {}
    for key, value in values:
        require(key not in result, "DUPLICATE_KEY")
        result[key] = value
    return result


def bad_constant(_):
    raise EngineError("NUMBER_LIMIT")


def bounded(value, budget, max_values, depth=24):
    remaining = max_values

    def visit(node, level):
        nonlocal remaining
        budget.spend()
        remaining -= 1
        require(remaining >= 0 and level <= depth, "TREE_LIMIT")
        if isinstance(node, str):
            require(safe_text(node), "TEXT_LIMIT")
        elif isinstance(node, dict):
            require(all(safe_text(k) for k in node), "TEXT_LIMIT")
            for child in node.values():
                visit(child, level + 1)
        elif isinstance(node, list):
            for child in node:
                visit(child, level + 1)

    visit(value, 0)


def parse(raw, budget):
    require(isinstance(raw, bytes) and len(raw) <= MAX_INPUT, "INPUT_LIMIT")
    try:
        value = json.loads(raw.decode("utf-8"), parse_int=number, parse_float=number,
                           parse_constant=bad_constant, object_pairs_hook=pairs)
    except (ValueError, UnicodeError, RecursionError, InvalidOperation):
        raise EngineError("MALFORMED_JSON") from None
    bounded(value, budget, 50_000, 26)
    return value


def object_fields(value, fields, code):
    require(isinstance(value, dict) and set(value) == set(fields), code)


def same(a, b):
    # Python bool is an int subclass; JSON boolean must never satisfy numeric const.
    return type(a) is type(b) and a == b


def schema_supported(schema):
    allowed = {"$schema", "$id", "title", "$defs", "type", "const", "enum", "properties",
               "required", "additionalProperties", "items", "minItems", "maxItems",
               "minLength", "maxLength", "pattern", "minimum", "maximum", "multipleOf", "oneOf", "$ref"}
    require(not (set(schema) - allowed), "SCHEMA_CONFIGURATION")
    if "$ref" in schema:
        require(schema["$ref"] in {"#/$defs/" + k for k in SCHEMA["$defs"]}, "SCHEMA_CONFIGURATION")
    if "pattern" in schema:
        require(schema["pattern"] in {"^[a-z][a-z0-9_]{0,31}$", "^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$"}, "SCHEMA_CONFIGURATION")
    for field in ("properties", "$defs"):
        for child in schema.get(field, {}).values():
            schema_supported(child)
    for child in schema.get("oneOf", []):
        schema_supported(child)
    if "items" in schema:
        schema_supported(schema["items"])


schema_supported(SCHEMA)


def conforms(value, schema, budget):
    budget.spend()
    if "$ref" in schema:
        return conforms(value, SCHEMA["$defs"][schema["$ref"].split("/")[-1]], budget)
    if "const" in schema and not same(value, schema["const"]):
        return False
    if "enum" in schema and not any(same(value, candidate) for candidate in schema["enum"]):
        return False
    if "oneOf" in schema:
        return sum(conforms(value, branch, budget) for branch in schema["oneOf"]) == 1
    kind = schema.get("type")
    matches = {"object": isinstance(value, dict), "array": isinstance(value, list),
               "string": isinstance(value, str), "number": isinstance(value, D),
               "integer": isinstance(value, D) and value == value.to_integral_value(), "null": value is None}
    if kind and not matches[kind]:
        return False
    if isinstance(value, dict):
        if not set(schema.get("required", [])) <= set(value):
            return False
        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False and set(value) - set(properties):
            return False
        return all(conforms(child, properties[key], budget) for key, child in value.items())
    if isinstance(value, list):
        return schema.get("minItems", 0) <= len(value) <= schema.get("maxItems", 10000) and all(conforms(v, schema["items"], budget) for v in value)
    if isinstance(value, str):
        return (schema.get("minLength", 0) <= len(value) <= schema.get("maxLength", 4096)
                and ("pattern" not in schema or re.fullmatch(schema["pattern"], value) is not None))
    if isinstance(value, D):
        return (schema.get("minimum", -D("1e12")) <= value <= schema.get("maximum", D("1e12"))
                and ("multipleOf" not in schema or value % schema["multipleOf"] == 0))
    return True


@dataclass(frozen=True)
class ValidatedStrategy:
    document: dict
    canonical: str
    hash: str
    minimum_bars: int
    order: tuple


def strategy(root, budget):
    bounded(root, budget, 2048)
    require(conforms(root, SCHEMA, budget), "DSL_SCHEMA")
    definitions = {v["id"]: v for v in root["indicators"]}
    require(len(definitions) == len(root["indicators"]), "DUPLICATE_ID")
    computed, visiting, order = {}, set(), []
    conditions = 0

    def operand(node):
        kind = node["kind"]
        if kind == "constant":
            return "CONSTANT", 1
        if kind == "series":
            return ("VOLUME" if node["field"] == "volume" else "PRICE"), 1 + int(node["lag"])
        unit, bars = indicator(node["id"])
        return unit, bars + int(node["lag"])

    def indicator(identity):
        budget.spend()
        if identity in computed:
            return computed[identity]
        require(identity in definitions, "MISSING_REFERENCE")
        require(identity not in visiting, "REFERENCE_CYCLE")
        visiting.add(identity)
        node = definitions[identity]
        kind = node["type"]
        if kind in ("PIVOT_HIGH", "PIVOT_LOW"):
            result = "PRICE", int(node["left"] + node["right"]) + 1
        elif kind == "TRENDLINE":
            ref = node["pivotRef"]
            require(ref in definitions and definitions[ref]["type"] in ("PIVOT_HIGH", "PIVOT_LOW"), "PIVOT_REFERENCE_REQUIRED")
            result = "PRICE", indicator(ref)[1] + 1
        elif kind == "ATR":
            result = "PRICE", int(node["period"]) + 1
        else:
            unit, bars = operand(node["source"])
            require(unit != "CONSTANT", "SERIES_SOURCE_REQUIRED")
            require(kind != "RSI" or unit == "PRICE", "PRICE_SOURCE_REQUIRED")
            result = ("OSCILLATOR" if kind == "RSI" else unit), bars + int(node["period"]) - (0 if kind == "RSI" else 1)
        visiting.remove(identity)
        computed[identity] = result
        order.append(identity)
        return result

    def condition(node, depth=1):
        nonlocal conditions
        budget.spend()
        conditions += 1
        require(conditions <= 128 and depth <= 8, "CONDITION_LIMIT")
        kind = node["kind"]
        if kind in ("all", "any"):
            return max(condition(v, depth + 1) for v in node["children"])
        if kind == "not":
            return condition(node["child"], depth + 1)
        left, right = operand(node["left"]), operand(node["right"])
        require(left[0] != "CONSTANT" or right[0] != "CONSTANT", "MEASURABLE_OPERAND_REQUIRED")
        require(left[0] == right[0] or "CONSTANT" in (left[0], right[0]), "UNIT_MISMATCH")
        return max(left[1], right[1]) + (1 if kind == "cross" else 0)

    bars = max([1] + [indicator(k)[1] for k in definitions])
    rules = root["rules"]
    require(rules["longEntry"] is not None or rules["shortEntry"] is not None, "ENTRY_REQUIRED")
    for side in ("long", "short"):
        require(rules[side + "Entry"] is not None or rules[side + "Exit"] is None, "DISABLED_SIDE_EXIT")
    for node in rules.values():
        if node is not None:
            bars = max(bars, condition(node))
    require(bars <= 10000, "WARMUP_LIMIT")
    require(root["risk"]["leverage"] * root["risk"]["stopLossPct"] <= 100, "LEVERAGED_STOP_LIMIT")
    encoded = canonical(root)
    require(len(encoded.encode("utf-8")) <= 65536, "DSL_SIZE_LIMIT")
    return ValidatedStrategy(root, encoded, digest(encoded), bars, tuple(order))


def timestamp(text):
    require(isinstance(text, str) and re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z", text), "TIMESTAMP")
    try:
        parsed = datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        raise EngineError("TIMESTAMP") from None
    require(1970 <= parsed.year <= 2100, "TIMESTAMP")
    return int(parsed.timestamp())


def time_text(seconds):
    return datetime.fromtimestamp(seconds, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass(frozen=True)
class Dataset:
    candles: tuple
    interval: int
    hash: str
    metadata: dict


def dataset(value, market, budget):
    object_fields(value, ("symbol", "timeframe", "timezone", "sourceType", "closedThrough", "candles"), "DATASET_FIELDS")
    require(all(value[k] == market[k] for k in ("symbol", "timeframe", "timezone")), "MARKET_MISMATCH")
    require(value["sourceType"] in ("USER_UPLOAD", "SYNTHETIC"), "SOURCE_TYPE")
    interval = TF[market["timeframe"]]
    cutoff = timestamp(value["closedThrough"])
    rows = value["candles"]
    require(isinstance(rows, list) and 1 <= len(rows) <= 5000, "CANDLE_COUNT")
    candles, lines, previous = [], [], None
    for row in rows:
        budget.spend()
        object_fields(row, ("timestamp", *FIELDS), "CANDLE_FIELDS")
        current = timestamp(row["timestamp"])
        require(current % interval == 0, "TIME_ALIGNMENT")
        require(current + interval <= cutoff, "OPEN_CANDLE")
        require(previous is None or current - previous == interval, "NONCONTIGUOUS_DATA")
        numbers = {}
        for field in FIELDS:
            text = row[field]
            require(isinstance(text, str) and re.fullmatch(r"[0-9]{1,13}(\.[0-9]{1,8})?", text), "CANDLE_NUMBER")
            numbers[field] = D(text)
            require(numbers[field] <= D("1e12") and (field == "volume" or numbers[field] > 0), "CANDLE_NUMBER")
        require(numbers["low"] <= numbers["open"] <= numbers["high"] and numbers["low"] <= numbers["close"] <= numbers["high"], "OHLC_RANGE")
        candles.append({"time": current, **numbers})
        lines.append(row["timestamp"] + "," + ",".join(decimal_text(numbers[k]) for k in FIELDS) + "\n")
        previous = current
    data_hash = digest("ohlcv-v1\n" + market["symbol"] + "\n" + market["timeframe"] + "\nUTC\n" + "".join(lines))
    metadata = {k: value[k] for k in ("symbol", "timeframe", "timezone", "sourceType", "closedThrough")}
    metadata.update({"dataHash": data_hash, "count": len(rows), "start": rows[0]["timestamp"], "end": rows[-1]["timestamp"], "sourceVerified": False})
    return Dataset(tuple(candles), interval, data_hash, metadata)
