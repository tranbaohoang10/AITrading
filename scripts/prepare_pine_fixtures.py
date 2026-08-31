"""Build synthetic Python reference traces for official Pine validation (not a Pine test)."""
from copy import deepcopy
from decimal import Decimal
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'python'))
from aitrading_engine.engine import run
from aitrading_engine.contract import time_text

BASE = json.loads((ROOT / 'backend/src/test/resources/dsl/price-action.json').read_text(encoding='utf-8'))
OUT = ROOT / 'backend/src/test/resources/pine'

def series(field='close', lag=0): return {'kind':'series','field':field,'lag':lag}
def ref(identity, lag=0): return {'kind':'indicator','id':identity,'lag':lag}
def constant(value): return {'kind':'constant','value':value}
def compare(a=None, op='gt', b=None): return {'kind':'compare','op':op,'left':a or series(),'right':b or constant(0)}
def candles(rows):
    return [dict(zip(('timestamp','open','high','low','close','volume'),
        [time_text(1704067200 + i*3600), *map(str,row), '10'])) for i,row in enumerate(rows)]
def document():
    d=deepcopy(BASE)
    d['risk'].update(initialCapital=1000,allocationPct=100,stopLossPct=50,takeProfitPct=100)
    d['execution'].update(commissionBps=0,spreadBps=0,slippageBps=0)
    return d
def save(name, dsl, rows, check=None):
    request={'protocolVersion':'1.0.0','dsl':dsl,'dataset':{**dsl['market'],'sourceType':'SYNTHETIC','closedThrough':'2030-01-01T00:00:00Z','candles':candles(rows)}}
    encoded=json.dumps(request,ensure_ascii=False,separators=(',',':')).encode('utf-8')
    result=run(encoded)
    if check: check(result)
    OUT.mkdir(parents=True,exist_ok=True)
    # Selected exact reference fields; no canned Pine PASS or target result.
    evidence={'request':request,'reference':result,'targetStatus':'NOT_RUN_OFFICIAL_PINE_REQUIRES_LOGIN',
        'numericTolerance':{'absolute':'0.00000001','relative':'0.000000000001'},
        'eventPolicy':'Exact bar/side/reason/signal/confirmation identity; no numeric tolerance on event decisions.'}
    (OUT/(name+'.json')).write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(f'{name}: Python reference {len(result["bars"])} bars, {len(result["events"])} events; Pine NOT RUN')

def main():
    d=document(); d['rules']['longEntry']=compare(); d['rules']['longExit']=compare(op='gte',b=constant(105))
    def hand(r):
        assert [(e['kind'],e['barIndex']) for e in r['events']]==[('SIGNAL',0),('ENTRY',1),('SIGNAL',2),('EXIT',3),('SIGNAL',3)]
        assert r['trades'][0]['netPnl']=='200' and r['trades'][0]['quantity']=='10'
        assert r['termination']['cancelledOrder']['signalBar']==3
    save('hand-next-open',d,[(100,100,100,100),(100,100,100,100),(110,110,110,110),(120,120,120,120)],hand)
    d=document();d['risk'].update(stopLossPct=5,takeProfitPct=10);d['execution'].update(commissionBps=7,spreadBps=6,slippageBps=4)
    d['rules'].update(longEntry=compare(series(),'gt',series('open')),shortEntry=compare(series(),'lt',series('open')),
        longExit=compare(series(),'lt',series('open')),shortExit=compare(series(),'gt',series('open')))
    def barriers(r):
        assert [(e['barIndex'],e['reason']) for e in r['events'] if e['kind']=='EXIT']==[(1,'STOP_LOSS'),(2,'STOP_LOSS'),(3,'STOP_LOSS'),(5,'STOP_LOSS')]
        assert [t['side'] for t in r['trades']]==['long','long','short','short']
        assert Decimal(r['trades'][-1]['exitPrice'])==Decimal('150.105')
    save('costs-both-hit-gap',d,[(100,102,99,101),(100,120,90,105),(120,125,110,115),(115,140,80,110),(100,101,99,100),(150,151,149,150)],barriers)
    d=document();d['rules'].update(longEntry=compare(),shortEntry=compare())
    save('simultaneous-entries',d,[(100,100,100,100)]*4,lambda r: assert_no_trades(r))
    d=document();d['rules']['longEntry']=compare()
    save('long-target-cap',d,[(100,100,100,100),(100,100,100,100),(300,310,290,300)],
        lambda r: check_trade(r,'TAKE_PROFIT','200','1000'))
    d=document();d['risk']['takeProfitPct']=50;d['rules'].update(longEntry=None,shortEntry=compare())
    save('short-target-cap',d,[(100,100,100,100),(100,100,100,100),(25,30,20,25)],
        lambda r: check_trade(r,'TAKE_PROFIT','50','500'))
    d=document();d['rules'].update(longEntry=compare(),longExit=compare(op='gte',b=constant(100)))
    save('rule-exit-before-barriers',d,[(100,100,100,100),(100,100,100,100),(40,300,30,40)],
        lambda r: check_trade(r,'RULE_EXIT','40','-600'))
    d=document();d['risk'].update(leverage=10,stopLossPct=5,takeProfitPct=10);d['rules'].update(longEntry=None,shortEntry=compare())
    def nonpositive(r):
        assert Decimal(r['metrics']['finalBalance']) < 0
        assert any(e['kind']=='SKIP' and e['reason']=='NONPOSITIVE_EQUITY' for e in r['events'])
    save('nonpositive-equity',d,[(100,100,100,100),(100,100,100,100),(1000,1000,1000,1000),(1000,1000,1000,1000)],nonpositive)
    d=document();d['indicators']=[{'id':'trend','type':'TRENDLINE','pivotRef':'ph'},
        {'id':'ph','type':'PIVOT_HIGH','left':1,'right':1},{'id':'pl','type':'PIVOT_LOW','left':1,'right':1},
        {'id':'atr','type':'ATR','period':3}]
    for kind in ('SMA','EMA','RSI','HIGHEST','LOWEST'):
        d['indicators'].append({'id':kind.lower(),'type':kind,'source':series(),'period':3})
    d['indicators'].append({'id':'nested','type':'EMA','source':ref('sma',1),'period':2})
    crossing={'kind':'cross','direction':'above','left':series(),'right':ref('sma')}
    d['rules']['longEntry']={'kind':'any','children':[crossing,{'kind':'all','children':[compare(ref('rsi'),'lt',constant(30)),{'kind':'not','child':compare(ref('trend'),'gt',series())}]}]}
    d['rules']['longExit']={'kind':'not','child':compare(series(),'gte',ref('ema'))}
    prices=[100,103,99,104,98,105,105,97,108,96,110,99,113,100,115,101,104,102,100,99,103,106,102,108]
    save('causal-all-indicators',d,[(p,p+1,p-1,p) for p in prices])
    print('Reference fixtures written. Official Pine compiler/runtime checks remain required.')

def assert_no_trades(r):
    assert not r['trades'] and all(e['kind']=='SKIP' and e['reason']=='SIMULTANEOUS_ENTRIES' for e in r['events'])

def check_trade(r,reason,price,net):
    assert len(r['trades'])==1
    assert r['trades'][0]['exitReason']==reason and r['trades'][0]['exitPrice']==price and r['trades'][0]['netPnl']==net

if __name__=='__main__': main()
