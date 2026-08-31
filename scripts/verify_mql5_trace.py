"""Compare actual official MQL5 log traces with pinned synthetic Python events.

This verifier does not execute MQL5. Supply logs from the official runtime;
generated source or self-authored expected messages are not runtime evidence.
"""
from decimal import Decimal
import argparse
import json
from pathlib import Path
import re


def expected_rows(fixture):
    result=fixture['reference']; rows=[]; quantity='0'; pivots={}
    for index,bar in enumerate(result['bars']):
        events=[e for e in result['events'] if e['barIndex']==index]
        def event(kind): return next((e for e in events if e['kind']==kind),None)
        values={'balance':bar['balance'],'equity':bar['equity']}
        exact={k:-1 if v is None else int(v) for k,v in bar['rules'].items()}
        exact['side']=0 if bar['positionSide'] is None else 1 if bar['positionSide']=='long' else -1
        for i,node in enumerate(fixture['request']['dsl']['indicators']):
            key=node['id']; values[f'i{i}']=bar['indicators'][key]
            if node['type'].startswith('PIVOT_'):
                point=bar['pivotConfirmations'][key]
                if point is not None: pivots[key]=point['originalIndex']
                exact[f'i{i}_x2']=pivots.get(key,-1)
        for kind,prefix in [('ENTRY','entry'),('EXIT','exit')]:
            e=event(kind)
            exact[prefix+'Side']=0 if e is None else 1 if e['side']=='long' else -1
            exact[prefix+'SignalBar']=-1 if e is None or e.get('signalBar') is None else e['signalBar']
            values[prefix+'Fill']=None if e is None else e['price']
            values[prefix+'Cost']=None if e is None else e['fee']
            if kind=='ENTRY' and e: quantity=e['quantity']
            if kind=='EXIT': exact['exitReason']=0 if e is None else {'RULE_EXIT':1,'STOP_LOSS':2,'TAKE_PROFIT':3}[e['reason']]
        signal=event('SIGNAL')
        exact['signal']=0 if signal is None else 2 if signal['action']=='EXIT' else 1 if signal['side']=='long' else -1
        exact['skipOpen']=int(any(e['kind']=='SKIP' and e['reason']=='NONPOSITIVE_EQUITY' for e in events))
        exact['skip']=2 if any(e['kind']=='SKIP' and e['reason']=='SIMULTANEOUS_ENTRIES' for e in events) else 0
        values['quantity']=quantity
        values['closedNet']=next((t['netPnl'] for t in result['trades'] if t['exitBar']==index),None)
        from datetime import datetime
        exact['time']=int(datetime.fromisoformat(fixture['request']['dataset']['candles'][index]['timestamp']).timestamp())
        rows.append((exact,values))
    return rows


def verify(fixture,log):
    starts=re.findall(r'AITRADING_START\|mql5-research-1\.0\.0\|dslHash=([0-9a-f]{64})\|bars=(\d+)',log)
    expected=expected_rows(fixture)
    if starts!=[(fixture['reference']['runCard']['dslHash'],str(len(expected)))]: raise ValueError('Missing/duplicate/wrong source provenance')
    lines=re.findall(r'AITRADING_BAR\|([^\r\n]+)',log)
    if len(lines)!=len(expected): raise ValueError('Missing or duplicate bars')
    for index,(line,(exact,numbers)) in enumerate(zip(lines,expected)):
        parts=line.split('|')
        if parts[0]!=str(index): raise ValueError('Wrong bar order')
        fields={}
        for token in parts[1:]:
            key,separator,value=token.partition('=')
            if not separator or key in fields: raise ValueError('Malformed/duplicate trace field')
            fields[key]=value
        if set(fields)!=set(exact)|set(numbers): raise ValueError('Missing or unexpected trace field')
        for key,value in exact.items():
            if fields[key]!=str(value): raise ValueError(f'Event mismatch bar{index}/{key}')
        for key,value in numbers.items():
            actual=fields[key]
            if value is None:
                if actual!='null': raise ValueError(f'Undefined mismatch bar{index}/{key}')
            else:
                if not re.fullmatch(r'-?\d+(?:\.\d+)?(?:e[+-]?\d+)?',actual,re.I): raise ValueError('Invalid numeric trace')
                a,b=Decimal(actual),Decimal(value)
                if abs(a-b)>Decimal('1e-8')+abs(b)*Decimal('1e-12'): raise ValueError(f'Numeric mismatch bar{index}/{key}')
    ends=re.findall(r'AITRADING_END\|cancelledPending=(-?\d+)\|openSide=(-?\d+)\|balance=([^|\r\n]+)\|equity=([^\r\n]+)',log)
    if len(ends)!=1: raise ValueError('Missing/duplicate completion marker')
    end=ends[0]; last=expected[-1]
    if end[0]!=str(last[0]['signal']) or end[1]!=str(last[0]['side']): raise ValueError('Wrong end cancellation/open position')
    for actual,key in zip(end[2:],['balance','equity']):
        a,b=Decimal(actual),Decimal(last[1][key])
        if not a.is_finite() or abs(a-b)>Decimal('1e-8')+abs(b)*Decimal('1e-12'): raise ValueError('Wrong final accounting')
    if re.search(r'ERROR:|Fixture.*divergence',log): raise ValueError('Runtime error present')
    return {'bars':len(expected),'comparison':'PASS','scope':'supplied official-runtime trace only; verifier does not execute MQL5'}


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--fixture',type=Path,required=True);parser.add_argument('--log',type=Path,required=True)
    args=parser.parse_args();raw=args.log.read_bytes()
    log=raw.decode('utf-16') if raw.startswith((b'\xff\xfe',b'\xfe\xff')) else raw.decode('utf-8-sig')
    print(json.dumps(verify(json.loads(args.fixture.read_text(encoding='utf-8')),log)))


if __name__=='__main__': main()
