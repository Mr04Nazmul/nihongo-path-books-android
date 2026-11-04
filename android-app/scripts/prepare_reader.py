"""Build isolated Android reading surfaces; never ship the website navigation shell."""
import json,re,shutil,hashlib,subprocess,sys,os
from pathlib import Path
root=Path(__file__).resolve().parents[2]
if not os.environ.get('BOOKS_SNAPSHOT_DIR') and not (root/'android-app/offline-shell').exists():
 subprocess.run([sys.executable,str(root/'android-app/scripts/sync_website.py')],check=True)
source=Path(os.environ.get('BOOKS_SNAPSHOT_DIR',str(root/'android-app/offline-shell')))
out=root/'android-app/app/build/generated/study-assets/reader'
if out.exists():shutil.rmtree(out)
out.mkdir(parents=True)
for directory in ['fonts']:
 if (source/directory).exists():shutil.copytree(source/directory,out/directory)
# Basics have standalone tables. Strip download/back links so they cannot lead to the old website.
basics=out/'basics';basics.mkdir()
if (source/'basics/basics.css').exists():shutil.copy2(source/'basics/basics.css',basics/'basics.css')
s=(source/'basics/index.html').read_text()
s=re.sub(r'<(?:header|footer|nav)\b[^>]*>.*?</(?:header|footer|nav)>','',s,flags=re.S|re.I)
s=re.sub(r'<a\b[^>]*href=["\'](?!#)[^"\']*["\'][^>]*>.*?</a>','',s,flags=re.S|re.I)
s=s.replace('</head>','<style>body{background:#faf6ef!important;color:#27252a!important}main{padding:18px!important}section{border-radius:16px!important}h1{font-size:26px!important}table{font-size:15px!important}</style></head>')
(basics/'index.html').write_text(s)
for p in (root/'android-app/reader').glob('*.html'):
 if p.name!='pdf-reader.html':shutil.copy2(p,out/p.name)
shutil.copy2(root/'android-app/reader/compat.js',out/'compat.js')
shutil.copy2(root/'android-app/reader/strokes.js',out/'strokes.js')
shutil.copy2(root/'android-app/reader/appearance.js',out/'appearance.js')
# Apply the shared native palette before any reader content is painted.
for html in out.rglob('*.html'):
 markup=html.read_text();prefix='../' if html.parent==basics else ''
 script='<script src="'+prefix+'appearance.js"></script>'
 if '</head>' in markup:markup=markup.replace('</head>',script+'</head>',1)
 else:markup=markup.replace('<main',script+'<main',1)
 html.write_text(markup)
for name in ['listening.js','listening-core.js','listening.css']:
 shutil.copy2(root/'android-app/reader'/name,out/name)
preview=out/'previews';preview.mkdir()
for level in ['n5','n4','n3','n2','n1']:
 curriculum=root/'android-app/curriculum'/f'lessons-{level}.json'
 data=json.loads((source/'data'/f'lessons-{level}.json').read_text())
 free={kind:data[kind][:5] for kind in ['vocab','grammar','kanji']}
 assert all(len(rows)==5 for rows in free.values())
 (preview/f'lessons-{level}.json').write_text(json.dumps(free,ensure_ascii=False))
# Only the first two complete audio groups per level are free. No paid media enters the APK.
listening_source=Path(os.environ.get('BOOKS_LISTENING_MEDIA_DIR',str(root/'android-app/listening-media')))
subprocess.run([sys.executable,str(root/'android-app/scripts/ensure_free_audio.py')],check=True)
for level in ['n5','n4','n3','n2','n1']:
 catalogue=listening_source/'listening'/level/'catalog.json'
 if not catalogue.is_file():raise SystemExit('Missing listening media: set BOOKS_LISTENING_MEDIA_DIR to the reviewed media directory')
 data=json.loads(catalogue.read_text())
 assert data['level']==level.upper() and all(s['kind']=='practice' and s['year'] in ['2012','2018'] for s in data['sections'])
 target=preview/'listening'/level;target.mkdir(parents=True)
 # The catalogue contains metadata only; question images/audio/answer keys remain gated.
 (target/'catalog.json').write_text(json.dumps(data,ensure_ascii=False))
 free=[s for s in data['sections'] if s['year']=='2012' and s['group'] in [1,2]]
 assert len(free)==2
 for section in free:
  folder=section['audio'].rsplit('/',1)[0]
  shutil.copytree(listening_source/folder,preview/folder)
# Animation previews contain only ten per-level entries and their exact stroke assets.
kanji=json.loads((root/'android-app/curriculum/kanji-catalog.json').read_text())
strokes=json.loads((root/'android-app/curriculum/kanji-strokes.json').read_text())
(preview/'kanji').mkdir()
for level,rows in kanji.items():
 free=rows[:10]
 (preview/'kanji'/f'{level}.json').write_text(json.dumps({'level':level.upper(),'entries':free},ensure_ascii=False))
 folder=preview/'strokes'/level;folder.mkdir(parents=True)
 for entry in free:
  code=f"{ord(entry['character']):05x}"
  (folder/f'{code}.json').write_text(json.dumps(strokes[code],ensure_ascii=False))
shutil.copy2(root/'android-app/curriculum/KANJIVG-LICENSE.txt',out/'KANJIVG-LICENSE.txt')
# Protected JSON/PDF/audio always go through the authenticated native interceptor.
(out/'data').mkdir()
assert not (out/'pdfs').exists() and not (out/'audio').exists()
assert not any((out/name).exists() for name in ['index.html','n5.html','settings.html','progress.html','app.js'])
manifest={str(p.relative_to(source)):hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
(out.parent/'source-manifest.json').write_text(json.dumps(manifest,indent=2))
print('Reader ready: five preview levels; protected full curricula remain server-side')

# Do not leave modern syntax in the Android 6 reader or the native state-restore hook.
script_pattern=re.compile(r'(<script(?:\s[^>]*)?>)(.*?)(</script>)',re.S)
for html in out.glob('*.html'):
 markup=html.read_text();matches=list(script_pattern.finditer(markup))
 source_scripts=[m.group(2) for m in matches if m.group(2).strip()]
 if source_scripts:
  result=subprocess.run(['node',str(root/'android-app/scripts/compile_reader_scripts.mjs')],input=json.dumps(source_scripts),capture_output=True,text=True,check=True)
  compiled=iter(json.loads(result.stdout))
  markup=script_pattern.sub(lambda m:m.group(1)+(next(compiled) if m.group(2).strip() else m.group(2))+m.group(3),markup)
 markup=markup.replace('<script','<script>window.readerErrors=[];window.onerror=function(message,source,line){window.readerErrors.push(String(message)+" @"+line);};</script><script src="compat.js"></script><script',1)
 html.write_text(markup)
# Listening is an app-contained controller rather than the website application.
result=subprocess.run(['node',str(root/'android-app/scripts/compile_reader_scripts.mjs')],input=json.dumps([(out/'listening.js').read_text(),(out/'strokes.js').read_text(),(out/'listening-core.js').read_text()]),capture_output=True,text=True,check=True)
compiled_assets=json.loads(result.stdout)
(out/'listening.js').write_text(compiled_assets[0])
(out/'strokes.js').write_text(compiled_assets[1])

(out/'listening-core.js').write_text(compiled_assets[2])
