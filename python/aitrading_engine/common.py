"""Fixed budgets, decimal serialization and safe failures; no application I/O."""
from decimal import Decimal
import hashlib
import json
import time


class EngineError(Exception):
    """Only fixed, implementation-owned codes may cross the worker boundary."""

    def __init__(self, code):
        self.code = code
        super().__init__(code)


class Budget:
    def __init__(self, operations=5_000_000, seconds=15):
        self.remaining = operations
        self.deadline = time.monotonic() + seconds

    def spend(self, amount=1):
        self.remaining -= amount
        if self.remaining < 0:
            raise EngineError("WORK_LIMIT")
        if time.monotonic() > self.deadline:
            raise EngineError("TIME_LIMIT")


def decimal_text(value):
    # Formatting must not normalize through an ambient, lower-precision context.
    if isinstance(value, int):
        return str(value)
    if value == 0:
        return "0"
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def canonical(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (Decimal, int)):
        return decimal_text(value)
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, list):
        return "[" + ",".join(map(canonical, value)) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(canonical(k) + ":" + canonical(value[k]) for k in sorted(value)) + "}"
    raise EngineError("INTERNAL_ERROR")


def digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def plain(value):
    """Decimals in results are lossless JSON strings; counters remain integers."""
    if isinstance(value, Decimal):
        return decimal_text(value)
    if isinstance(value, dict):
        return {k: plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [plain(v) for v in value]
    return value
