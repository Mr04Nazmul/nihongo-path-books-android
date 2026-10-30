"""Disposable account checks for the deployed API. Secrets stay in a local temp file."""
import json,uuid,secrets,sys,os
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
BASE='https://br-royal-poetry-ao0544wq-booksapi.compute.c-2.ap-southeast-1.aws.neon.tech'
STATE=Path('/tmp/nihongo-books-live-test-state.json')
def call(path,method='GET',data=None,token=''):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=Request(BASE+path,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method)
 try:
  with urlopen(req,timeout=60) as r:return r.status,r.read(),r.headers.get('Content-Type','')
 except HTTPError as e:return e.code,e.read(),e.headers.get('Content-Type','')
def check(path,expected,method='GET',data=None,token=''):
 status,raw,kind=call(path,method,data,token)
 if status!=expected:raise AssertionError((path,status,raw[:200]))
 print(method,path,'→',status)
 return json.loads(raw) if 'json' in kind else raw
if len(sys.argv)>1 and sys.argv[1]=='begin':
 check('/health',200);check('/me',401)
 accounts=[]
 for i in range(2):
  payload={'email':f'qa-{uuid.uuid4()}@example.test','password':secrets.token_urlsafe(24),'name':'Disposable verification account'}
  result=check('/auth/register',200,'POST',payload);accounts.append({'token':result['token'],'id':result['user']['id'],'credentials':payload})
 STATE.write_text(json.dumps(accounts));STATE.chmod(0o600)
 a=accounts[0];check('/me',200,token=a['token']);check('/admin/overview',403,token=a['token']);check('/content/data/lessons-n5.json',403,token=a['token']);check('/redeem',409,'POST',{'tierId':'N5-18000','requestId':str(uuid.uuid4())},a['token'])
 print('Disposable user IDs:',[x['id'] for x in accounts])
elif len(sys.argv)>1 and sys.argv[1]=='content':
 a,b=json.loads(STATE.read_text())
 for level in ['N5','N4','N3','N2','N1']:
  request={'tierId':level+'-18000','requestId':str(uuid.uuid4())};x=check('/redeem',200,'POST',request,a['token']);y=check('/redeem',200,'POST',request,a['token']);assert x['id']==y['id']
  prefix='lessons-' if level!='N1' else ''
  d=check(f'/content/data/{prefix}{level.lower()}.json',200,token=a['token']);assert all(isinstance(d[k],list) and d[k] for k in ['vocab','grammar','kanji'])
  check(f'/content/data/{prefix}{level.lower()}.json',403,token=b['token'])
  check('/redeem',409,'POST',{'tierId':level+'-18000','requestId':str(uuid.uuid4())},a['token'])
 pdf=check('/content/pdfs/jlpt-n2-vocab-vol1-verbs-and-nouns.pdf',200,token=a['token']);assert pdf.startswith(b'%PDF')
 d=check('/content/data/listening-n5.json',200,token=a['token']);print('Live N5 listening rows:',len(d['lessons']))
 mp3=check('/content/'+d['lessons'][0]['audio'],200,token=a['token']);assert len(mp3)>1000
 check('/ssv?signature=fake&key_id=1',400)
 s=check('/ads/session',200,'POST',{'level':'N5'},a['token']);print('SSV test session:',s['id'],'user:',a['id'])
elif len(sys.argv)>1 and sys.argv[1]=='expiry':
 a=json.loads(STATE.read_text())[0];check('/content/data/lessons-n5.json',403,token=a['token']);m=check('/me',200,token=a['token']);assert next(x for x in m['balances'] if x['level']=='N5')['credits']==2;print('Expired access blocked, unused credits retained')
elif len(sys.argv)>1 and sys.argv[1]=='cleanup':
 for a in json.loads(STATE.read_text()):check('/account',200,'DELETE',{},a['token']);check('/me',401,token=a['token'])
 STATE.unlink();print('Disposable accounts and fixture credits removed')
