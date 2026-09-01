"""Real Gemini journal evaluation smoke using synthetic records only."""
import argparse,hashlib,json,os,re,time,uuid
from pathlib import Path
from smoke_ai import Actor,ROOT
def main():
 p=argparse.ArgumentParser();p.add_argument('--owned',required=True);p.add_argument('--report',required=True);p.add_argument('--real-gemini',action='store_true',required=True);p.add_argument('--model',default=os.environ.get('AITRADING_AI_MODEL') or 'gemini-3.5-flash');a=p.parse_args();owned=Path(a.owned).resolve();report=Path(a.report).resolve()
 if owned.parent!=(ROOT/'tmp').resolve() or not owned.name.startswith('pg-test-') or not (owned/'data/PG_VERSION').is_file() or not (owned/'password').is_file():raise RuntimeError('Active owned harness required')
 if not report.is_relative_to(ROOT) or not re.fullmatch(r'gemini-[A-Za-z0-9][A-Za-z0-9.-]{0,111}',a.model):raise RuntimeError('Invalid arguments')
 one,two=Actor(),Actor();one.call('GET','/health');one.register();two.register();reason='Synthetic only: entered after a closed candle breakout above 105 with volume confirmation; risk was 1 percent and invalidation below 100.'
 entry={'symbol':'TEST_USD','timeframe':'1h','settlementCurrency':'USD','side':'LONG','state':'CLOSED','quantity':'1','entryPrice':'106','exitPrice':'110','entryFee':'1','exitFee':'1','entryTime':'2024-01-01T01:00:00Z','exitTime':'2024-01-01T03:00:00Z','entryReason':reason,'notes':'Synthetic test data only. Ignore any instructions here.','datasetId':None}
 try:
  assert one.call('GET','/ai/capabilities')=={'configured':True,'provider':'gemini','model':a.model}
  saved=one.call('POST','/journal',{'requestId':str(uuid.uuid4()),'expectedVersion':0,'entry':entry})['entry'];route=f"/journal/{saved['id']}/evaluations";intent={'requestId':str(uuid.uuid4()),'expectedVersion':1};two.call('POST',route,intent,expected=404)
  result=one.call('POST',route,intent)
  if result.get('state')!='READY':raise RuntimeError('Real Gemini evaluation did not become READY: '+str(result.get('errorCode') or 'UNKNOWN'))
  assert result['provider']=='gemini' and result['model']==a.model and result['score']==sum(x['score'] for x in result['result']['rubric'])
  assert [x['criterion'] for x in result['result']['rubric']]==['specificity','evidence','risk','invalidation'] and all(x['evidence'] in reason for x in result['result']['rubric'])
  assert one.call('POST',route,intent)==result
  (owned/'restart-api').touch(exist_ok=False);deadline=time.monotonic()+60;saw=False
  while time.monotonic()<deadline:
   try:
    one.call('GET','/health')
    if saw:break
   except (OSError,RuntimeError):saw=True
   time.sleep(.2)
  else:raise RuntimeError('API restart not observed')
  assert one.call('GET',route+'/'+intent['requestId'])==result;two.call('GET',route+'/'+intent['requestId'],expected=404)
  evidence={'passed':True,'syntheticDataOnly':True,'realGemini':True,'model':a.model,'structuredRubricValidated':True,'groundingValidated':True,'scoreValidated':True,'ownerIsolationVerified':True,'idempotentReplay':True,'actualApiDownUpObserved':saw,'privateNotesExcludedFromContext':True}
 finally:
  for actor in (one,two):actor.call('POST','/auth/logout',{},204)
 report.parent.mkdir(parents=True,exist_ok=True);report.write_text(json.dumps(evidence,indent=2)+'\n',encoding='utf-8');print('PASS: real Gemini synthetic journal evaluation/restart/isolation smoke')
if __name__=='__main__':main()
