"""Bake full-body 4-direction chibi animation from approved chibi heads.
Coat, limbs, rear hair and furniture are raster-painted, not portrait-map markers.
The original 1448x1086 source sheets are never modified or downsampled in place.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
import hashlib,json,math
from chibi_draw import *
from chibi_scene_paint import furniture,room_base
OUT=ROOT/'assets/chibi';CW,CH=112,144
SOURCE=ROOT/'assets/art_direction/approved/doctor_concepts.png'
HEADS={
'speed':[(330,802),(333,794),(341,787),(346,781),(357,780),(362,775),(373,779),(386,777),(398,783),(405,795),(408,810),(402,825),(402,836),(396,845),(387,850),(376,851),(363,847),(352,839),(344,835),(339,840),(333,836),(330,830),(332,823)],
'heat':[(553,791),(555,778),(563,769),(574,766),(582,762),(593,764),(600,762),(613,768),(619,774),(625,784),(627,798),(622,812),(625,820),(621,827),(614,831),(610,839),(599,844),(583,844),(569,839),(560,830),(555,825),(554,817),(556,811)],
'strategy':[(1012,800),(1014,787),(1020,779),(1031,774),(1040,771),(1050,775),(1056,769),(1068,774),(1079,780),(1087,793),(1089,807),(1083,820),(1088,828),(1083,837),(1075,841),(1070,852),(1057,860),(1043,858),(1030,850),(1020,841),(1017,831),(1018,820)]}
COLORS={'speed':('#d3c5a1','#796f64'),'heat':('#7ea5c7','#40607f'),'strategy':('#d5c799','#8c7754'),'patient':('#95afbc','#536b80')}
ANIMATIONS={'idle':[0,2],'walk':[2,6],'run':[8,6],'carry':[14,6],'work':[20,4]}
DIRECTIONS=['south','west','east','north']

def limb(im,sh,el,hand,sleeve=True):
 line(im,[sh,el,hand],INK,12 if sleeve else 11)
 line(im,[sh,el,hand],'#e9efed' if sleeve else '#3b4e61',9 if sleeve else 8)
 if sleeve:
  line(im,[(sh[0]-2,sh[1]),(el[0]-2,el[1])],'#fffdf4',3)
  ellipse(im,(hand[0]-5,hand[1]-3,hand[0]+5,hand[1]+6),'#efc094',INK,.8)
 else:
  ellipse(im,(hand[0]-7,hand[1]-2,hand[0]+8,hand[1]+5),'#263744',INK,1)
  line(im,[(hand[0]-4,hand[1]+2),(hand[0]+4,hand[1]+2)],'#7b8c93',1)

def rear_head(im,hx,hy,who):
 # Smooth shaded rear hair, not the old enlarged square hair-texture patch.
 ellipse(im,(hx+3,hy+4,hx+74,hy+75),'#252b33','#293641',1)
 poly(im,[(hx+4,hy+31),(hx+3,hy+19),(hx+11,hy+9),(hx+24,hy+3),(hx+30,hy),(hx+39,hy+5),(hx+49,hy+2),(hx+63,hy+9),(hx+72,hy+20),(hx+74,hy+42),(hx+66,hy+58),(hx+13,hy+56)],'#242a31',None)
 ellipse(im,(hx+10,hy+10,hx+62,hy+59),'#30323a',None)
 # Fine curved strands follow the skull and blend, never a pasted oval.
 d=ImageDraw.Draw(im)
 for i in range(10):
  b=box((hx+6+i*1.4,hy+6+i*.8,hx+70-i*.5,hy+67-i*.8))
  d.arc(b,205+i*2,318+i,fill=('#454149' if i%3==0 else '#39383f'),width=2)
 poly(im,[(hx+14,hy+53),(hx+21,hy+65),(hx+31,hy+71),(hx+36,hy+66),(hx+42,hy+72),(hx+54,hy+65),(hx+64,hy+54),(hx+61,hy+68),(hx+46,hy+76),(hx+27,hy+74)],'#242e36',None)
 if who=='strategy':
  line(im,[(hx+6,hy+55),(hx+12,hy+64)],'#85b7a5',1.5);line(im,[(hx+67,hy+55),(hx+63,hy+65)],'#85b7a5',1.5)

def character(head,who,direction,action,frame,tray=None):
 im=canvas(CW,CH);shirt,dark=COLORS[who];north=direction=='north';moving=action in ('walk','run','carry')
 phase=frame/6*math.tau if moving else frame/4*math.tau
 stride=math.sin(phase)*(12 if action=='run' else 7) if moving else 0
 bob=abs(math.sin(phase))*(3 if action=='run' else 1.6) if moving else frame%2*.7
 cx=56+(4 if action=='run' else 0);hipY=109-bob
 for side in (-1,1):
  hip=(cx+side*9,hipY);ankle=(cx+side*10+stride*side,130-abs(stride)*.3*(side>0))
  limb(im,hip,((hip[0]+ankle[0])/2,hipY+12),ankle,False)
 poly(im,[(cx-21,80-bob),(cx+18,80-bob),(cx+24,112-bob),(cx+8,119-bob),(cx,110-bob),(cx-8,120-bob),(cx-26,115-bob)],'#edf1ef',width=1.2)
 poly(im,[(cx+15,84-bob),(cx+24,112-bob),(cx+8,119-bob),(cx+7,105-bob)],'#b7c8d3',None)
 poly(im,[(cx-19,94-bob),(cx-23,112-bob),(cx-10,115-bob),(cx-8,92-bob)],'#fffdf4',None)
 line(im,[(cx,83-bob),(cx,109-bob)],'#8095a1',.7)
 if not north:
  poly(im,[(cx-10,77-bob),(cx+9,77-bob),(cx+7,100-bob),(cx-6,100-bob)],shirt,dark,.6)
  for side in (-1,1):poly(im,[(cx+side*15,77-bob),(cx+side*6,81-bob),(cx+side,99-bob),(cx+side*16,86-bob),(cx+side*9,85-bob)],'#fffef6',INK,.7)
  rr(im,(cx+10,94-bob,cx+20,104-bob),'#f7f5eb','#617b8a',1,.6)
  for i,c in enumerate(('#3f626d','#bc4635','#3a4670')):line(im,[(cx+12+i*2,91-bob),(cx+12+i*2,96-bob)],c,.9)
 else:
  line(im,[(cx-17,91-bob),(cx+16,91-bob)],'#c6d0d3',1);line(im,[(cx,78-bob),(cx,110-bob)],'#c6d0d3',.7)
 for side in (-1,1):
  sh=(cx+side*20,83-bob)
  if action=='carry':el=(cx+side*26,96-bob);hand=(cx+side*22,96-bob)
  elif action=='work':el=(cx+side*25,88-bob);hand=(cx+side*23+frame%2*3,92-bob-frame%3*4)
  else:el=(cx+side*24-stride*side*.45,96-bob);hand=(cx+side*24-stride*side*.8,103-bob+stride*side*.25)
  limb(im,sh,el,hand)
 ellipse(im,(cx-6,70-bob,cx+7,85-bob),'#edbd94',INK,.7)
 hx=cx-39;hy=10-bob
 if north:rear_head(im,hx,hy,who)
 else:
  # West is mirrored 3/4; east is slightly narrower than the frontal south view.
  sideview=direction in ('west','east');paste(im,head,hx+(5 if sideview else 0),hy,73 if sideview else 78,78)
 if action=='carry':
  rr(im,(cx-34,100-bob,cx+35,106-bob),'#ad7646',INK,2,1)
  if tray:paste(im,tray,cx-29,81-bob,59,24)
 if action=='work' and not north:line(im,[(cx+21,94),(cx+36,81+frame%3*3)],'#5a4a32',2)
 im=finish(im)
 return ImageOps.mirror(im) if direction=='west' else im

def build():
 OUT.mkdir(parents=True,exist_ok=True);entries=[]
 original=Image.open(SOURCE);original.load();assert original.size==(1448,1086)
 def save(name,im,kind):
  p=OUT/(name+'.webp');im.save(p,'WEBP',lossless=True,method=4)
  with Image.open(p) as t:t.load();assert t.size==im.size
  entries.append({'path':p.relative_to(ROOT).as_posix(),'size':list(im.size),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'kind':kind})
 tray=Image.open(ROOT/'assets/cooking/tray_served.png').convert('RGBA');crops={}
 for who,points in HEADS.items():
  head,b=head_crop(original,points);crops[who]={'crop':list(b),'polygon':points};sheet=Image.new('RGBA',(CW*24,CH*4))
  for row,d in enumerate(DIRECTIONS):
   for action,(start,count) in ANIMATIONS.items():
    for f in range(count):sheet.paste(character(head,who,d,action,f,tray),((start+f)*CW,row*CH))
  save(who,sheet,'approved chibi head + painted articulated body; 96 animation cells')
 save('room-back',room_base(),'continuous cutaway clinic architecture')
 for kind,w,h in [('desk',190,155),('chair',90,135),('fridge',105,178),('printer',110,153),('sink',150,155),('cabinet',125,150),('prep',198,143),('stove',172,145),('rice',108,149),('table',208,130),('bed',210,110)]:save(kind,furniture(kind,w,h),'depth-sortable clinic furniture')
 npc=Image.open(ROOT/'assets/art_direction/approved/patient_npcs.png').convert('RGBA')
 points=[(151,186),(160,162),(181,150),(201,146),(219,140),(241,145),(259,161),(270,184),(266,208),(255,230),(251,252),(230,269),(206,269),(185,255),(172,235),(160,219)]
 head,_=head_crop(npc,points);sheet=Image.new('RGBA',(CW*4,CH))
 for f in range(4):
  body=character(head,'patient','south','idle',f);over=canvas(CW,CH)
  poly(over,[(34,80),(75,80),(79,105),(70,114),(40,114),(31,102)],'#8da8b7','#314f61',1.2)
  poly(over,[(35,83),(50,79),(59,85),(62,104),(49,105),(46,88)],'#d5dcd9',None)
  poly(over,[(50,83),(57,83),(62,103),(55,111),(50,105)],'#526376',None)
  line(over,[(33,87),(29,99),(41,105)],'#8da8b7',10);line(over,[(77,87),(82,99),(68,105)],'#8da8b7',10)
  ellipse(over,(35,101,45,110),'#efbf97',INK,.7);ellipse(over,(66,100,77,109),'#efbf97',INK,.7)
  body.alpha_composite(finish(over));lower=Image.new('RGBA',body.size);lower.paste(body.crop((0,0,CW,109)),(0,0))
  a=canvas(CW,CH);limb(a,(46,106),(33,115),(36,129+f%2*2),False);limb(a,(65,106),(75,115),(76,130),False)
  a=finish(a);a.alpha_composite(lower);sheet.paste(a,(f*CW,0))
 save('patient',sheet,'seated patient; four foot-tapping frames')
 m={'version':'chibi-world-r2','cell':[CW,CH],'directions':DIRECTIONS,'animations':ANIMATIONS,'head_crops':crops,'source_files':[{'path':q.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(q.read_bytes()).hexdigest()} for q in [SOURCE,ROOT/'assets/art_direction/approved/clinic_layout.png',ROOT/'assets/art_direction/approved/patient_npcs.png']], 'assets':entries}
 (OUT/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 print('Chibi build:',len(entries),'assets; 3 x 96 full-body cells, four patient frames')
if __name__=='__main__':build()
