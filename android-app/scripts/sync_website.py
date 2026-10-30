"""Fetch the Android reader shell from the owner's LIVE website, never from dist/."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from urllib.parse import urljoin,urlsplit,unquote
from urllib.request import Request,urlopen
import re,json,hashlib,shutil
BASE='https://devnazu.online/'
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'build/website-snapshot'
HTML=['index.html','lessons.html','n5.html','n4.html','n3.html','n2.html','n1.html','extra.html','review.html','progress.html','settings.html','sources.html','listening.html','basics/index.html']
META=['data/'+n for n in ['index.json','owner-index.json','book-inventory.json','review-status.json','NOTICE.md','LICENSE','SUPPLEMENT-ATTRIBUTION.md','HANABIRA-ATTRIBUTION.md']]
PREVIEWS=[f'data/lessons-n{n}.json' for n in [5,4,3,2]]
STATIC=['styles.css','atelier.css','study-pages.css','study-library.css','owner-pages.css','owner-pages.mjs','motion.js','app.js','speech.js','listening.js','listening.css']
def safe(route):
 return re.fullmatch(r'[A-Za-z0-9_./-]+',route) is not None and not ('..' in route or '\\' in route or route.startswith('/')) and (route in HTML+META+PREVIEWS or route in STATIC or route.startswith(('fonts/','vendor/','basics/')))
def download(route):
 req=Request(urljoin(BASE,route),headers={'User-Agent':'NihongoPathBooks-AndroidBuilder/1.1'})
 with urlopen(req,timeout=45) as r:
  if urlsplit(r.url).hostname!='devnazu.online':raise ValueError('Unexpected asset redirect')
  b=r.read(20000001)
 if len(b)>20000000:raise ValueError('Asset too large')
 return route,b
if OUT.exists():shutil.rmtree(OUT)
OUT.mkdir(parents=True)
seen=set();pending=set(HTML+META+STATIC+PREVIEWS);hashes={}
while pending:
 batch=pending-seen;pending=set()
 if not batch:break
 with ThreadPoolExecutor(max_workers=8) as pool:
  futures={pool.submit(download,p):p for p in batch}
  for f in as_completed(futures):
   
   try:route,b=f.result()
   except Exception as e:raise RuntimeError('Website asset failed: '+futures[f]) from e
   seen.add(route);target=OUT/route;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(b);hashes[route]=hashlib.sha256(b).hexdigest()
   if route.endswith(('.html','.css','.js','.mjs')):
    s=b.decode('utf-8')
    refs=re.findall(r'''(?:src|href)=["']([^"']+)["']|url\(["']?([^)'"\s]+)|["'](\.?\.?/?(?:vendor|fonts)/[^"']+)["']''',s)
    for values in refs:
     ref=next((v for v in values if v),'');u=urlsplit(urljoin(urljoin(BASE,route),ref));p=unquote(u.path.lstrip('/'));p=p+'index.html' if p.endswith('/') else p
     if u.hostname=='devnazu.online' and p and safe(p) and p not in seen:pending.add(p)
(OUT/'website-source-manifest.json').write_text(json.dumps({'origin':BASE,'files':hashes},ensure_ascii=False,indent=2))
print('Live website snapshot:',len(hashes),'assets; origin:',BASE)
