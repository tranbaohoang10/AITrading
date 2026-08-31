"""Reproducible synthetic PB-012 UI fixtures from the unchanged PB-010 engine."""
import argparse
import copy
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'python'))
from aitrading_engine.engine import run  # noqa: E402


def fixtures():
    base = json.loads((ROOT / 'python/examples/long-next-open.json').read_text())
    cases = {}
    for name in ('win', 'zero', 'loss', 'open', 'negative', 'protective'):
        value = copy.deepcopy(base)
        if name == 'zero':
            value['dsl']['rules']['longEntry']['right']['value'] = 10000
        if name == 'open':
            value['dsl']['rules']['longExit'] = None
        if name in ('loss', 'negative', 'protective'):
            candle = value['dataset']['candles'][-1]
            for key in ('open', 'high', 'low', 'close'):
                candle[key] = '1' if name == 'negative' else '90'
        if name == 'negative':
            value['dsl']['risk']['leverage'] = 10
            value['dsl']['risk']['stopLossPct'] = 10
        if name == 'protective':
            value['dsl']['rules']['longExit'] = None
            value['dsl']['risk']['stopLossPct'] = 5
        result = run(json.dumps(value).encode())
        expected = {'win': '100', 'zero': '0', 'loss': '-100', 'open': '100', 'negative': '-9900', 'protective': '-100'}[name]
        assert result['metrics']['netProfit'] == expected
        cases[name] = {'input': value, 'result': result}
    return json.dumps(cases, ensure_ascii=False, indent=2) + '\n'


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    target = ROOT / 'frontend/src/backtest/test-fixtures.json'
    expected = fixtures()
    if args.check:
        assert target.read_text(encoding='utf-8') == expected, 'UI fixtures differ from engine'
        print('PASS: six hand-checked synthetic UI fixtures match engine')
    else:
        target.write_text(expected, encoding='utf-8')
