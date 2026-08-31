"""PB-011 synthetic HTTP smoke/restart against test_backend.py --serve ONLY.

Requires the explicit owned tmp/pg-test-* directory, never a user database or
remote server. Generates an ephemeral synthetic account password in memory and
prints only sanitized assertions. Leaves test data in the owned disposable DB.
"""
import argparse
import http.cookiejar
import json
from pathlib import Path
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:8080/api'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--owned', required=True)
    parser.add_argument('--report', required=True)
    args = parser.parse_args()
    owned = Path(args.owned).resolve()
    if owned.parent != (ROOT / 'tmp').resolve() or not owned.name.startswith('pg-test-') or not (owned / 'data/PG_VERSION').is_file() or not (owned / 'password').is_file():
        raise RuntimeError('An active test-harness-owned cluster is required')
    report = Path(args.report).resolve()
    if not report.is_relative_to(ROOT):
        raise RuntimeError('Report must stay in the repository')
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(method, route, body=None, expected=200, form=False):
        headers = {}
        if method not in ('GET', 'HEAD'):
            token = call('GET', '/auth/csrf')
            headers[token['headerName']] = token['token']
        raw = None
        if body is not None:
            headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
            raw = urllib.parse.urlencode(body).encode() if form else json.dumps(body, ensure_ascii=False).encode()
        request = urllib.request.Request(BASE + route, data=raw, headers=headers, method=method)
        try:
            response = client.open(request, timeout=8)
        except urllib.error.HTTPError as response:
            if response.code != expected:
                raise RuntimeError(f'Unexpected HTTP status {response.code} on {method} {route.split("?")[0]}') from None
            return None
        with response:
            if response.status != expected:
                raise RuntimeError('Unexpected success status')
            data = response.read(34 * 1024 * 1024)
            return json.loads(data) if data else None

    def wait_job(identity):
        deadline = time.monotonic() + 35
        while time.monotonic() < deadline:
            job = call('GET', '/backtests/' + identity)
            if job['state'] not in ('QUEUED', 'RUNNING'):
                return job
            time.sleep(.2)
        raise RuntimeError('Job did not reach terminal state')

    call('GET', '/health')
    email = f'job-smoke-{uuid.uuid4().hex}@example.test'
    password = secrets.token_urlsafe(32)
    call('POST', '/auth/register', {'email': email, 'displayName': 'Synthetic job restart smoke', 'password': password}, expected=202)
    call('POST', '/auth/login', {'email': email, 'password': password}, expected=204, form=True)
    del password
    assert call('GET', '/backtests/capabilities')['configured'] is True
    sample = json.loads((ROOT / 'python/examples/long-next-open.json').read_text(encoding='utf-8'))
    strategy = call('POST', '/strategies', {'requestId': str(uuid.uuid4()), 'title': 'Synthetic restart strategy'})
    revision = call('POST', '/strategies/' + strategy['strategyId'] + '/versions',
                    {'requestId': str(uuid.uuid4()), 'expectedRevision': 1, 'title': 'Synthetic restart strategy', 'draftText': json.dumps(sample['dsl']), 'mode': 'VALIDATED'})
    columns = ('timestamp', 'open', 'high', 'low', 'close', 'volume')
    csv = ','.join(columns) + '\n' + ''.join(','.join(c[k] for k in columns) + '\n' for c in sample['dataset']['candles'])
    dataset = call('POST', '/datasets/import', {'requestId': str(uuid.uuid4()), 'name': 'Synthetic restart data', 'symbol': 'TEST_USD', 'timeframe': '1h', 'sourceKind': 'SYNTHETIC', 'sourceLabel': 'Local hand fixture', 'csv': csv})
    request = {'requestId': str(uuid.uuid4()), 'strategyId': strategy['strategyId'], 'revision': 2, 'datasetId': dataset['id']}
    job = call('POST', '/backtests', request)
    done = wait_job(job['id'])
    assert done['state'] == 'SUCCEEDED', done['errorCode']
    result = call('GET', '/backtests/' + job['id'] + '/result')
    assert result['metrics']['netProfit'] == '100' and result['metrics']['closedTrades'] == 1
    assert result['resultHash'] == done['resultHash'] == 'b04fd6e6beb34cea4e48d341fe1057854d82da10d6059ccfbded44fa48353494'
    assert call('POST', '/backtests', request)['id'] == job['id']
    call('DELETE', '/strategies/' + strategy['strategyId'], {'expectedRevision': revision['revision']}, expected=204)
    call('DELETE', '/datasets/' + dataset['id'], {'expectedDataHash': dataset['dataHash']}, expected=204)
    (owned / 'restart-api').touch(exist_ok=False)
    deadline, saw_down = time.monotonic() + 40, False
    while time.monotonic() < deadline:
        try:
            call('GET', '/health')
            if saw_down:
                break
        except (OSError, RuntimeError):
            saw_down = True
        time.sleep(.2)
    else:
        raise RuntimeError('Actual API restart was not observed')
    restored = call('GET', '/backtests/' + job['id'])
    after = call('GET', '/backtests/' + job['id'] + '/result')
    assert restored == done and after == result
    assert call('POST', '/backtests', request)['id'] == job['id']
    call('POST', '/auth/logout', {}, expected=204)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({'passed': True, 'synthetic': True, 'realHttpPythonPostgres': True,
                                  'actualApiDownUpObserved': saw_down, 'sessionAndJobSurvivedRestart': True,
                                  'sourceDeletionPreservesSnapshot': True, 'idempotentReplayAfterSourceDeletion': True,
                                  'resultHash': done['resultHash'], 'inputHash': done['inputHash'],
                                  'netProfit': '100', 'closedTrades': 1}, indent=2) + '\n', encoding='utf-8')
    print('PASS: actual HTTP/Python/PG hand result, source deletion, API restart, session/job/result persistence and replay; synthetic account signed out')


if __name__ == '__main__':
    main()
