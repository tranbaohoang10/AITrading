"""Actual HTTP/Python/PostgreSQL notification/read-state/restart proof on owned test data."""
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
    parser.add_argument('--browser-fixture', action='store_true', help='Known synthetic local account, never production credentials')
    args = parser.parse_args()
    owned, report = Path(args.owned).resolve(), Path(args.report).resolve()
    if owned.parent != (ROOT / 'tmp').resolve() or not owned.name.startswith('pg-test-') or not (owned / 'data/PG_VERSION').is_file() or not (owned / 'password').is_file():
        raise RuntimeError('Active owned test harness required')
    if not report.is_relative_to(ROOT):
        raise RuntimeError('Report must remain in repository')
    client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    account = None

    def call(method, route, body=None, expected=200, form=False):
        headers = {'X-Workspace-User': account} if account else {}
        if method not in ('GET', 'HEAD'):
            token = call('GET', '/auth/csrf')
            headers[token['headerName']] = token['token']
        raw = None
        if body is not None:
            headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
            raw = urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode()
        req = urllib.request.Request(BASE + route, data=raw, headers=headers, method=method)
        try:
            response = client.open(req, timeout=8)
        except urllib.error.HTTPError as failure:
            if failure.code != expected:
                raise RuntimeError(f'Unexpected HTTP {failure.code}, expected {expected}') from None
            response = failure
        with response:
            if response.status != expected:
                raise RuntimeError('Unexpected success status')
            data = response.read(65537)
            if len(data) > 65536:
                raise RuntimeError('Response bound')
            return json.loads(data) if data else None

    call('GET', '/health')
    email = 'pb022-a@example.test' if args.browser_fixture else f'notification-smoke-{uuid.uuid4().hex}@example.test'
    password = 'Synthetic PB022 browser only!' if args.browser_fixture else secrets.token_urlsafe(32)
    call('POST', '/auth/register', {'email': email, 'displayName': 'Synthetic notification researcher', 'password': password}, 202)
    call('POST', '/auth/login', {'email': email, 'password': password}, 204, True)
    del password
    account = call('GET', '/auth/me')['id']
    sample = json.loads((ROOT / 'python/examples/long-next-open.json').read_text(encoding='utf-8'))
    strategy = call('POST', '/strategies', {'requestId': str(uuid.uuid4()), 'title': 'Synthetic notification strategy'})
    call('POST', '/strategies/' + strategy['strategyId'] + '/versions', {'requestId': str(uuid.uuid4()), 'expectedRevision': 1,
        'title': 'Synthetic notification strategy', 'draftText': json.dumps(sample['dsl']), 'mode': 'VALIDATED'})
    columns = ('timestamp', 'open', 'high', 'low', 'close', 'volume')
    csv = ','.join(columns) + '\n' + ''.join(','.join(c[k] for k in columns) + '\n' for c in sample['dataset']['candles'])
    dataset = call('POST', '/datasets/import', {'requestId': str(uuid.uuid4()), 'name': 'Synthetic notification data', 'symbol': 'TEST_USD',
        'timeframe': '1h', 'sourceKind': 'SYNTHETIC', 'sourceLabel': 'Local hand fixture', 'csv': csv})
    jobs = []
    requests = []
    for _ in range(2):
        body = {'requestId': str(uuid.uuid4()), 'strategyId': strategy['strategyId'], 'revision': 2, 'datasetId': dataset['id']}
        job = call('POST', '/backtests', body)
        deadline = time.monotonic() + 35
        while time.monotonic() < deadline:
            job = call('GET', '/backtests/' + job['id'])
            if job['state'] not in ('QUEUED', 'RUNNING'):
                break
            time.sleep(.2)
        assert job['state'] == 'SUCCEEDED' and job['resultHash'] == 'b04fd6e6beb34cea4e48d341fe1057854d82da10d6059ccfbded44fa48353494'
        jobs.append(job); requests.append(body)
    page = call('GET', '/backtests/notifications')
    assert len(page['items']) == 2 and page['unreadCount'] == 2
    assert {n['jobId'] for n in page['items']} == {j['id'] for j in jobs}
    first = next(n for n in page['items'] if n['jobId'] == jobs[0]['id'])
    read = call('POST', '/backtests/notifications/' + first['id'] + '/read', {})
    assert read['readAt'] is not None and call('POST', '/backtests/notifications/' + first['id'] + '/read', {}) == read
    call('POST', '/backtests', requests[1])
    call('DELETE', '/backtests/' + jobs[0]['id'], {}, 204)
    before = call('GET', '/backtests/notifications')
    assert len(before['items']) == 2 and before['unreadCount'] == 1
    assert email not in json.dumps(before) and 'Synthetic notification strategy' not in json.dumps(before)
    (owned / 'restart-api').touch(exist_ok=False)
    deadline, saw_down = time.monotonic() + 45, False
    while time.monotonic() < deadline:
        try:
            call('GET', '/health')
            if saw_down:
                break
        except (OSError, RuntimeError):
            saw_down = True
        time.sleep(.2)
    else:
        raise RuntimeError('API down/up not observed')
    assert call('GET', '/auth/me')['id'] == account
    assert call('GET', '/backtests/notifications') == before
    assert call('POST', '/backtests/notifications/' + first['id'] + '/read', {}) == read
    call('POST', '/auth/logout', {}, 204)
    call('GET', '/backtests/notifications', expected=401)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({'passed': True, 'synthetic': True, 'realHttpPythonPostgres': True, 'actualApiDownUpObserved': saw_down,
        'sessionAndUnreadReadStateSurvivedRestart': True, 'stableReadReplay': True, 'terminalReplayNoDuplicate': True,
        'jobDeletionPreservesNotification': True, 'browserFixture': args.browser_fixture, 'page': before}, indent=2) + '\n', encoding='utf-8')
    print('PASS: actual Python completions, unique notifications/read replay, job deletion and API restart with the same PostgreSQL data; synthetic account signed out.')


if __name__ == '__main__':
    main()
