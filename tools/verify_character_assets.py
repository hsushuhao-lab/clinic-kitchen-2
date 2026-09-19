"""Validate provenance, full decoding, native dimensions, alpha and source fidelity."""
from pathlib import Path
import hashlib,json
from PIL import Image,ImageChops,ImageStat
ROOT=Path(__file__).resolve().parents[1]
def main():
 manifest=json.loads((ROOT/'assets/ui/character-manifest.json').read_text(encoding='utf-8'))
 expected={'doctor-speed-bust','doctor-heat-bust','doctor-strategy-bust','patient-office-bust'}
 assert {Path(e['path']).stem for e in manifest['assets']}==expected
 for e in manifest['assets']:
  p=ROOT/e['path'];source=ROOT/e['source'];raw=p.read_bytes()
  assert len(raw)==e['bytes'] and hashlib.sha256(raw).hexdigest()==e['sha256'],e['path']
  assert hashlib.sha256(source.read_bytes()).hexdigest()==e['source_sha256'],e['source']
  with Image.open(p) as im,Image.open(source) as original:
   im.load();original.load()
   assert im.format=='WEBP' and im.mode=='RGBA'
   assert list(im.size)==e['native_size'] and min(im.size)>=300
   box=e['crop'];assert im.size==(box[2]-box[0],box[3]-box[1])
   alpha=im.getchannel('A');assert alpha.getextrema()==(0,255)
   opaque=alpha.point(lambda a:255 if a>=254 else 0)
   difference=ImageChops.difference(im.convert('RGB'),original.crop(box).convert('RGB'))
   error=ImageStat.Stat(difference,mask=opaque).mean
   assert max(error)<8,('Approved source pixels changed',e['path'],error)
   print('PASS:',p.name,im.size,'native RGBA; maximum channel mean error',round(max(error),3))
 print('4/4 character assets: provenance, native resolution, transparency and source fidelity PASS')
if __name__=='__main__':main()
