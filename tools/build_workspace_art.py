"""Build illustrated environment views and clean food sprites from approved sources.
No original is overwritten. Polygons exclude tray rims, photo backgrounds and labels.
Workspace crops are camera views, not newly painted rooms or character animation.
"""
from pathlib import Path
import hashlib,json
from PIL import Image,ImageDraw,ImageEnhance
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/workspace'
APP=ROOT/'assets/art_direction/approved'

def build():
 OUT.mkdir(parents=True,exist_ok=True);entries=[]
 def save(name,im,source,details):
  path=OUT/(name+'.webp');im.save(path,'WEBP',quality=96,method=6,exact=True)
  with Image.open(path) as check:check.load();assert check.size==im.size
  entries.append({'path':path.relative_to(ROOT).as_posix(),'source':str(source.relative_to(ROOT)),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'size':list(im.size),'mode':im.mode,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),**details})
 def crop(name,source,box):
  with Image.open(source) as original:
   # Design coordinates measured on the 1408x1056 review, not arbitrary scaling.
   b=tuple(round(v*original.width/1408) for v in box)
   save(name,original.crop(b).convert('RGB'),source,{'crop':b,'type':'approved environment camera crop'})
 def cut(name,source,points,reference_width=None):
  with Image.open(source) as im:
   ratio=im.width/reference_width if reference_width else 1
   pts=[(round(x*ratio),round(y*ratio)) for x,y in points]
   xs,ys=zip(*pts);box=(max(0,min(xs)-1),max(0,min(ys)-1),min(im.width,max(xs)+2),min(im.height,max(ys)+2))
   result=im.crop(box).convert('RGBA');a=Image.new('L',(result.width*4,result.height*4),0)
   ImageDraw.Draw(a).polygon([((x-box[0])*4,(y-box[1])*4) for x,y in pts],fill=255)
   result.putalpha(a.resize(result.size,Image.Resampling.LANCZOS));save(name,result,source,{'crop':box,'polygon':pts,'type':'native alpha mask; not a new render'})
   return result
 crop('clinic-view',APP/'clinic_layout.png',(1030,76,1388,301))
 crop('storage-view',APP/'clinic_layout.png',(1041,368,1304,582))
 crop('prep-view',APP/'props_station.png',(722,664,1054,947))
 crop('wok-view',APP/'cooking_mode.png',(955,750,1365,939))
 # Existing source crops include photography squares; preserve just the food itself.
 foods=ROOT/'assets/ingredients/mapo_tofu'
 cut('tofu-whole',foods/'tofu.png',[(14,52),(55,19),(77,28),(78,48),(39,90),(14,78)])
 cut('garlic-whole',foods/'garlic.png',[(57,20),(63,23),(67,38),(83,45),(94,53),(101,65),(98,80),(87,89),(68,97),(53,100),(38,96),(30,88),(26,76),(29,65),(38,54),(51,46),(57,39),(54,27)])
 cut('scallion-whole',foods/'scallion.png',[(10,77),(24,71),(53,54),(85,17),(90,20),(74,40),(96,20),(101,24),(76,48),(109,32),(115,36),(116,42),(89,63),(52,80),(27,95),(21,91),(33,79),(17,86),(13,81)])
 pork=cut('pork-raw',foods/'pork.png',[(15,51),(29,40),(39,27),(54,24),(59,27),(79,29),(95,32),(108,43),(116,62),(117,85),(96,97),(81,112),(67,115),(58,108),(44,111),(28,101),(12,99),(7,84),(7,74)])
 cut('pepper',foods/'pepper.png',[(21,48),(24,34),(36,32),(45,23),(57,27),(62,22),(72,29),(83,26),(95,42),(109,44),(113,63),(109,82),(99,92),(86,104),(72,103),(60,109),(42,99),(31,103),(22,89),(22,68),(12,61)])
 cut('douban-paste',foods/'douban.png',[(16,47),(30,36),(53,29),(73,28),(94,36),(108,48),(114,63),(104,79),(82,91),(52,94),(30,87),(17,75),(12,61)])
 props=APP/'props_station.png'
 cut('scallion-cut',props,[(44,338),(48,325),(57,320),(60,309),(68,316),(79,307),(87,313),(98,310),(109,319),(118,315),(127,325),(140,334),(134,350),(122,359),(104,357),(94,362),(77,355),(65,359),(52,351),(37,347)],1408)
 cut('garlic-cut',props,[(175,338),(178,326),(193,321),(200,316),(208,323),(216,315),(224,323),(234,318),(239,326),(251,329),(257,342),(257,354),(241,359),(225,358),(207,357),(190,358),(179,351)],1408)
 cut('pork-cut',props,[(335,220),(339,205),(349,202),(351,193),(369,195),(379,180),(394,187),(407,179),(422,187),(436,184),(451,191),(466,188),(477,197),(492,195),(508,207),(521,213),(518,229),(505,238),(482,244),(459,240),(436,245),(411,237),(389,238),(364,233),(343,233)],1408)
 cube=cut('tofu-cube',props,[(130,195),(149,185),(170,197),(172,217),(150,229),(131,216)],1408)
 diced=Image.new('RGBA',(170,106),(0,0,0,0))
 for row in range(3):
  for col in range(4):
   diced.alpha_composite(cube,(col*39+row*3,row*25))
 save('tofu-diced',diced,props,{'type':'twelve native approved tofu cubes; no tray or label','derived_from':'tofu-cube.webp'})
 cut('stove',props,[(1014,479),(1075,446),(1084,434),(1198,436),(1206,446),(1279,456),(1284,469),(1280,517),(1204,559),(1191,557),(1015,521)],1408)
 cut('simmer-food',props,[(1107,785),(1129,776),(1141,774),(1156,782),(1164,789),(1180,780),(1200,781),(1210,790),(1228,784),(1241,795),(1259,794),(1273,800),(1259,814),(1244,823),(1211,831),(1174,827),(1139,814),(1115,810)],1408)
 # The two intermediate tofu states split the same texture, not black lines on a photo.
 with Image.open(OUT/'tofu-whole.webp') as original:
  for name,count in [('tofu-halves',2),('tofu-strips',4)]:
   gap=5;im=Image.new('RGBA',(original.width+gap*(count-1),original.height),(0,0,0,0))
   for i in range(count):
    left=round(i*original.width/count);right=round((i+1)*original.width/count)
    im.alpha_composite(original.crop((left,0,right,original.height)),(left+i*gap,0))
   save(name,im,foods/'tofu.png',{'derived_from':'tofu-whole.webp','type':'same source pixels separated into cuts; not 3D'})
 cooked=ImageEnhance.Color(pork).enhance(.45);cooked=ImageEnhance.Brightness(cooked).enhance(.68)
 save('pork-cooked',cooked,foods/'pork.png',{'type':'cooking-state tint of same masked source'})
 # Remove disconnected neighbouring utensil fragments by alpha connectivity only.
 # Never threshold RGB brightness: metal highlights and white coats must survive.
 spoon_source=ROOT/'assets/cooking/douban_spoon.png'
 with Image.open(spoon_source) as spoon:
  spoon=spoon.convert('RGBA');alpha=spoon.getchannel('A');w,h=spoon.size;pix=alpha.load()
  unseen={(x,y) for y in range(h) for x in range(w) if pix[x,y]>0};best=set()
  while unseen:
   seed=unseen.pop();component={seed};stack=[seed]
   while stack:
    x,y=stack.pop()
    for neighbour in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
     if neighbour in unseen:unseen.remove(neighbour);component.add(neighbour);stack.append(neighbour)
   if len(component)>len(best):best=component
  mask=Image.new('L',spoon.size,0)
  for x,y in best:mask.putpixel((x,y),pix[x,y])
  spoon.putalpha(mask);box=mask.getbbox()
  save('ladle-clean',spoon.crop(box),spoon_source,{'crop':box,'type':'largest alpha-connected utensil; neighbouring fragments excluded'})
 (OUT/'manifest.json').write_text(json.dumps({'version':'workspace-r1','assets':entries},ensure_ascii=False,indent=2)+'\n')
 print('Workspace art:',len(entries),'decoded, native-resolution files')
if __name__=='__main__':build()
