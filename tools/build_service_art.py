"""R5: native approved patient silhouettes, illustrated order icons and bonk frames.
No oval-head substitution, RGB-white removal, new identity generation or source overwrite.
The three new concept sheets guide presentation; production pixels derive from the
approved full NPC/doctor artwork already in Git, so every asset is reproducible.
"""
from pathlib import Path
import hashlib,json,math
from PIL import Image,ImageDraw,ImageFilter,ImageOps
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/service'
# Reviewed at 1408x1056. Preserve each person's own hair, face, hands and clothing.
POLYS={
 'office':[(4,414),(9,355),(28,300),(52,269),(90,253),(122,251),(146,236),(151,223),(151,204),(156,184),(155,165),(166,146),(185,137),(207,130),(218,125),(241,128),(262,139),(278,149),(287,144),(298,151),(309,175),(313,196),(308,215),(333,264),(335,373),(300,378),(269,391),(264,420),(10,420)],
 'student':[(496,420),(496,330),(505,298),(531,275),(567,259),(601,253),(612,243),(608,232),(601,225),(594,208),(596,190),(597,171),(606,152),(620,136),(639,128),(649,120),(665,125),(677,117),(691,126),(712,132),(727,151),(735,178),(730,199),(719,219),(710,238),(712,252),(733,265),(758,283),(776,313),(784,354),(760,388),(760,420)],
 'driver':[(962,420),(965,335),(980,320),(1042,296),(1061,278),(1064,259),(1059,246),(1067,224),(1078,204),(1078,188),(1090,172),(1110,153),(1141,141),(1168,143),(1192,154),(1202,179),(1215,195),(1223,214),(1211,225),(1193,218),(1192,246),(1181,274),(1190,287),(1224,294),(1254,311),(1269,337),(1270,391),(1240,393),(1237,420)],
 'auntie':[(9,826),(3,789),(6,747),(25,710),(45,683),(78,661),(123,655),(151,654),(167,641),(159,627),(158,606),(164,587),(178,573),(184,557),(205,546),(224,542),(240,533),(264,536),(277,541),(288,552),(303,562),(310,585),(315,607),(318,631),(306,651),(290,668),(292,687),(310,700),(318,722),(319,747),(318,790),(298,803),(294,827)],
 'quiet':[(523,827),(524,778),(537,730),(552,701),(571,682),(596,665),(605,635),(613,609),(623,583),(637,565),(647,557),(658,548),(681,547),(710,557),(731,580),(744,615),(752,649),(755,687),(781,713),(796,747),(802,786),(761,804),(758,827)],
 'repeat':[(967,827),(977,775),(988,731),(1008,696),(1038,678),(1059,672),(1080,657),(1077,640),(1077,625),(1085,609),(1090,586),(1100,571),(1118,559),(1130,555),(1138,550),(1153,549),(1173,562),(1187,577),(1194,598),(1196,622),(1190,646),(1177,667),(1198,679),(1219,691),(1230,716),(1237,753),(1228,790),(1226,827)]
}

def mask_crop(source,points):
 pts=[(round(x*source.width/1408),round(y*source.height/1056)) for x,y in points]
 xs,ys=zip(*pts);box=(max(0,min(xs)-2),max(0,min(ys)-2),min(source.width,max(xs)+3),min(source.height,max(ys)+3))
 im=source.crop(box).convert('RGBA');mask=Image.new('L',(im.width*4,im.height*4),0)
 ImageDraw.Draw(mask).polygon([((x-box[0])*4,(y-box[1])*4) for x,y in pts],fill=255)
 im.putalpha(mask.resize(im.size,Image.Resampling.LANCZOS));return im,box,pts

