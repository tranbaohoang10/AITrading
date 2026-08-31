"""Fixed PB-011 entrypoint. Resource controls are mandatory before engine import."""
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))


def main():
    try:
        from worker_limits import apply_limits
        apply_limits()
    except Exception:
        sys.stdout.write('{"ok":false,"error":{"code":"WORKER_RESOURCE_UNAVAILABLE"}}\n')
        return 3
    from run_backtest import main as run
    return run()


if __name__ == '__main__':
    sys.exit(main())
