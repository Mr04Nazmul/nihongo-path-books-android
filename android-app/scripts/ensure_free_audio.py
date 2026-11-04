"""Reproducibly fetch only ten approved free groups, checking original SHA-256."""
import json,hashlib,os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
root=Path(__file__).resolve().parents[1]
media=Path(os.environ.get('BOOKS_LISTENING_MEDIA_DIR',str(root/'listening-media')))
manifest=json.loads((root/'supabase/functions/nihongo-listening-v1/allowed.json').read_text())
sources=json.loads((root/'supabase/functions/nihongo-listening-v1/audio-sources.json').read_text())
def download(item):
 path,record=item
 if '/2012/g1/' not in path and '/2012/g2/' not in path:return
 target=media/path;target.parent.mkdir(parents=True,exist_ok=True)
 for attempt in range(3):
  try:
   if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest()==manifest[path]['sha256']:return
   with urlopen(record['source'],timeout=90)as response: data=response.read(25000001)
   if len(data)>25000000 or hashlib.sha256(data).hexdigest()!=manifest[path]['sha256']:raise ValueError('Audio integrity check failed: '+path)
   target.write_bytes(data);return
  except Exception:
   if attempt==2:raise
with ThreadPoolExecutor(max_workers=5)as pool:list(pool.map(download,sources.items()))
print('Verified ten original free listening groups')
