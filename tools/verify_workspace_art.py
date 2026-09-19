"""Verify decoded bytes, source provenance and alpha; size alone cannot certify art."""
from pathlib import Path
from PIL import Image
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
def main():
 m=json.loads((ROOT/'assets/workspace/manifest.json').read_text())
 assert len(m['assets'])==21
 for e in m['assets']:
  raw=(ROOT/e['path']).read_bytes();assert hashlib.sha256(raw).hexdigest()==e['sha256']
  assert len(raw)==e['bytes'] and hashlib.sha256((ROOT/e['source']).read_bytes()).hexdigest()==e['source_sha256']
  with Image.open(ROOT/e['path']) as im:
   im.load();assert im.format=='WEBP' and list(im.size)==e['size']
   if e['mode']=='RGBA':assert im.mode=='RGBA' and im.getchannel('A').getextrema()==(0,255)
 # The actual recipe renderer, not the concept gallery, resolves these masks.
 js=(ROOT/'src/workspace-art.js').read_text()
 for name in ['tofu-whole','tofu-halves','tofu-strips','tofu-diced','scallion-cut','garlic-cut','pork-cut','douban-paste']:
  assert name in js
 assert 'portrait(state.doctorId' not in (ROOT/'src/scene2d.js').read_text()
 print('Workspace source/decode/alpha: 21/21 PASS; no cropped-torso locomotion')
if __name__=='__main__':main()
