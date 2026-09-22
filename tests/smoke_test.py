from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
import shutil, subprocess

ROOT=Path(__file__).resolve().parents[1]
class Parser(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]; self.urls=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        if tag=='script' and a.get('src'): self.urls.append(a['src'])
        if tag=='link' and a.get('rel')=='stylesheet': self.urls.append(a['href'])
p=Parser(); p.feed((ROOT/'index.html').read_text(encoding='utf-8'))
assert len(p.ids)==len(set(p.ids)), 'Duplicate DOM IDs'
for element in ['app','patientPanel','ticketNumber','patientPortrait','symptomList','prescriptionGrid','main','workflow','doctorMarker','stagePanel','statusBar']:
    assert element in p.ids, f'Missing ID: {element}'
for url in p.urls:
    parsed=urlsplit(url)
    assert not parsed.scheme, f'Unexpected external runtime dependency: {url}'
    assert (ROOT/parsed.path).is_file(), f'Missing resource: {url}'
assert shutil.which('node'), 'Node.js is required for the syntax gate.'
for name in ('src/clinic-rules.js','src/r9-game.js'):
    subprocess.run(['node','--check',str(ROOT/name)],check=True)
print(f'R9 Static QA PASS: {len(p.ids)} unique DOM IDs; {len(p.urls)} local script/style resources; JavaScript syntax.')
