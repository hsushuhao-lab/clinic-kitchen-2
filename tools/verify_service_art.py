"""R5 validates actual decoded production assets and source provenance, not byte size alone."""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
def main():
 m=json.loads((ROOT/'assets/service/manifest.json').read_text(encoding='utf-8'))
 assert len(m['assets'])==21
 for e in m['assets']:
  p=ROOT/e['path'];raw=p.read_bytes()
  assert hashlib.sha256(raw).hexdigest()==e['sha256'] and len(raw)==e['bytes']
  if e['source']:assert hashlib.sha256((ROOT/e['source']).read_bytes()).hexdigest()==e['source_sha256']
  with Image.open(p) as im:
   im.load();assert im.format=='WEBP' and im.mode=='RGBA' and list(im.size)==e['size']
   assert im.getchannel('A').getextrema()==(0,255)
   if p.stem.startswith('bonk-'):
    assert im.size==(448,144)
    frames=[im.crop((i*112,0,(i+1)*112,144)).tobytes() for i in range(4)]
    assert len(set(frames))==4
 # Show the shipped assets in the CI evidence, not only a source concept poster.
 out=ROOT/'qa/current/service';out.mkdir(parents=True,exist_ok=True)
 contact=Image.new('RGB',(1008,660),'#f5f0e3')
 for i,name in enumerate(['office','student','driver','auntie','quiet','repeat']):
  im=Image.open(ROOT/f'assets/service/{name}.webp');im.thumbnail((158,180));contact.paste(im,(i*168,0),im)
  im=Image.open(ROOT/f'assets/service/patient-{name}.webp').crop((0,0,112,144));contact.paste(im,(i*168+24,200),im)
 for i,name in enumerate(['spicy-normal','spicy-heavy','scallion-yes','scallion-no','rice-half','rice-full']):
  im=Image.open(ROOT/f'assets/service/{name}.webp');contact.paste(im,(i*168,363),im)
 for i,name in enumerate(['speed','heat','strategy']):
  im=Image.open(ROOT/f'assets/service/bonk-{name}.webp').crop((224,0,336,144));contact.paste(im,(i*250+85,510),im)
 contact.save(out/'production-art-contact.png')
 print('Service art integrity PASS: 21 RGBA assets, 12 distinct doctor reaction frames, source hashes match')
if __name__=='__main__':main()
