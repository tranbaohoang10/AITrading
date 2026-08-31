"""Actual private audit HTTP/PostgreSQL/JVM restart proof on the owned test harness."""
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
            token, _ = call('GET', '/auth/csrf')
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
                raise RuntimeError('Unexpected HTTP success status')
            data = response.read(65537)
            if len(data) > 65536:
                raise RuntimeError('Response limit')
            correlation = response.headers['X-Request-ID']
            uuid.UUID(correlation)
            return json.loads(data) if data else None, correlation

    call('GET', '/health')
    password, email = secrets.token_urlsafe(32), f'audit-smoke-{uuid.uuid4().hex}@example.test'
    call('POST', '/auth/register', {'email': email, 'displayName': 'Synthetic audit restart', 'password': password}, 202)
    call('POST', '/auth/login', {'email': email, 'password': password}, 204, True)
    del password
    account = call('GET', '/auth/me')[0]['id']
    _, correlation = call('PATCH', '/auth/profile', {'displayName': 'Synthetic audit restart saved'})
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        page = call('GET', '/audit')[0]
        if any(e['requestId'] == correlation for e in page['items']):
            break
        time.sleep(.05)
    else:
        raise RuntimeError('Mutation event not persisted')
    event = next(e for e in page['items'] if e['requestId'] == correlation)
    assert event['operation'] == 'PROFILE' and event['httpStatus'] == 200
    assert email not in json.dumps(page) and 'Synthetic audit restart saved' not in json.dumps(page)
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
    assert call('GET', '/auth/me')[0]['id'] == account
    after = call('GET', '/audit')[0]
    assert after == page
    call('POST', '/auth/logout', {}, 204)
    call('GET', '/audit', expected=401)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps({'passed': True, 'synthetic': True, 'realHttpPostgres': True,
        'actualApiDownUpObserved': saw_down, 'sessionAndAuditSurvivedRestart': True,
        'unchangedPageAfterRestart': True, 'serverRequestId': correlation,
        'mutationEvent': event, 'logoutThenPrivateAccessDenied': True}, indent=2) + '\n', encoding='utf-8')
    print('PASS: actual HTTP/PostgreSQL audit correlation, redaction, restart persistence and logout; synthetic account signed out.')


if __name__ == '__main__':
    main()
