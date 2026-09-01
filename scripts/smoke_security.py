"""Owned two-user HTTP adversarial smoke; local/disposable systems and synthetic data only."""
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

ROOT=Path(__file__).resolve().parents[1];BASE='http://127.0.0.1:8080/api'

class Actor:
    def __init__(self):self.client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));self.account=None
    def raw(self,method,route,raw=None,expected=200,headers=None,csrf=True,binding=None):
        safe=dict(headers or {});account=binding or self.account
        if account:safe['X-Workspace-User']=account
        if csrf and method not in ('GET','HEAD'):
            token=self.call('GET','/auth/csrf');safe[token['headerName']]=token['token']
        request=urllib.request.Request(BASE+route,data=raw,headers=safe,method=method)
        try:response=self.client.open(request,timeout=20)
        except urllib.error.HTTPError as failure:
            if failure.code!=expected:raise RuntimeError(f'Unexpected HTTP {failure.code}, expected {expected}; body suppressed') from None
            response=failure
        with response:
            data=response.read(65537)
            if response.status!=expected or len(data)>65536:raise RuntimeError('Unexpected status or response bound')
            return response.headers, data
    def call(self,method,route,body=None,expected=200,csrf=True,binding=None):
        raw=None if body is None else json.dumps(body).encode();headers={} if raw is None else {'Content-Type':'application/json'}
        _,data=self.raw(method,route,raw,expected,headers,csrf,binding)
        try:return json.loads(data) if data else None
        except (ValueError,UnicodeError):raise RuntimeError('Malformed JSON; body suppressed') from None
    def register(self):
        email,password=f'security-smoke-{uuid.uuid4().hex}@example.test',secrets.token_urlsafe(32)
        self.call('POST','/auth/register',{'email':email,'displayName':'Synthetic security owner','password':password},202)
        raw=urllib.parse.urlencode({'email':email,'password':password}).encode()
        self.raw('POST','/auth/login',raw,204,{'Content-Type':'application/x-www-form-urlencoded'})
        self.account=self.call('GET','/auth/me')['id']

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--owned',required=True);parser.add_argument('--report',required=True);args=parser.parse_args()
    owned,report=Path(args.owned).resolve(),Path(args.report).resolve()
    if owned.parent!=(ROOT/'tmp').resolve() or not owned.name.startswith('pg-test-') or not (owned/'data/PG_VERSION').is_file() or not (owned/'password').is_file():raise RuntimeError('Active owned test harness required')
    evidence=(ROOT/'specs/PB-023/test-evidence').resolve()
    if report.parent!=evidence or report.name!='adversarial-smoke.json':raise RuntimeError('Report path is not the PB-023 evidence file')
    anonymous=Actor();headers,_=anonymous.raw('GET','/health')
    expected={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Cross-Origin-Resource-Policy':'same-origin','X-Permitted-Cross-Domain-Policies':'none'}
    for name,value in expected.items():assert headers.get(name)==value
    assert "default-src 'none'" in headers['Content-Security-Policy'] and 'no-store' in headers['Cache-Control']
    assert all(token in headers['Permissions-Policy'] for token in ('camera=()','payment=()','usb=()'))
    cookie_headers,_=anonymous.raw('GET','/auth/csrf');cookie=cookie_headers.get('Set-Cookie','')
    assert 'HttpOnly' in cookie and 'SameSite=Lax' in cookie and 'Domain=' not in cookie
    anonymous.raw('GET','/documents',expected=401)
    anonymous.raw('GET','/documents',expected=401,headers={'Authorization':'Bearer forged.synthetic.token'})
    a,b=Actor(),Actor();a.register();b.register()
    hostile="<script>alert(1)</script>'; DROP SCHEMA trading;-- ../../x =HYPERLINK(\"http://169.254.169.254/\") $(whoami)"
    conversation=a.call('POST','/conversations',{'requestId':str(uuid.uuid4())});route='/conversations/'+conversation['id']
    a.call('POST',route+'/messages',{'requestId':str(uuid.uuid4()),'content':hostile})
    saved=a.call('GET',route+'/messages');assert saved['items'][0]['content']==hostile
    b.call('GET',route+'/messages',expected=404);a.call('GET',route+'/messages',expected=401,binding=b.account)
    a.call('POST',route+'/messages',{'requestId':str(uuid.uuid4()),'content':'blocked'},expected=403,csrf=False)
    token=a.call('GET','/auth/csrf')['token'];security={'Content-Type':'application/json','X-CSRF-TOKEN':token,'X-Workspace-User':a.account,'Origin':'https://untrusted.invalid'}
    a.raw('POST','/conversations',json.dumps({'requestId':str(uuid.uuid4())}).encode(),403,security,csrf=False)
    duplicate=b'{"requestId":"11111111-1111-4111-8111-111111111111","requestId":"22222222-2222-4222-8222-222222222222"}'
    a.raw('POST','/conversations',duplicate,400,{'Content-Type':'application/json'},csrf=True)
    a.raw('POST','/conversations',b' '*16385,413,{'Content-Type':'application/json'},csrf=True)
    for _ in range(10):
        response=a.call('POST','/documents/rag',{'question':'synthetic no-evidence rate boundary'});assert response['kind']=='insufficient' and response['citations']==[] and response['provider'] is None
    _,limited=a.raw('POST','/documents/rag',json.dumps({'question':'synthetic limit'}).encode(),429,{'Content-Type':'application/json'},csrf=True)
    assert json.loads(limited)['code']=='RATE_LIMITED'
    assert b.call('POST','/documents/rag',{'question':'independent synthetic owner'})['kind']=='insufficient'
    (owned/'restart-api').touch(exist_ok=False);deadline,saw_down=time.monotonic()+60,False
    while time.monotonic()<deadline:
        try:
            a.call('GET','/health')
            if saw_down:break
        except (OSError,RuntimeError):saw_down=True
        time.sleep(.2)
    else:raise RuntimeError('API down/up not observed')
    assert a.call('GET',route+'/messages')==saved and b.call('GET',route+'/messages',expected=404) is not None
    for actor in (a,b):actor.call('POST','/auth/logout',{},204);actor.call('GET','/documents',expected=401)
    result={'passed':True,'syntheticDataOnly':True,'externalTargetsContacted':False,'securityHeaders':True,'cookieBoundary':True,'anonymousAndForgedBearerDenied':True,'csrfOriginAndExpectedAccountDenied':True,'ownerIsolation':True,'strictDuplicateAndBodyBounds':True,'hostilePayloadPersistedAsInertData':True,'rateLimitAndOwnerIndependentBudget':True,'actualApiDownUpObserved':saw_down,'sessionAndOwnerDataSurvivedRestart':True,'authorizedStateSha256':hashlib.sha256(json.dumps(saved,sort_keys=True).encode()).hexdigest()}
    report.parent.mkdir(parents=True,exist_ok=True);report.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print('PASS: owned two-user adversarial HTTP security and actual restart')

if __name__=='__main__':main()
