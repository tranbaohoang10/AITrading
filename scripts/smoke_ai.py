"""Owned API/PG restart proof; optional real Gemini smoke sends synthetic data only."""
import argparse
import hashlib
import http.cookiejar
import json
import os
import re
from pathlib import Path
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:8080/api'


class Actor:
    def __init__(self):
        self.client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.account = None

    def call(self, method, route, body=None, expected=200, form=False, binding=None, csrf=True):
        headers = {'X-Workspace-User': binding or self.account} if binding or self.account else {}
        if csrf and method not in ('GET', 'HEAD'):
            token = self.call('GET', '/auth/csrf')
            assert token['headerName'] == 'X-CSRF-TOKEN'
            headers[token['headerName']] = token['token']
        raw = None
        if body is not None:
            headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
            raw = urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode()
        request = urllib.request.Request(BASE + route, data=raw, headers=headers, method=method)
        try:
            response = self.client.open(request, timeout=30)
        except urllib.error.HTTPError as failure:
            if failure.code != expected:
                raise RuntimeError(f'Unexpected HTTP {failure.code}, expected {expected}; no raw body logged') from None
            response = failure
        with response:
            if response.status != expected:
                raise RuntimeError('Unexpected success status')
            data = response.read(65537)
            if len(data) > 65536:
                raise RuntimeError('Response bound')
            try:
                return json.loads(data) if data else None
            except (ValueError, UnicodeError):
                raise RuntimeError('Malformed API JSON; no raw body logged') from None

    def register(self):
        email, password = f'ai-smoke-{uuid.uuid4().hex}@example.test', secrets.token_urlsafe(32)
        self.call('POST', '/auth/register', {'email': email, 'displayName': 'Synthetic AI researcher', 'password': password}, 202)
        self.call('POST', '/auth/login', {'email': email, 'password': password}, 204, True)
        self.account = self.call('GET', '/auth/me')['id']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--owned', required=True)
    parser.add_argument('--report', required=True)
    parser.add_argument('--real-gemini', action='store_true', help='Explicit opt-in: server must already have secure Gemini configuration; synthetic prompts only')
    parser.add_argument('--model', default=os.environ.get('AITRADING_AI_MODEL') or 'gemini-3.5-flash')
    args = parser.parse_args()
    if not re.fullmatch(r'gemini-[A-Za-z0-9][A-Za-z0-9.-]{0,111}', args.model) or '..' in args.model:
        raise RuntimeError('Invalid smoke model identifier')
    owned, report = Path(args.owned).resolve(), Path(args.report).resolve()
    if owned.parent != (ROOT / 'tmp').resolve() or not owned.name.startswith('pg-test-') or not (owned / 'data/PG_VERSION').is_file() or not (owned / 'password').is_file():
        raise RuntimeError('Active owned test harness required')
    if not report.is_relative_to(ROOT):
        raise RuntimeError('Report must remain in repository')
    a, b = Actor(), Actor()
    a.call('GET', '/health'); a.register(); b.register()
    try:
        configuration = a.call('GET', '/ai/capabilities')
        assert configuration == {'configured': args.real_gemini, 'provider': 'gemini', 'model': args.model if args.real_gemini else None}
        conversation = a.call('POST', '/conversations', {'requestId': str(uuid.uuid4())})
        route = '/conversations/' + conversation['id']
        # Same-owner and other-owner decoys must never enter this conversation's context.
        decoys = []
        for actor in (a, b):
            decoy = actor.call('POST', '/conversations', {'requestId': str(uuid.uuid4())})
            decoy_route = '/conversations/' + decoy['id']
            marker = 'Synthetic isolated marker ' + uuid.uuid4().hex
            actor.call('POST', decoy_route + '/messages', {'requestId': str(uuid.uuid4()), 'content': marker})
            decoys.append((actor, decoy_route, marker))
        prompt = 'Synthetic research exercise only: explain one limitation of comparing a 5-bar SMA with a 10-bar EMA on invented hourly candles. No real account, market data, trades or personal information. Do not generate code.'
        a.call('POST', route + '/messages', {'requestId': str(uuid.uuid4()), 'content': prompt})
        intent = {'requestId': str(uuid.uuid4()), 'expectedVersion': 2, 'sourceSequence': 1}
        b.call('GET', route + '/messages', expected=404)
        b.call('POST', route + '/ai-turns', intent, expected=404)
        a.call('POST', route + '/ai-turns', intent, expected=401, binding=b.account)
        a.call('POST', route + '/ai-turns', intent, expected=403, csrf=False)
        turn = a.call('POST', route + '/ai-turns', intent, expected=200 if args.real_gemini else 503)
        if args.real_gemini:
            if turn.get('state') != 'SUCCEEDED':
                # Only server-enumerated error codes, never provider messages or credentials.
                code = turn.get('errorCode')
                safe = code if isinstance(code, str) and code.startswith('AI_') and code.replace('_', '').isalpha() and len(code) <= 32 else 'UNKNOWN'
                raise RuntimeError('Real Gemini did not succeed: ' + safe)
            assert turn['provider'] == 'gemini' and turn['model'] == args.model and turn['assistantSequence'] == 2
            expected_hash = hashlib.sha256(json.dumps([[1, 'user', prompt]], ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
            assert (turn['contextStart'], turn['contextEnd'], turn['contextCount'], turn['contextHash']) == (1, 1, 1, expected_hash)
            assert a.call('POST', route + '/ai-turns', intent) == turn
        else:
            assert turn['code'] == 'AI_UNCONFIGURED'
            a.call('GET', route + '/ai-turns', expected=204)
        before = a.call('GET', route + '/messages')
        assert len(before['items']) == (2 if args.real_gemini else 1)
        assert sum(m['role'] == 'assistant' for m in before['items']) == int(args.real_gemini)
        if args.real_gemini:
            content = next(m['content'] for m in before['items'] if m['role'] == 'assistant')
            assert 0 < len(content) <= 4000
            followup = 'Still using only our synthetic exercise: briefly explain how those two moving averages differ in weighting recent candles. No code or real trading advice.'
            a.call('POST', route + '/messages', {'requestId': str(uuid.uuid4()), 'content': followup})
            intent = {'requestId': str(uuid.uuid4()), 'expectedVersion': 4, 'sourceSequence': 3}
            turn = a.call('POST', route + '/ai-turns', intent)
            if turn.get('state') != 'SUCCEEDED':
                code = turn.get('errorCode')
                safe = code if isinstance(code, str) and code.startswith('AI_') and code.replace('_', '').isalpha() and len(code) <= 32 else 'UNKNOWN'
                raise RuntimeError('Real Gemini follow-up did not succeed: ' + safe)
            context = [[1, 'user', prompt], [2, 'assistant', content], [3, 'user', followup]]
            expected_hash = hashlib.sha256(json.dumps(context, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
            assert (turn['contextStart'], turn['contextEnd'], turn['contextCount'], turn['contextHash']) == (1, 3, 3, expected_hash)
            assert turn['provider'] == 'gemini' and turn['model'] == args.model and turn['assistantSequence'] == 4
            assert a.call('POST', route + '/ai-turns', intent) == turn
            before = a.call('GET', route + '/messages')
            assert len(before['items']) == 4 and sum(m['role'] == 'assistant' for m in before['items']) == 2
        for actor, decoy_route, marker in decoys:
            assert marker not in json.dumps(before)
            assert [m['content'] for m in actor.call('GET', decoy_route + '/messages')['items']] == [marker]
        (owned / 'restart-api').touch(exist_ok=False)
        deadline, saw_down = time.monotonic() + 60, False
        while time.monotonic() < deadline:
            try:
                a.call('GET', '/health')
                if saw_down:
                    break
            except (OSError, RuntimeError):
                saw_down = True
            time.sleep(.2)
        else:
            raise RuntimeError('API down/up not observed')
        assert a.call('GET', '/auth/me')['id'] == a.account
        assert a.call('GET', '/ai/capabilities') == configuration
        assert a.call('GET', route + '/messages') == before
        b.call('GET', route + '/messages', expected=404)
        if args.real_gemini:
            assert a.call('GET', route + '/ai-turns/' + intent['requestId']) == turn
            assert a.call('POST', route + '/ai-turns', intent) == turn
        else:
            a.call('GET', route + '/ai-turns', expected=204)
        result = {'passed': True, 'syntheticDataOnly': True, 'realGemini': args.real_gemini,
                  'actualApiDownUpObserved': saw_down, 'sessionAndMessagesSurvivedRestart': True,
                  'ownerBindingCsrfDenied': True, 'noDuplicateOrFakeAssistant': True,
                  'sameAndOtherOwnerDecoysExcluded': True, 'contextHashVerified': args.real_gemini,
                  'realProviderTurns': 2 if args.real_gemini else 0,
                  'configuration': configuration, 'messageCount': len(before['items']),
                  'messageSnapshotSha256': hashlib.sha256(json.dumps(before, sort_keys=True).encode()).hexdigest()}
    finally:
        for actor in (a, b):
            actor.call('POST', '/auth/logout', {}, 204)
            actor.call('GET', '/ai/capabilities', expected=401)
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print('PASS: owned synthetic AI smoke, authorization and actual API restart; realGemini=' + str(args.real_gemini))


if __name__ == '__main__':
    main()
