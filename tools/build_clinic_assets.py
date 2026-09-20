"""R4 queue headshots from approved NPC board; shared seated body keeps scene scale.
Only these derivative crops are published. Original artwork is never overwritten.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
# Coordinates measured in the supplied 1408x1056 reference preview.
BOXES={'office':(147,127,292,281),'student':(540,130,693,300),'driver':(995,144,1159,307),'auntie':(126,546,286,720),'quiet':(533,548,702,723),'repeat':(1003,545,1170,723)}
def build():
 source=ROOT/'assets/art_direction/approved/patient_npcs.png'
 with Image.open(source) as original:
  original=original.convert('RGB');scale=original.width/1408
  out=ROOT/'assets/clinic';out.mkdir(parents=True,exist_ok=True);entries=[]
  with Image.open(ROOT/'assets/chibi/patient.webp') as sprite:
   sprite=sprite.convert('RGBA')
   for name,box in BOXES.items():
    box=tuple(round(x*scale) for x in box);face=original.crop(box)
    for kind in ('portrait','seated'):
     if kind=='portrait':im=face;filename=name+'.webp'
     else:
      im=Image.new('RGBA',sprite.size)
      head=face.resize((77,80),Image.Resampling.LANCZOS).convert('RGBA')
      mask=Image.new('L',(77*4,80*4),0);ImageDraw.Draw(mask).ellipse((0,0,76*4,79*4),fill=255)
      head.putalpha(mask.resize(head.size,Image.Resampling.LANCZOS))
      for frame in range(4):
       body=sprite.crop((frame*112,0,(frame+1)*112,144));body.paste((0,0,0,0),(0,0,112,80))
       body.alpha_composite(head,(18,4));im.alpha_composite(body,(frame*112,0))
      filename='patient-'+name+'.webp'
     path=out/filename;im.save(path,'WEBP',lossless=True,method=4)
     with Image.open(path) as check:
      check.load();assert check.size==im.size and check.format=='WEBP'
      if kind=='seated':assert check.mode=='RGBA' and check.getchannel('A').getextrema()==(0,255)
     entries.append({'path':path.relative_to(ROOT).as_posix(),'size':list(im.size),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'crop':box,'kind':kind})
 manifest={'source':source.relative_to(ROOT).as_posix(),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'note':'Native headshot crops; seated NPCs reuse the verified four-frame body. Not six independent full animation sets.','assets':entries}
 (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('Clinic queue assets: 12 decoded WebP images')
if __name__=='__main__':build()
