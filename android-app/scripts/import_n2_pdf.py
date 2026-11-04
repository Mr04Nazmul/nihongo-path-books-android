"""Import the owner's corrected deck PDF without copying PDF bytes into the APK.
Usage: python import_n2_pdf.py PDF BASELINE_JSON OUTPUT_JSON --tessdata DIR
Japanese, kana annotations and English come from the text layer. Bengali is
read from the rendered Bengali column because its embedded encoding is visual.
"""
import argparse,concurrent.futures,hashlib,json,re,subprocess,tempfile,unicodedata
from pathlib import Path
import fitz

def norm(s):return re.sub(r'\s+','',unicodedata.normalize('NFKC',s))
def page_rows(args):
 pdf,pi,tess=args;cache_dir=Path(tempfile.gettempdir())/'nihongo-n2-ocr'/hashlib.sha256(Path(pdf).read_bytes()).hexdigest();cache_dir.mkdir(parents=True,exist_ok=True);cache=cache_dir/f'page-{pi}.json'
 if cache.exists():return json.loads(cache.read_text())
 doc=fitz.open(pdf);p=doc[pi];blocks=p.get_text('blocks');rows=[]
 for i,b in enumerate(blocks):
  m=re.match(r'^(\d{1,4})\n([^\n]+)',b[4])
  if m and 35<b[0]<60 and re.search('[\u3040-\u30ff\u3400-\u9fff]',m[2]):
   reading=blocks[i+1][4].strip();reading=re.sub(r'[^\s\[\]]+\[([^\]]+)\]',r'\1',reading);reading=re.sub(r'\s+','',reading)
   gloss=blocks[i+2][4].splitlines();english=' '.join(x for x in gloss if re.search('[A-Za-z]',x) and not re.search('[\u0980-\u09ff]',x))
   rows.append(dict(serial=int(m[1]),page=pi+1,word=m[2],reading=reading,english=english,y=b[1]))
 with tempfile.TemporaryDirectory() as tmp:
  for j,row in enumerate(rows):
   bottom=rows[j+1]['y']-1 if j+1<len(rows) else min(805,row['y']+29)
   pic=Path(tmp)/'bn.png';p.get_pixmap(matrix=fitz.Matrix(4,4),clip=fitz.Rect(233,row['y']-2,420,bottom)).save(pic)
   result=subprocess.run(['tesseract',str(pic),'stdout','--tessdata-dir',tess,'-l','ben','--psm','6'],capture_output=True,text=True,check=True)
   row['meaning']=unicodedata.normalize('NFC',' '.join(result.stdout.split())).replace('~','〜');row.pop('y')
 cache.write_text(json.dumps(rows,ensure_ascii=False));return rows

def main():
 a=argparse.ArgumentParser();a.add_argument('pdf');a.add_argument('baseline');a.add_argument('output');a.add_argument('--tessdata',required=True);v=a.parse_args()
 with concurrent.futures.ProcessPoolExecutor(max_workers=6) as pool:rows=[r for group in pool.map(page_rows,[(v.pdf,i,v.tessdata) for i in range(len(fitz.open(v.pdf)))]) for r in group]
 assert [r['serial'] for r in rows]==list(range(1,2274))
 missing=[r for r in rows if not re.search('[\u0980-\u09ff]',r['meaning'])]
 if missing:raise ValueError('Missing Bengali OCR: '+str([r['serial'] for r in missing]))
 b=json.loads(Path(v.baseline).read_text());lookup={};unique=[];removed=[]
 for e in b['vocab']:
  k=norm(e['word'])
  if k in lookup:
   canonical=lookup[k];canonical.setdefault('alias_ids',[]).append(e['id']);removed.append(e['id']);continue
  unique.append(e);lookup[k]=e
 b['vocab']=unique;added=0
 corrections=json.loads((Path(__file__).parents[1]/'curriculum/n2-corrections.json').read_text())
 for row in rows:
  row['meaning']=corrections['source_meanings'].get(str(row['serial']),row['meaning'])
 for r in rows:
  e=lookup.get(norm(r['word']))
  if e is None:
   e=dict(id=f"own-n2-deck-{r['serial']:04d}",level='N2',source_type='owner-text',meaning=r['meaning']);b['vocab'].append(e);lookup[norm(r['word'])]=e;added+=1
  # The corrected PDF is authoritative for source wording; IDs stay stable.
  e.update({k:r[k] for k in ['word','reading','english']});
  if str(r['serial']) in corrections['source_meanings']:e['meaning']=r['meaning']
  e.setdefault('deck_serials',[]).append(r['serial']);e.update(source_pdf_page=r['page'],bengali_review='OCR-transcribed corrected owner draft; semantic review pending')
 for i,e in enumerate(b['vocab'],1):e['entry_number']=i
 def fix(x):
  if isinstance(x,str):
   for old,new in corrections['text_substitutions'].items():x=x.replace(old,new)
   return unicodedata.normalize('NFC',x)
  if isinstance(x,list):return [fix(y) for y in x]
  if isinstance(x,dict):return {k:fix(y) for k,y in x.items()}
  return x
 b=fix(b)
 out=Path(v.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(b,ensure_ascii=False,separators=(',',':')))
 audit=dict(source_sha256=hashlib.sha256(Path(v.pdf).read_bytes()).hexdigest(),source_entries=2273,added=added,duplicate_ids_removed=removed,total_vocab=len(b['vocab']),source_rows=[{k:r[k] for k in ['serial','word','reading','page']} for r in rows],correction_count=len(corrections['source_meanings']))
 out.with_name('n2-import-audit.json').write_text(json.dumps(audit,ensure_ascii=False,separators=(',',':')));print(json.dumps({k:v for k,v in audit.items() if k!='source_rows'}))
if __name__=='__main__':main()
