"""Build isolated Android reading surfaces; never ship the website navigation shell."""
import json,re,shutil,hashlib,subprocess,sys,os
from pathlib import Path
root=Path(__file__).resolve().parents[2]
if not os.environ.get('BOOKS_SNAPSHOT_DIR'):
 subprocess.run([sys.executable,str(root/'android-app/scripts/sync_website.py')],check=True)
source=Path(os.environ.get('BOOKS_SNAPSHOT_DIR',str(root/'android-app/build/website-snapshot')))
out=root/'android-app/app/build/generated/study-assets/reader'
if out.exists():shutil.rmtree(out)
out.mkdir(parents=True)
for directory in ['fonts','vendor']:
 if (source/directory).exists():shutil.copytree(source/directory,out/directory)
# Basics have standalone tables. Strip download/back links so they cannot lead to the old website.
basics=out/'basics';basics.mkdir()
s=(source/'basics/index.html').read_text()
s=re.sub(r'<(?:header|footer|nav)\b[^>]*>.*?</(?:header|footer|nav)>','',s,flags=re.S|re.I)
s=re.sub(r'<a\b[^>]*href=["\'](?!#)[^"\']*["\'][^>]*>.*?</a>','',s,flags=re.S|re.I)
s=s.replace('</head>','<style>body{background:#faf6ef!important;color:#27252a!important}main{padding:18px!important}section{border-radius:16px!important}h1{font-size:26px!important}table{font-size:15px!important}</style></head>')
(basics/'index.html').write_text(s)
for p in (root/'android-app/reader').glob('*.html'):shutil.copy2(p,out/p.name)
for name in ['listening.js','listening.css']:
 s=(source/name).read_text()
 if name.endswith('.js'):s=s.replace("LEVELS=['N5','N4','N3','N2','N1','EXTRA']","LEVELS=['N5']")
 (out/name).write_text(s)
preview=out/'previews';preview.mkdir()
for level in ['n5','n4','n3','n2']:
 data=json.loads((source/'data'/f'lessons-{level}.json').read_text())
 free={kind:data[kind][:5] for kind in ['vocab','grammar','kanji']}
 assert all(len(rows)==5 for rows in free.values())
 (preview/f'lessons-{level}.json').write_text(json.dumps(free,ensure_ascii=False))
# Protected JSON/PDF/audio always go through the authenticated native interceptor.
(out/'data').mkdir()
assert not (out/'pdfs').exists() and not (out/'audio').exists()
assert not any((out/name).exists() for name in ['index.html','n5.html','settings.html','progress.html','app.js'])
manifest={str(p.relative_to(source)):hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
(out.parent/'source-manifest.json').write_text(json.dumps(manifest,indent=2))
print('Isolated Android reader ready: 4 free previews; no website shell or protected curriculum bundled')
