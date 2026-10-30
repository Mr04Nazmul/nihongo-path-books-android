"""Reproducible structural audit; never claims dictionary/teacher verification."""
import json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2];out=root/'android-app/reports';out.mkdir(exist_ok=True)
report={'lexicalVerification':'PENDING: structural checks do not verify meanings or readings','books':{},'issues':[]}
for level in ['N5','N4','N3','N2']:
 p=root/'dist/data'/('lessons-'+level.lower()+'.json');d=json.loads(p.read_text());counts={}
 for kind in ['vocab','grammar','kanji']:
  rows=d.get(kind,[]);counts[kind]=len(rows);seen=set()
  for i,e in enumerate(rows):
   key=e.get('id');
   if not key or key in seen:report['issues'].append({'level':level,'kind':kind,'index':i,'issue':'missing/duplicate ID','id':key})
   seen.add(key)
 report['books'][level]={'entries':counts,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
p=root/'dist/data/listening-n5.json';d=json.loads(p.read_text());lessons=d['lessons'];audio=list((root/'dist/audio/listening/n5').rglob('*.mp3'))
report['listening']={'level':'N5','lessons':len(lessons),'audioFiles':len(audio),'rights':d['rights'],'devicePlayback':'UNVERIFIED','otherLevels':'NOT INCLUDED'}
(out/'content-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='listening'},ensure_ascii=False));print('N5 listening:',len(lessons),'lessons;',len(audio),'MP3 files')
