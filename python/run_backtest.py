"""Fixed stdin/stdout worker. No caller path, command, module or option accepted."""
import sys
from pathlib import Path

# -I ignores cwd/PYTHONPATH and the script directory. Add only this fixed trusted
# package directory, never a caller-supplied path or environment variable.
sys.path.insert(0, str(Path(__file__).resolve().parent))


def main():
    try:
        from aitrading_engine.common import Budget, EngineError
        from aitrading_engine.contract import MAX_INPUT
        from aitrading_engine.engine import encode_result, run
    except Exception:
        sys.stdout.write('{"ok":false,"error":{"code":"INTERNAL_ERROR"}}\n')
        return 3
    try:
        if len(sys.argv) != 1:
            raise EngineError("ARGUMENTS_NOT_SUPPORTED")
        raw = sys.stdin.buffer.read(MAX_INPUT + 1)
        budget = Budget()
        output = encode_result(run(raw, budget), budget)
    except EngineError as failure:
        # Codes originate only from fixed literals in this package, never input.
        sys.stdout.write('{"ok":false,"error":{"code":"' + failure.code + '"}}\n')
        return 2
    except Exception:
        sys.stdout.write('{"ok":false,"error":{"code":"INTERNAL_ERROR"}}\n')
        return 3
    sys.stdout.buffer.write(output + b"\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
