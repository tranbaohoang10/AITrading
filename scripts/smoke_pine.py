"""Actual Pine artifact HTTP/PostgreSQL/restart smoke, only on owned local test DB.

Does not execute Pine or submit code to TradingView. No secret is written to output.
"""
import argparse
import hashlib
import http.cookiejar
import json
from pathlib import Path
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT=Path(__file__).resolve().parents[1]
BASE='http://127.0.0.1:8080/api'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--owned',required=True);parser.add_argument('--report',required=True)
    args=parser.parse_args();owned=Path(args.owned).resolve();report=Path(args.report).resolve()
    if owned.parent!=(ROOT/'tmp').resolve() or not owned.name.startswith('pg-test-') or not (owned/'data/PG_VERSION').is_file() or not (owned/'password').is_file():
        raise RuntimeError('An active owned test harness is required')
    if not report.is_relative_to(ROOT):raise RuntimeError('Report must remain in repository')
    client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));account=None
    def call(method,route,body=None,status=200,form=False):
        headers={'X-Workspace-User':account} if account else {}
        if method not in ('GET','HEAD'):
            token=call('GET','/auth/csrf');headers[token['headerName']]=token['token']
        raw=None
        if body is not None:
            headers['Content-Type']='application/x-www-form-urlencoded' if form else 'application/json'
            raw=urllib.parse.urlencode(body).encode() if form else json.dumps(body,ensure_ascii=False).encode('utf-8')
        request=urllib.request.Request(BASE+route,data=raw,headers=headers,method=method)
        try:response=client.open(request,timeout=8)
        except urllib.error.HTTPError as response:
            if response.code!=status:raise RuntimeError(f'Unexpected HTTP {response.code}, expected {status}') from None
            return None
        with response:
            if response.status!=status:raise RuntimeError('Unexpected success status')
            data=response.read(512*1024+1)
            if len(data)>512*1024:raise RuntimeError('Response limit')
            return json.loads(data) if data else None
    call('GET','/health')
    password=secrets.token_urlsafe(32);email=f'pine-smoke-{uuid.uuid4().hex}@example.test'
    call('POST','/auth/register',{'email':email,'displayName':'Synthetic Pine restart','password':password},202)
    call('POST','/auth/login',{'email':email,'password':password},204,True);del password
    account=call('GET','/auth/me')['id']
    source=call('POST','/strategies',{'requestId':str(uuid.uuid4()),'title':'Synthetic Pine restart'})
    strategy='/strategies/'+source['strategyId']
    source=call('POST',strategy+'/versions',{'requestId':str(uuid.uuid4()),'expectedRevision':1,'title':'Synthetic Pine restart',
        'draftText':(ROOT/'backend/src/test/resources/dsl/price-action.json').read_text(encoding='utf-8'),'mode':'VALIDATED'})
    path=strategy+'/versions/2/pine'
    artifact=call('POST',path,{})
    assert artifact==call('GET',path)==call('POST',path,{})
    assert artifact['dslHash']==source['hash']
    assert artifact['codeHash']==hashlib.sha256(artifact['code'].encode('utf-8')).hexdigest()
    assert 'official target validation pending' in artifact['code']
    (owned/'restart-api').touch(exist_ok=False)
    deadline=time.monotonic()+45;saw_down=False
    while time.monotonic()<deadline:
        try:
            call('GET','/health')
            if saw_down:break
        except (OSError,RuntimeError):saw_down=True
        time.sleep(.2)
    else:raise RuntimeError('API down/up was not observed')
    assert call('GET','/auth/me')['id']==account
    assert call('GET',path)==artifact and call('POST',path,{})==artifact
    call('DELETE',strategy,{'expectedRevision':2},204);call('GET',path,status=404)
    call('POST','/auth/logout',{},204)
    report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps({'passed':True,'synthetic':True,'realHttpPostgres':True,'actualApiDownUpObserved':saw_down,
        'sessionAndArtifactSurvivedRestart':True,'idempotentReplayBeforeAndAfterRestart':True,'sourceDeleteRemovesExport':True,
        'dslHash':artifact['dslHash'],'codeHash':artifact['codeHash'],'generatorVersion':artifact['generatorVersion'],
        'officialPineRuntime':'NOT_RUN'},indent=2)+'\n',encoding='utf-8')
    print('PASS: actual HTTP/PG Pine artifact hash, replay, API restart, session persistence and deletion; synthetic account signed out. Pine runtime NOT RUN.')

if __name__=='__main__':main()
