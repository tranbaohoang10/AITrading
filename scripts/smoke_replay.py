"""Replay/Journal HTTP checks against an explicitly owned disposable API only."""
import argparse
from datetime import datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import uuid
import smoke_security as http

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, required=True)
    args = parser.parse_args()
    state = json.loads((ROOT / f'tmp/dev/backend-{args.port}.json').read_text())
    owned = Path(state['ownedClusterPath']).resolve()
    if state['port'] != args.port or Path(state['repoRoot']).resolve() != ROOT or owned.parent != ROOT / 'tmp' or not owned.name.startswith('pg-test-') or not (owned / 'password').is_file():
        raise RuntimeError('Active owned disposable backend required')
    http.BASE = f'http://127.0.0.1:{args.port}/api'
    cases = []
    anonymous = http.Actor()
    for route in ['/replay', '/market/providers/capabilities', '/market/stream?symbol=BTC-USD&timeframe=1m']:
        anonymous.call('GET', route, expected=401)
    cases.append('anonymous replay/provider/stream denied')
    a, b = http.Actor(), http.Actor()
    a.register(); b.register()
    create = dict(requestId=str(uuid.uuid4()), provider='BINANCE', instrument='BTCUSDT', timeframe='1h',
                  **{'from': '2026-08-07T00:00:00Z', 'to': '2026-08-08T00:00:00Z'}, initialBalance='10000', commissionBps='0', slippageBps='0')
    a.call('POST', '/replay', create, expected=403, csrf=False)
    a.call('POST', '/replay', {**create, 'provider': 'FRANKFURTER', 'instrument': 'EUR-USD', 'timeframe': '1d'}, expected=400)
    cases.append('CSRF enforced; daily FX reference rejected for trading replay')
    session = a.call('POST', '/replay', create)
    assert a.call('POST', '/replay', create)['id'] == session['id']
    assert len(session['candles']) == 1 and session['cursor'] == 0
    route = '/replay/' + session['id']
    b.call('GET', route, expected=404)
    a.call('GET', route, expected=401, binding=b.account)
    price = Decimal(str(session['candles'][0]['close']))
    order = dict(side='SHORT', entry=str(price), stop=str(price * Decimal('1.01')), target=str(price * Decimal('0.98')), sizingMode='RISK_PERCENT', size='0.5')
    command = dict(requestId=str(uuid.uuid4()), expectedVersion=1, action='CONFIRM', order=order)
    b.call('POST', route+'/commands', command, expected=404)
    first = a.call('POST', route+'/commands', command)
    repeated = a.call('POST', route+'/commands', command)
    assert len(first['trades']) == len(repeated['trades']) == 1 and first['version'] == repeated['version']
    a.call('POST', route+'/commands', {**command, 'order': {**order, 'size': '0.4'}}, expected=409)
    a.call('POST', route+'/commands', dict(requestId=str(uuid.uuid4()), expectedVersion=1, action='STEP'), expected=409)
    cases.append('owner isolation; prefix only; duplicate intent once; conflicting identity/stale version denied')
    opened = a.call('POST', route+'/commands', dict(requestId=str(uuid.uuid4()), expectedVersion=first['version'], action='STEP'))
    assert opened['trades'][0]['state'] == 'OPEN' and len(opened['candles']) == 2
    step = dict(requestId=str(uuid.uuid4()), expectedVersion=opened['version'], action='STEP')
    _, payload = a.raw('POST', route+'/commands', json.dumps(step).encode(), headers={
        'Content-Type': 'application/json', 'X-Replay-Known-Cursor': str(opened['cursor'])})
    window = json.loads(payload)
    assert window['candleStart'] == 2 and len(window['state']['candles']) == 1
    assert window['state']['cursor'] == 2 and window['state']['trades'][0]['state'] == 'OPEN'
    opened = window['state']
    _, retried = a.raw('POST', route+'/commands', json.dumps(step).encode(), headers={
        'Content-Type': 'application/json', 'X-Replay-Known-Cursor': '1'})
    assert json.loads(retried) == window
    cases.append('Step transfers one new candle; exact retry preserves cursor/version/window')
    close = dict(requestId=str(uuid.uuid4()), expectedVersion=opened['version'], action='CLOSE')
    closed = a.call('POST', route+'/commands', close)
    a.call('POST', route+'/commands', close)
    query = '/journal/page?from=2026-08-07&to=2026-08-07&zone=UTC&currency=USDT&source=REPLAY&side=SHORT&state=CLOSED&symbol=BTCUSDT&replaySession='+session['id']
    journal = a.call('GET', query)
    assert journal['totalItems'] == 1 and b.call('GET', query)['totalItems'] == 0
    entry = journal['items'][0]
    provenance = a.call('GET', '/journal/'+entry['id']+'/provenance')
    assert provenance['source'] == 'REPLAY' and provenance['provenance']['provider'] == 'BINANCE'
    b.call('GET', '/journal/'+entry['id']+'/provenance', expected=404)
    data = entry['data']
    a.call('POST', '/journal/'+entry['id'], dict(requestId=str(uuid.uuid4()), expectedVersion=1, entry={**data, 'quantity': '999'}), expected=409)
    review = a.call('POST', '/journal/'+entry['id'], dict(requestId=str(uuid.uuid4()), expectedVersion=1, entry={**data, 'notes': 'Synthetic HTTP review'}))
    assert review['entry']['data']['notes'] == 'Synthetic HTTP review'
    cases.append('Short execution; duplicate close projects one Journal row; filters/provenance owned; immutable execution and editable review')
    note_path = '/journal/day-note?date=2026-08-07&zone=UTC&currency=USDT'
    note = dict(date='2026-08-07', zone='UTC', currency='USDT', note='Synthetic day review', version=0)
    saved = a.call('POST', '/journal/day-note', note)
    assert a.call('POST', '/journal/day-note', note) == saved
    assert b.call('GET', note_path)['note'] == ''
    a.call('POST', '/journal/day-note', {**note, 'note':'stale different note'}, expected=409)
    a.call('POST', '/journal/day-note', {**note, 'note':'x'*4001, 'version':1}, expected=400)
    cases.append('daily note owner isolation, duplicate retry, stale edit and UTF-8 bound')
    for provider in ['SESSION', 'COINBASE:session', 'http%3A%2F%2F127.0.0.1']:
        a.raw('GET', f'/market/providers/{provider}/instruments', expected=400)
    cases.append('provider/key namespace injection denied')
    result = dict(at=datetime.now(timezone.utc).isoformat(), status='PASS', cases=cases, provider='BINANCE', instrument='BTCUSDT',
                  currency='USDT', balance=closed['balance'], execution=closed['trades'][0], cacheStatus=a.call('GET', '/market/providers/capabilities')['cacheStatus'])
    (ROOT/'specs/REPLAY/test-evidence/http-replay-security.json').write_text(json.dumps(result, indent=2)+'\n')
    print(f'PASS: {len(cases)} HTTP scenario groups; secret/session contents omitted')


if __name__ == '__main__':
    main()
