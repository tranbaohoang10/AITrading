"""Independent Decimal/UTF-8 implementation of aitrading-canonical-1, no deps.

Checks committed golden hashes; never rewrites the expected results. This does
not replace structural/semantic validation, which the Java suite also runs.
"""
from decimal import Decimal
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'backend/src/test/resources/dsl'


def canonical(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, Decimal):
        return '0' if value == 0 else format(value.normalize(), 'f')
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    if isinstance(value, list):
        return '[' + ','.join(map(canonical, value)) + ']'
    return '{' + ','.join(canonical(k) + ':' + canonical(value[k]) for k in sorted(value)) + '}'


def main():
    goldens = json.loads((FIXTURES / 'goldens.json').read_text(encoding='utf-8'))
    assert len(goldens) == 6, 'All neutral family fixtures must remain covered'
    for name, expected in goldens.items():
        value = json.loads((FIXTURES / (name + '.json')).read_text(encoding='utf-8'), parse_float=Decimal, parse_int=Decimal)
        encoded = canonical(value).encode('utf-8')
        assert hashlib.sha256(encoded).hexdigest() == expected['hash'], name
        assert encoded.decode('utf-8') == expected['canonicalJson'], name
    print('PASS: 6 independent Decimal/UTF-8 canonical golden fixtures')


if __name__ == '__main__':
    main()
