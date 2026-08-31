"""Compile generated research fixtures with official MetaEditor, not a substitute.

This is developer verification only. It never launches a trading terminal, sends
orders or claims runtime/event validation. Java generator tests must run first.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--compiler', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    compiler = args.compiler.resolve(strict=True)
    if compiler.name.lower() != 'metaeditor64.exe':
        raise ValueError('Official MetaEditor64 compiler required')
    expected = sorted((ROOT / 'backend/src/test/resources/pine').glob('*.json'))
    if len(expected) != 8:
        raise ValueError('Expected eight shared synthetic fixtures')
    (ROOT / 'tmp').mkdir(exist_ok=True)
    owned = Path(tempfile.mkdtemp(prefix='mql5-compile-', dir=ROOT / 'tmp'))
    results = []
    for fixture in expected:
        source = ROOT / 'backend/build/reports/mql5' / (fixture.stem + '.mq5')
        code = source.read_text(encoding='utf-8').replace('\r\n', '\n')
        # No private strategies or user filenames; fixed synthetic fixture names.
        target = owned / source.name
        target.write_text(code, encoding='utf-8', newline='\n')
        process = subprocess.run([str(compiler), '/portable', '/compile:' + str(target), '/log'],
            timeout=45, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), check=False)
        log = target.with_suffix('.log')
        raw = log.read_bytes()
        text = raw.decode('utf-16') if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else raw.decode('utf-8-sig')
        result = re.findall(r'Result: (\d+) errors, (\d+) warnings[^\r\n]*', text)
        artifact = target.with_suffix('.ex5')
        passed = result == [('0', '0')] and artifact.is_file() and artifact.stat().st_size > 0
        results.append({'fixture': fixture.stem, 'codeHash': hashlib.sha256(code.encode()).hexdigest(),
            'processExitCode': process.returncode, 'diagnostics': text, 'compilerPassed': passed,
            'runtimeStatus': 'NOT_RUN', 'executableHash': hashlib.sha256(artifact.read_bytes()).hexdigest() if artifact.is_file() else None})
    report = {'compiler': str(compiler), 'compilerHash': hashlib.sha256(compiler.read_bytes()).hexdigest(),
        'ownedDirectory': str(owned), 'officialCompilationPassed': all(r['compilerPassed'] for r in results),
        'officialRuntimeStatus': 'NOT_RUN', 'fixtures': results}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'compiled': len(results), 'passed': report['officialCompilationPassed'], 'runtime': 'NOT_RUN'}))
    if not report['officialCompilationPassed']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
