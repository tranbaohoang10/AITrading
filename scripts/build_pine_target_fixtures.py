"""Prepare official-runtime fixtures. This script does NOT compile or execute Pine.

The unmodified generated runtime/indicator/rule/simulator blocks are retained.
Only chart inputs and the explicit chart-type/coverage guard are adapted to
synthetic first-N historical bars. Production chart validation needs separate
interactive target checks. No broker/order calls are added.
"""
import hashlib
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'specs/PB-015/test-evidence/target-fixtures'
FIELDS=('open','high','low','close','volume')
def digest(s): return hashlib.sha256(s.encode('utf-8')).hexdigest()
def literal(v):
    if v is None: return 'float(na)'
    text=str(v)
    if not re.fullmatch(r'-?\d+(\.\d+)?',text): raise ValueError('Unsafe fixture number')
    return text if '.' in text else text+'.0'
def exact(v): return -1 if v is None else 1 if v is True else 0 if v is False else int(v)

def build(name, fixture, code):
    rows=fixture['request']['dataset']['candles']; bars=fixture['reference']['bars']; events=fixture['reference']['events']
    count=len(rows); start=1704067200000; end=start+count*3600000
    # All fixture inputs are synthetic and explicitly built by prepare_pine_fixtures.
    assert 1<=count<=100 and fixture['request']['dataset']['sourceType']=='SYNTHETIC'
    assert fixture['request']['dsl']['market']['timeframe']=='1h'
    lines=code.splitlines()
    adapted=[]; skip=False
    for line in lines:
        if skip:
            assert line.startswith('    runtime.error(');skip=False;continue
        if line.startswith('if not chart.is_standard '):
            adapted.append('// Fixture adapter: chart type/symbol/interval guard is tested separately.');skip=True;continue
        if line.startswith('string chartTicker = '): continue
        if line.startswith('int startTime = '): line=f'const int startTime = {start}'
        elif line.startswith('int endTime = '): line=f'const int endTime = {end}'
        elif line.startswith('bool trace = '): line='bool trace = false'
        # Whole identifiers only, not series arrays, method arguments or policy names.
        for field in (*FIELDS,'time_close','time'):
            line=re.sub(r'\b'+field+r'\b','fixture_'+field,line)
        adapted.append(line)
    prefix=['// SYNTHETIC TARGET ASSERTIONS — no Pine PASS until actually run.']
    for field in FIELDS:
        prefix.append(f'var array<float> fixture_{field}_values = array.from('+', '.join(literal(r[field]) for r in rows)+')')
        prefix.append(f'float fixture_{field} = array.get(fixture_{field}_values, math.min(bar_index, {count-1}))')
    prefix += [f'int fixture_time = {start} + bar_index * 3600000','int fixture_time_close = fixture_time + 3600000',
        'f_check(float actual, float expected, string field) =>',
        '    if na(actual) != na(expected) or (not na(actual) and math.abs(actual - expected) > 0.00000001 + math.abs(expected) * 0.000000000001)',
        '        runtime.error("Fixture numeric divergence: " + field + " at bar " + str.tostring(bar_index))',
        'f_exact(int actual, int expected, string field) =>',
        '    if actual != expected',
        '        runtime.error("Fixture event divergence: " + field + " at bar " + str.tostring(bar_index))']
    declaration=next(i for i,line in enumerate(adapted) if line.startswith('indicator('))
    adapted[declaration+1:declaration+1]=prefix
    assertions=[]
    def checks(field, values, integer=False):
        key='expected_'+re.sub(r'[^A-Za-z0-9]','_',field)
        kind='int' if integer else 'float'
        expressions=', '.join(str(exact(v)) if integer else literal(v) for v in values)
        assertions.append(f'var array<{kind}> {key} = array.from({expressions})')
        assertions.append('if included')
        assertions.append(f'    {"f_exact" if integer else "f_check"}({field}, array.get({key}, count - 1), "{field}")')
    for rule in ('longEntry','shortEntry','longExit','shortExit'): checks(rule,[b['rules'][rule] for b in bars],True)
    for i,node in enumerate(fixture['request']['dsl']['indicators']):
        checks(f'f_at(i{i}, 0)',[b['indicators'][node['id']] for b in bars])
        if node['type'].startswith('PIVOT_'):
            recent=None;points=[]
            for b in bars:
                point=b['pivotConfirmations'][node['id']]
                if point is not None: recent=point['originalIndex']
                points.append(recent)
            checks(f'i{i}_x2',points)
    for field,ref in [('sim.balance','balance'),('sim.equity','equity')]: checks(field,[b[ref] for b in bars])
    checks('sim.side',[0 if b['positionSide'] is None else 1 if b['positionSide']=='long' else -1 for b in bars],True)
    grouped=[[e for e in events if e['barIndex']==i] for i in range(count)]
    def by_kind(items,kind): return next((e for e in items if e['kind']==kind),None)
    for event,prefix_name in [('ENTRY','entry'),('EXIT','exit')]:
        selected=[by_kind(es,event) for es in grouped]
        checks('sim.'+prefix_name+'Side',[0 if e is None else 1 if e['side']=='long' else -1 for e in selected],True)
        checks('sim.'+prefix_name+'SignalBar',[-1 if e is None or e.get('signalBar') is None else e['signalBar'] for e in selected],True)
        for field,ref in [('Fill','price'),('Cost','fee')]:checks('sim.'+prefix_name+field,[None if e is None else e[ref] for e in selected])
        if event=='EXIT':checks('sim.exitReason',[0 if e is None else {'RULE_EXIT':1,'STOP_LOSS':2,'TAKE_PROFIT':3}[e['reason']] for e in selected],True)
    selected=[by_kind(es,'SIGNAL') for es in grouped]
    checks('sim.signal',[0 if e is None else 2 if e['action']=='EXIT' else 1 if e['side']=='long' else -1 for e in selected],True)
    for field,reason,code_value in [('skipOpen','NONPOSITIVE_EQUITY',1),('skip','SIMULTANEOUS_ENTRIES',2)]:
        checks('sim.'+field,[code_value if any(e['kind']=='SKIP' and e['reason']==reason for e in es) else 0 for es in grouped],True)
    quantity='0';quantities=[]
    for es in grouped:
        e=by_kind(es,'ENTRY')
        if e:quantity=e['quantity']
        quantities.append(quantity)
    checks('sim.quantity',quantities)
    trades=fixture['reference']['trades']
    checks('sim.closedNet',[next((t['netPnl'] for t in trades if t['exitBar']==i),None) for i in range(count)])
    assertions += [f'if included and count == {count}',f'    log.info("SYNTHETIC {name}: all {count} event/indicator/accounting assertions passed in this actual Pine execution.")']
    result='\n'.join(adapted+assertions)+'\n'
    # Retain exact runtime and compiled rule/indicator block: only chart builtin
    # identifiers differ in the latter. This is structural preparation, not execution.
    runtime=code.split('// Trusted runtime;',1)[1].split('// END TRUSTED RUNTIME',1)[0]
    generated_runtime=result.split('// Trusted runtime;',1)[1].split('// END TRUSTED RUNTIME',1)[0]
    normalized=generated_runtime
    for field in (*FIELDS,'time_close','time'):normalized=re.sub(r'\bfixture_'+field+r'\b',field,normalized)
    assert normalized==runtime
    return result

def main():
    OUTPUT.mkdir(parents=True,exist_ok=True); manifest=[]
    for path in sorted((ROOT/'backend/src/test/resources/pine').glob('*.json')):
        fixture=json.loads(path.read_text(encoding='utf-8'));name=path.stem
        code=(ROOT/f'backend/build/reports/pine/{name}.pine').read_text(encoding='utf-8')
        target=build(name,fixture,code)
        (OUTPUT/(name+'.pine')).write_text(target,encoding='utf-8',newline='\n')
        (OUTPUT/(name+'-export.pine')).write_text(code,encoding='utf-8',newline='\n')
        manifest.append({'name':name,'dslHash':fixture['reference']['runCard']['dslHash'],'exportCodeHash':digest(code),'targetFixtureHash':digest(target),'targetStatus':'NOT_RUN','bars':len(fixture['reference']['bars'])})
    (OUTPUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(f'{len(manifest)} source-bound target fixture scripts prepared; official Pine NOT RUN.')

if __name__=='__main__':main()
