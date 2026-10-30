"""Export Play artwork from the existing Android vector; never invent app screens."""
from pathlib import Path
import subprocess, sys, xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[2]
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'store-listing'/'export'
out.mkdir(parents=True,exist_ok=True)
ns='{http://schemas.android.com/apk/res/android}'
vector=ET.parse(root/'app/src/main/res/drawable/ic_books.xml').getroot()
paths=[]
for p in vector:
 attrs={'d':p.get(ns+'pathData'),'fill':p.get(ns+'fillColor','none')}
 if p.get(ns+'strokeColor'):attrs.update(stroke=p.get(ns+'strokeColor'),**{'stroke-width':p.get(ns+'strokeWidth')})
 paths.append('<path '+' '.join(f'{k}="{v}"' for k,v in attrs.items())+'/>')
mark=''.join(paths)
symbol=''.join(paths[1:])
icon=f'<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 108 108">{mark}</svg>'
feature=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
<rect width="1024" height="500" fill="#163D38"/>
<circle cx="943" cy="85" r="238" fill="#1D4942"/>
<circle cx="980" cy="520" r="240" fill="#204E44"/>
<path d="M644 0v500" stroke="#C59354" stroke-opacity=".35"/>
<g font-family="DejaVu Sans,sans-serif" fill="#F6F2E9">
<text x="64" y="106" font-size="20" letter-spacing="4" fill="#D9BC8F">JAPANESE STUDY LIBRARY</text>
<text x="60" y="182" font-size="49" font-weight="bold" letter-spacing="1">NIHONGO PATH</text>
<text x="60" y="256" font-size="72" font-weight="bold" letter-spacing="3">BOOKS</text>
<rect x="64" y="290" width="273" height="46" rx="23" fill="#F6F2E9"/>
<text x="88" y="320" font-size="23" fill="#163D38">N5 · N4 · N3 · N2</text>
<text x="64" y="385" font-size="24">Vocabulary · Grammar · Kanji</text>
<text x="64" y="425" font-size="20" fill="#D9BC8F">Bengali + English · N5 listening</text>
</g>
<g transform="translate(695 99) scale(2.47)">{symbol}</g>
<path d="M725 404h206" stroke="#C59354" stroke-width="3"/>
</svg>'''
for name,svg in [('01-app-icon-512',icon),('02-feature-graphic-1024x500',feature)]:
 src=Path(__file__).parent/(name+'.svg');src.write_text(svg)
 subprocess.run(['inkscape',str(src),'--export-type=png','--export-filename='+str(out/(name+'.png'))],check=True,capture_output=True)
from PIL import Image
for p in out.glob('*.png'):
 im=Image.open(p);im.convert('RGBA' if p.name.startswith('01-') else 'RGB').save(p,optimize=True)
print(out)
