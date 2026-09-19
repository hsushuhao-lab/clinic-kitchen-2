"""Verify real atlas frames, leg articulation, alpha, source hashes and rear views."""
from pathlib import Path
from PIL import Image,ImageChops
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
def main():
 m=json.loads((ROOT/'assets/chibi/manifest.json').read_text())
 assert m['cell']==[112,144] and len(m['assets'])==16
 for e in m['source_files']:
  assert hashlib.sha256((ROOT/e['path']).read_bytes()).hexdigest()==e['sha256']
 for e in m['assets']:
  p=ROOT/e['path'];raw=p.read_bytes();assert len(raw)==e['bytes'] and hashlib.sha256(raw).hexdigest()==e['sha256']
  with Image.open(p) as im:
   im.load();assert im.format=='WEBP' and list(im.size)==e['size']
   if p.stem!='room-back':assert im.mode=='RGBA' and im.getchannel('A').getextrema()==(0,255)
 for who in ('speed','heat','strategy'):
  with Image.open(ROOT/f'assets/chibi/{who}.webp') as im:
   im.load();assert im.size==(2688,576)
   for row in range(4):
    for name,(offset,count) in m['animations'].items():
     frames=[im.crop(((offset+i)*112,row*144,(offset+i+1)*112,(row+1)*144)) for i in range(count)]
     assert len({f.tobytes() for f in frames})>=2,(who,row,name,'identical frames')
     assert all(f.getbbox() is not None for f in frames)
     if name in ('walk','run','carry'):
      legs=[f.crop((0,101,112,144)).tobytes() for f in frames]
      assert len(set(legs))>=4,(who,row,name,'legs do not articulate')
   front=im.crop((0,0,112,144));back=im.crop((0,432,112,576))
   assert front.tobytes()!=back.tobytes(),who
 print('Chibi integrity PASS: 16 assets; 288 nonempty physician cells; articulated legs; four facings; source hashes')
if __name__=='__main__':main()
