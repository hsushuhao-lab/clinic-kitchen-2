from html.parser import HTMLParser
from pathlib import Path
import subprocess
import shutil
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
class Parser(HTMLParser):
    def __init__(self): super().__init__(); self.ids=[]; self.urls=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if 'id' in attrs: self.ids.append(attrs['id'])
        if tag == 'script' and attrs.get('src'): self.urls.append(attrs['src'])
        if tag == 'link' and attrs.get('rel') == 'stylesheet': self.urls.append(attrs['href'])
p=Parser();p.feed((ROOT/'index.html').read_text(encoding='utf-8'))
assert len(p.ids)==len(set(p.ids)), 'Duplicate DOM IDs'
for element in ['world','camera','player','cookingDeck','boardFood','cutBtn','heatBtn','addBtn','stirBtn','plateBtn','wokContents','recipeLog']:
    assert element in p.ids, f'Missing ID: {element}'
for url in p.urls:
    parsed=urlsplit(url)
    assert not parsed.scheme, f'Unexpected external runtime dependency: {url}'
    assert (ROOT/parsed.path).is_file(), f'Missing resource: {url}'
assert shutil.which('node'), 'Node.js is required for the syntax gate.'
subprocess.run(['node','--check',str(ROOT/'src/main.js')],check=True)
subprocess.run(['node','--check',str(ROOT/'src/scene3d.js')],check=True)
print(f'Static QA PASS: {len(p.ids)} unique DOM IDs; {len(p.urls)} local script/style resources; JavaScript syntax.')
