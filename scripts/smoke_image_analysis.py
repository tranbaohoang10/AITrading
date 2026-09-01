"""Real Gemini image smoke using one generated synthetic chart on owned local systems."""
import argparse,hashlib,http.cookiejar,json,secrets,struct,time,urllib.error,urllib.parse,urllib.request,uuid,zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];BASE='http://127.0.0.1:8080/api'
def png():
 w,h=320,180;rows=[]
 for y in range(h):
  row=bytearray([0]);
  for x in range(w):
   line=abs(y-(150-x//3))<2;grid=x%40==0 or y%30==0;row.extend((40,200,100) if line else ((45,55,70) if grid else (10,18,30)))
  rows.append(bytes(row))
 def chunk(t,d):return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')
class Actor:
 def __init__(self):self.client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));self.account=None
 def send(self,method,path,data=None,headers=None,expected=200):
  try:r=self.client.open(urllib.request.Request(BASE+path,data=data,headers=headers or {},method=method),timeout=45)
  except urllib.error.HTTPError as e:
   if e.code!=expected:raise RuntimeError(f'Unexpected HTTP {e.code}; body suppressed') from None
   r=e
  with r:
   raw=r.read(524289)
   if r.status!=expected or len(raw)>524288:raise RuntimeError('Unexpected/bounded response')
   return json.loads(raw) if raw else None
 def call(self,method,path,body=None,expected=200,binding=None,csrf=True,form=False):
  headers={'X-Workspace-User':binding or self.account} if binding or self.account else {};data=None
  if csrf and method not in ('GET','HEAD'):
   t=self.call('GET','/auth/csrf');headers[t['headerName']]=t['token']
  if body is not None:headers['Content-Type']='application/x-www-form-urlencoded' if form else 'application/json';data=urllib.parse.urlencode(body).encode() if form else json.dumps(body).encode()
  return self.send(method,path,data,headers,expected)
 def register(self):
  email,password=f'image-smoke-{uuid.uuid4().hex}@example.test',secrets.token_urlsafe(32);self.call('POST','/auth/register',{'email':email,'displayName':'Synthetic image owner','password':password},202);self.call('POST','/auth/login',{'email':email,'password':password},204,form=True);self.account=self.call('GET','/auth/me')['id']
 def analyze(self,data,request,question,expected=200,binding=None,csrf=True):
  boundary='----Synthetic'+secrets.token_hex(8);parts=[]
  for k,v in {'requestId':request,'question':question}.items():parts += [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()]
  parts += [f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.png"\r\nContent-Type: image/png\r\n\r\n'.encode(),data,b'\r\n',f'--{boundary}--\r\n'.encode()]
  headers={'Content-Type':f'multipart/form-data; boundary={boundary}','X-Workspace-User':binding or self.account}
  if csrf:t=self.call('GET','/auth/csrf');headers[t['headerName']]=t['token']
  return self.send('POST','/image-analyses',b''.join(parts),headers,expected)
def validate(x,model):
 assert x['provider']=='gemini' and x['model']==model and x['width']==320 and x['height']==180 and len(x['imageHash'])==64;v=x['analysis'];assert set(v)=={'visibleEvidence','visibleText','inferences','missingData','confidence','limitations'} and 0<=v['confidence']<=1 and v['limitations'];ids={e['id'] for e in v['visibleEvidence']};assert all(set(i['evidenceIds'])<=ids and (i['evidenceIds'] or v['missingData']) for i in v['inferences']);return x
def main():
 p=argparse.ArgumentParser();p.add_argument('--owned',required=True);p.add_argument('--report',required=True);p.add_argument('--model',default='gemini-3.5-flash');a=p.parse_args();owned=Path(a.owned).resolve();report=Path(a.report).resolve();evidence=(ROOT/'specs/PB-019/test-evidence').resolve()
 if owned.parent!=(ROOT/'tmp').resolve() or not (owned/'data/PG_VERSION').is_file() or not (owned/'password').is_file() or report.parent!=evidence:raise RuntimeError('Owned harness/evidence path required')
 first,other=Actor(),Actor();first.register();other.register();data=png();request=str(uuid.uuid4());question='Synthetic chart only: separate visible evidence from inference and state missing timeframe/live context.'
 try:
  first.analyze(data,request,question,403,csrf=False);first.analyze(data,request,question,401,binding=other.account);saved=validate(first.analyze(data,request,question),a.model);assert first.analyze(data,request,question)==saved and other.call('GET','/image-analyses')==[];other.call('GET','/image-analyses/'+saved['id'],expected=404)
  (owned/'restart-api').touch(exist_ok=False);deadline,saw=time.monotonic()+60,False
  while time.monotonic()<deadline:
   try:
    first.call('GET','/health')
    if saw:break
   except (OSError,RuntimeError):saw=True
   time.sleep(.2)
  else:raise RuntimeError('API restart not observed')
  assert validate(first.call('GET','/image-analyses/'+saved['id']),a.model)==saved and other.call('GET','/image-analyses')==[]
  result={'passed':True,'syntheticDataOnly':True,'realGemini':True,'provider':'gemini','model':a.model,'providerTurns':1,'canonicalPng':True,'structuredValidation':True,'ownerIsolation':True,'csrfAndExpectedAccountBinding':True,'idempotentReplay':True,'actualApiDownUpObserved':saw,'persistenceSurvivedRestart':True,'analysisSnapshotSha256':hashlib.sha256(json.dumps(saved,sort_keys=True).encode()).hexdigest()}
 finally:
  for x in (first,other):x.call('POST','/auth/logout',{},204)
 report.parent.mkdir(parents=True,exist_ok=True);report.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print('PASS: real Gemini synthetic image, structure, owner isolation and restart')
if __name__=='__main__':main()
