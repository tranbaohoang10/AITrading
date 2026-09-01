"""Real Gemini Strategy DSL proposal smoke using only owned synthetic data."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import time
import uuid

from smoke_ai import Actor, ROOT


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--owned', required=True)
    parser.add_argument('--report', required=True)
    parser.add_argument('--real-gemini', action='store_true', required=True)
    parser.add_argument('--model', default=os.environ.get('AITRADING_AI_MODEL') or 'gemini-3.5-flash')
    args = parser.parse_args()
    if not re.fullmatch(r'gemini-[A-Za-z0-9][A-Za-z0-9.-]{0,111}', args.model) or '..' in args.model:
        raise RuntimeError('Invalid smoke model identifier')
    owned, report = Path(args.owned).resolve(), Path(args.report).resolve()
    if owned.parent != (ROOT / 'tmp').resolve() or not owned.name.startswith('pg-test-') or not (owned / 'data/PG_VERSION').is_file() or not (owned / 'password').is_file():
        raise RuntimeError('Active owned test harness required')
    if not report.is_relative_to(ROOT):
        raise RuntimeError('Report must remain in repository')

    a, b = Actor(), Actor(); a.call('GET', '/health'); a.register(); b.register()
    prompt = ('Synthetic research data only. Propose one complete AITrading Strategy DSL 1.0.0 strategy named Synthetic EMA research, '
              'labels synthetic and ema, for BTC_USDT 1h UTC. Define ema_fast EMA close lag 0 period 5 and ema_slow EMA close lag 0 period 10. '
              'Long entry crosses above ema_fast lag 0 and ema_slow lag 0; long exit crosses below them; short entry and short exit are null. '
              'Risk: initialCapital 10000, allocationPct 10, leverage 1, stopLossPct 2, takeProfitPct 4. Execution: signal bar_close, '
              'fill next_bar_open, sameBarExit stop_first, missingCandles reject, maxPositions 1, commissionBps 5, spreadBps 2, slippageBps 1. '
              'No real account, market data, trades, personal information or code.')
    try:
        assert a.call('GET', '/ai/capabilities') == {'configured': True, 'provider': 'gemini', 'model': args.model}
        conversation = a.call('POST', '/conversations', {'requestId': str(uuid.uuid4())})
        route = '/conversations/' + conversation['id']
        a.call('POST', route + '/messages', {'requestId': str(uuid.uuid4()), 'content': prompt})
        source = a.call('GET', route + '/messages'); conversation = source['conversation']
        assert len(source['items']) == 1 and source['items'][0]['role'] == 'user'

        strategies, attempts = [], []
        for decision in ('accept', 'reject'):
            strategy = a.call('POST', '/strategies', {'requestId': str(uuid.uuid4()), 'title': 'Synthetic Gemini proposal ' + decision})
            strategies.append(strategy['strategyId']); request_id = str(uuid.uuid4())
            intent = {'requestId': request_id, 'expectedRevision': 1, 'conversationId': conversation['id'],
                      'expectedConversationVersion': conversation['version'], 'sourceSequence': 1}
            generation_route = '/strategies/' + strategy['strategyId'] + '/generations'
            b.call('POST', generation_route, intent, expected=404)
            attempt = a.call('POST', generation_route, intent)
            if attempt.get('state') != 'READY':
                code = attempt.get('errorCode')
                safe = code if isinstance(code, str) and re.fullmatch(r'AI_[A-Z_]{1,29}', code) else 'UNKNOWN'
                raise RuntimeError('Real Gemini proposal did not become READY: ' + safe)
            assert attempt['provider'] == 'gemini' and attempt['model'] == args.model
            expected_hash = hashlib.sha256(json.dumps([[1, 'user', prompt]], ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
            assert (attempt['contextStart'], attempt['contextCount'], attempt['contextHash']) == (1, 1, expected_hash)
            assert attempt['proposal']['kind'] == 'proposal' and attempt['proposal']['questions'] == [] and attempt['proposal']['dslJson']
            assert a.call('POST', generation_route, intent) == attempt
            decided = a.call('POST', generation_route + '/' + request_id + '/' + decision, {})
            assert decided['state'] == ('ACCEPTED' if decision == 'accept' else 'REJECTED')
            if decision == 'accept':
                saved = a.call('GET', '/strategies/' + strategy['strategyId'])
                assert saved['revision'] == 2 and saved['status'] == 'VALIDATED' and saved['hash'] == attempt['dslHash']
                assert a.call('POST', generation_route + '/' + request_id + '/accept', {}) == decided
            else:
                assert a.call('GET', '/strategies/' + strategy['strategyId'])['revision'] == 1
            attempts.append((generation_route, request_id, decided))

        assert len(a.call('GET', route + '/messages')['items']) == 1
        (owned / 'restart-api').touch(exist_ok=False)
        deadline, saw_down = time.monotonic() + 60, False
        while time.monotonic() < deadline:
            try:
                a.call('GET', '/health')
                if saw_down: break
            except (OSError, RuntimeError): saw_down = True
            time.sleep(.2)
        else: raise RuntimeError('API down/up not observed')
        assert a.call('GET', '/auth/me')['id'] == a.account
        for generation_route, request_id, decided in attempts:
            assert a.call('GET', generation_route + '/' + request_id) == decided
            b.call('GET', generation_route + '/' + request_id, expected=404)
        result = {'passed': True, 'syntheticDataOnly': True, 'realGemini': True, 'model': args.model,
                  'actualApiDownUpObserved': saw_down, 'ownerIsolationVerified': True, 'contextHashVerified': True,
                  'structuredDslValidated': True, 'acceptedRevisionPersisted': True, 'rejectedWithoutRevision': True,
                  'noChatAssistantOrAutomaticExecution': True, 'realProviderProposals': 2}
    finally:
        for actor in (a, b):
            actor.call('POST', '/auth/logout', {}, 204); actor.call('GET', '/ai/capabilities', expected=401)
    report.parent.mkdir(parents=True, exist_ok=True); report.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print('PASS: real Gemini synthetic Strategy DSL proposal/accept/reject/restart smoke')


if __name__ == '__main__':
    main()