def build():
 OUT.mkdir(parents=True,exist_ok=True);entries=[]
 source=ROOT/'assets/art_direction/approved/patient_npcs.png'
 def save(name,im,origin,kind,**detail):
  p=OUT/(name+'.webp');im.save(p,'WEBP',quality=96,method=6,exact=True)
  with Image.open(p) as c:c.load();assert c.size==im.size and c.mode=='RGBA'
  entries.append({'path':p.relative_to(ROOT).as_posix(),'size':list(im.size),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'source':origin.relative_to(ROOT).as_posix() if origin else None,'source_sha256':hashlib.sha256(origin.read_bytes()).hexdigest() if origin else None,'kind':kind,**detail})
 with Image.open(source) as original:
  assert original.size==(1448,1086)
  for name,points in POLYS.items():
   im,box,poly=mask_crop(original,points)
   save(name,im,source,'native original upper-body silhouette; no face/body substitution',crop=box,polygon=poly)
   # Each patient's original upper body, not a photographic oval on the same shirt.
   upper=ImageOps.contain(im,(104,113),Image.Resampling.LANCZOS)
   sheet=Image.new('RGBA',(112*4,144))
   for frame in range(4):
    cell=Image.new('RGBA',(112,144));d=ImageDraw.Draw(cell)
    d.rounded_rectangle((33,104,51,135+frame%2),4,fill='#334858')
    d.rounded_rectangle((64,104,82,135+(frame+1)%2),4,fill='#334858')
    d.rounded_rectangle((32,129,48,137+frame%2),3,fill='#243742')
    d.rounded_rectangle((67,129,85,137+(frame+1)%2),3,fill='#243742')
    cell.alpha_composite(upper,((112-upper.width)//2,119-upper.height+(frame//2)))
    sheet.alpha_composite(cell,(frame*112,0))
   save('patient-'+name,sheet,source,'four seated micro-motion frames using own complete torso',crop=box)
 # Shared line/shading language. These are small raster UI assets, not emoji glyphs.
 S=3
 def icon():return Image.new('RGBA',(144*S,120*S))
 def draw_chili(im,shift=0,scale=1):
  def bez(a,b,c,d):
   return [((1-t)**3*a[0]+3*(1-t)**2*t*b[0]+3*(1-t)*t*t*c[0]+t**3*d[0],(1-t)**3*a[1]+3*(1-t)**2*t*b[1]+3*(1-t)*t*t*c[1]+t**3*d[1]) for t in [i/30 for i in range(31)]]
  shape=bez((26,99),(61,100),(107,66),(98,37))+bez((98,37),(92,14),(64,22),(66,51))+bez((66,51),(63,72),(50,85),(26,99))
  tr=lambda pts:[(round((x*scale+shift)*S),round((y*scale+10*(1-scale))*S)) for x,y in pts]
  d=ImageDraw.Draw(im);pts=tr(shape);d.polygon(pts,fill='#bc352c');d.line(pts+[pts[0]],fill='#294555',width=3*S,joint='curve')
  d.line(tr(bez((39,93),(64,89),(87,61),(85,34))),fill='#ef6e54',width=6*S,joint='curve')
  d.line(tr(bez((70,46),(72,36),(77,31),(81,32))),fill='#ffe6c1',width=3*S,joint='curve')
  d.line(tr(bez((79,29),(81,17),(85,14),(93,16))),fill='#396447',width=5*S,joint='curve')
 def complete(name,im,origin=None):save(name,im.resize((144,120),Image.Resampling.LANCZOS),origin,'illustrated order icon')
 im=icon();draw_chili(im,10);complete('spicy-normal',im)
 im=icon();draw_chili(im,-6,.85);draw_chili(im,43,.85);complete('spicy-heavy',im)
 spr=ROOT/'assets/workspace/scallion-cut.webp'
 for yes in (True,False):
  im=icon();veg=Image.open(spr).convert('RGBA');veg=ImageOps.contain(veg,(124*S,94*S),Image.Resampling.LANCZOS)
  im.alpha_composite(veg,((144*S-veg.width)//2,(120*S-veg.height)//2))
  if not yes:
   d=ImageDraw.Draw(im);d.ellipse((92*S,66*S,137*S,111*S),fill='#c84a40',outline='#fff6e5',width=3*S)
   d.line([(103*S,77*S),(126*S,100*S)],fill='white',width=5*S);d.line([(126*S,77*S),(103*S,100*S)],fill='white',width=5*S)
  complete('scallion-yes' if yes else 'scallion-no',im,spr)
 for full in (True,False):
  im=icon();d=ImageDraw.Draw(im)
  # Porcelain blue-rim bowl with different rice silhouettes, same camera/scale.
  d.ellipse((27*S,85*S,122*S,109*S),fill='#263c4828')
  d.pieslice((22*S,25*S,126*S,103*S),0,180,fill='#f8f0dd',outline='#314a59',width=2*S)
  d.ellipse((22*S,37*S,126*S,76*S),fill='#d4e2e1',outline='#305775',width=3*S)
  ricebox=(27*S,(14 if full else 49)*S,120*S,(66 if full else 69)*S)
  d.ellipse(ricebox,fill='#fff8e5',outline='#baac8e',width=1*S)
  for i in range(26 if full else 12):
   x=39+(i*19)%71;y=(26+(i*11)%29) if full else (55+(i*3)%8)
   d.ellipse((x*S,y*S,(x+7)*S,(y+4)*S),fill='#ede2c8',outline='#fffdf1',width=S)
  for x,y in [(43,84),(72,91),(103,83)]:
   for dx,dy in [(0,-3),(3,0),(0,3),(-3,0)]:d.ellipse(((x+dx-2)*S,(y+dy-2)*S,(x+dx+2)*S,(y+dy+2)*S),fill='#709cbb')
  complete('rice-full' if full else 'rice-half',im)
 # Bonk reaction retains each selected doctor's existing head/glasses/shirt identity.
 for who in ('speed','heat','strategy'):
  path=ROOT/f'assets/chibi/{who}.webp'
  with Image.open(path) as atlas:
   base=atlas.crop((0,0,112,144)).convert('RGBA');sheet=Image.new('RGBA',(112*4,144))
   for f in range(4):
    cell=base.copy().rotate([-9,5,-3,0][f],Image.Resampling.BICUBIC,center=(56,115))
    d=ImageDraw.Draw(cell)
    if f in (1,2) and who!='strategy':
     d.ellipse((54,70,74,85),fill='#edbd94');d.arc((56,76,72,87),185,350,fill='#684d43',width=2)
    if f>=1:d.ellipse((76,5,92,23),fill='#ed9f91',outline='#a76159',width=1);d.arc((80,7,89,17),190,280,fill='#ffe1ba',width=2)
    if f>=2:
     d.line([(77,90),(93,67),(90,37)],fill='#324b5c',width=12)
     d.line([(77,90),(93,67),(90,37)],fill='#ecf0e9',width=9)
     d.ellipse((84,29,96,43),fill='#edbc92',outline='#695b52',width=1)
     d.ellipse((33,57,37,65),fill='#a7d8e9')
    for j in range(3):
     cx=22+j*31;cy=10+(j%2)*3+(f%2)*3
     points=[]
     for k in range(10):
      a=k*math.pi/5-math.pi/2;r=6 if k%2==0 else 2.6;points.append((cx+math.cos(a)*r,cy+math.sin(a)*r))
     d.polygon(points,fill='#f7cd69',outline='#ae793b')
    sheet.alpha_composite(cell,(f*112,0))
   save('bonk-'+who,sheet,path,'four-frame comic impact/dazed/rub/recovery; no gore; not a new face')
 manifest={'version':'R5_SERVICE_POLISH','assets':entries,'notes':'New concept boards guide expression/UI; original approved NPC pixels and existing doctor atlases are production sources. No extra tofu or new recipe rules.'}
 (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('R5 service art:',len(entries),'decoded assets, source hashes recorded')
if __name__=='__main__':build()
