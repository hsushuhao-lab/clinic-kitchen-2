"""Build matched furniture and continuous clinic cutaway at native game scale."""
from PIL import Image,ImageDraw,ImageFilter
import math
from chibi_draw import *

def gradient(im,b,a,c):
 x0,y0,x1,y1=b;d=ImageDraw.Draw(im);a=bytes.fromhex(a[1:]);c=bytes.fromhex(c[1:])
 for y in range(round(y0*S),round(y1*S)):
  t=(y-y0*S)/max(1,(y1-y0)*S)
  d.line((x0*S,y,x1*S,y),fill=tuple(round(a[k]*(1-t)+c[k]*t) for k in range(3))+(255,))

# Approved clinical furniture, masked from the same original sheet (native pixels).
CUTS={
'desk':[(236,423),(251,412),(255,399),(275,395),(285,373),(297,373),(325,391),(356,416),(358,440),(386,446),(414,453),(451,479),(494,498),(530,529),(530,548),(519,555),(511,590),(468,618),(445,663),(412,692),(394,699),(365,680),(360,663),(274,620),(264,619),(239,599)],
'printer':[(338,352),(341,338),(371,326),(395,328),(409,334),(423,349),(438,363),(449,389),(446,411),(419,422),(367,423),(338,401)],
'cabinet':[(457,270),(469,260),(489,258),(516,258),(549,255),(556,269),(556,375),(473,397),(457,386)],
'sink':[(580,328),(586,315),(603,309),(613,296),(622,291),(630,300),(628,314),(651,319),(681,321),(694,305),(702,296),(712,300),(718,314),(750,331),(750,438),(729,449),(612,471),(589,455)],
'chair':[(475,615),(485,591),(515,585),(563,569),(610,552),(646,560),(647,584),(643,616),(640,644),(651,702),(645,710),(637,659),(611,682),(606,771),(599,786),(593,781),(592,696),(542,704),(533,778),(526,779),(526,699),(477,674),(472,729),(466,729),(470,652),(461,636)]}

def furniture(kind,w,h):
 if kind in CUTS:
  source=Image.open(ROOT/'assets/art_direction/approved/clinic_layout.png')
  cut,_=head_crop(source,CUTS[kind]);cut.thumbnail((w-12,h-12),Image.Resampling.LANCZOS)
  im=Image.new('RGBA',(w,h));im.alpha_composite(cut,((w-cut.width)//2,h-cut.height-4));return im
 im=canvas(w,h);x=10;y=h-73;ww=w-30
 shadow=canvas(w,h);ellipse(shadow,(4,h-28,w-2,h-5),'#162e4338');im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(5*S)))
 def cabinet(wood=False):
  gradient(im,(x,y,x+ww,y+52),'#d7ad73' if wood else '#e5eae3','#b48f63' if wood else '#b5c5c3')
  rr(im,(x,y,x+ww,y+52),None,'#627975',1,.8)
  poly(im,[(x+ww,y),(x+ww+19,y-19),(x+ww+19,y+35),(x+ww,y+52)],'#9fb1ad' if not wood else '#95724c','#647874',.8)
  poly(im,[(x,y),(x+19,y-19),(x+ww+19,y-19),(x+ww,y)],'#edf0e6' if not wood else '#dfba84','#7a918e',.8)
  line(im,[(x+2,y+2),(x+ww-1,y+2)],'#fffdf0',1)
  for xx in (x+4,x+ww-8):rr(im,(xx,y+51,xx+5,y+61),'#536475',None,1)
 if kind=='fridge':
  gradient(im,(10,24,w-23,h-11),'#f1f0e4','#becfc9')
  poly(im,[(10,23),(w-22,23),(w-9,10),(23,10)],'#f1f1e4','#6d888b',1)
  poly(im,[(w-22,23),(w-9,10),(w-9,h-24),(w-22,h-10)],'#9eafae','#607b81',1)
  rr(im,(12,25,w-23,h-12),None,'#6a8083',2,1);line(im,[(13,h*.41),(w-26,h*.41)],'#697f83',2)
  for py in (h*.29,h*.64):rr(im,(w-33,py,w-29,py+20),'#4b6b72','#223e50',1,.5)
  rr(im,(22,31,40,49),'#f1d892','#9b946a',1,.5)
  for j in range(3):line(im,[(19,h-24+j*3),(w-36,h-24+j*3)],'#95aaa4',.6)
 elif kind=='prep':
  cabinet()
  for xx in (x+ww*.25,x+ww*.7):line(im,[(xx,y+3),(xx,y+47)],'#889f9d',1)
  poly(im,[(38,y-12),(53,y-24),(w-30,y-24),(w-47,y-11)],'#d9b279','#88683f',.8)
  for i in range(5):line(im,[(52+i*15,y-19),(58+i*15,y-12)],'#ac844e',.6)
  for xx,yy in ((64,y-22),(80,y-22),(92,y-19)):poly(im,[(xx,yy),(xx+9,yy),(xx+7,yy+6),(xx-2,yy+6)],'#fff6d9','#bdb097',.4)
  line(im,[(w-66,y-19),(w-41,y-11)],'#788487',3)
  # Three ingredient containers and a pen-like utensil holder.
  for i,c in enumerate(('#5f8858','#ecce9b','#ab4834')):
   rr(im,(16+i*17,y-35,29+i*17,y-23),'#b6c9c3','#62847f',1,.5)
   ellipse(im,(18+i*17,y-35,27+i*17,y-28),c,None)
 elif kind=='stove':
  cabinet();poly(im,[(26,y-9),(41,y-25),(w-28,y-25),(w-42,y-9)],'#374650',INK,.7)
  ellipse(im,(w*.33,y-33,w*.74,y-6),'#1e2a34','#879793',2)
  ellipse(im,(w*.36,y-28,w*.70,y-11),'#554e3e',None);line(im,[(w*.7,y-24),(w*.86,y-38)],'#7b563c',5)
  for j in range(3):ellipse(im,(32+j*24,y+8,40+j*24,y+16),'#314c5b','#71898a',1)
  rr(im,(29,y+24,w-41,y+41),'#738d94','#e1e3d7',1)
 elif kind=='rice':
  cabinet();rr(im,(20,y-43,w-27,y-5),'#f3efe4','#617e82',12,1)
  ellipse(im,(20,y-51,w-27,y-26),'#e9eee7','#7a8f8d',1)
  rr(im,(w*.4,y-56,w*.66,y-48),'#4e6c71','#2f535e',2,1)
  rr(im,(w*.4,y-24,w*.63,y-15),'#9eb8af','#698d8d',1,.6)
 elif kind=='table':
  cabinet(True)
  for xx in range(20,w-20,15):line(im,[(xx,y-13),(xx+7,y-4)],'#b2864b80',.7)
  ellipse(im,(w*.33,y-20,w*.49,y-8),'#f5f6e7','#7e918b',.7)
  ellipse(im,(w*.58,y-20,w*.75,y-6),'#eef2e5','#708784',.7)
 elif kind=='bed':
  cabinet();poly(im,[(10,y),(30,y-24),(w-5,y-24),(w-26,y)],'#ecefe5','#829a99',1)
  poly(im,[(31,y-17),(55,y-17),(48,y-4),(21,y-4)],'#fffef3','#c3cdbf',.7)
  line(im,[(12,y+4),(w-29,y+4)],'#7f9d9f',2)
 return finish(im)

def room_base():
 im=canvas(1800,350)
 gradient(im,(0,0,1800,120),'#f8f3e7','#cbdcd9');gradient(im,(0,120,1800,350),'#ede5d1','#d8ceb5')
 for yy in (150,190,234,282,336):line(im,[(0,yy),(1800,yy)],'#bcbbaa50',.7)
 for x in range(-100,1900,105):line(im,[(x,120),(x-55,350)],'#c1bdab60',.6)
 rr(im,(0,107,1800,126),'#627f82',None,0);line(im,[(0,108),(1800,108)],'#b7cbc2',2)
 for x in (75,310,565):
  rr(im,(x,18,x+178,95),'#708c91','#4b6874',3,1.2)
  gradient(im,(x+5,23,x+172,90),'#8eb6c6','#c2d9da')
  line(im,[(x+5,51),(x+172,51)],'#dce7dd',3);line(im,[(x+89,23),(x+89,90)],'#e3e8df',3)
  poly(im,[(x+9,25),(x+85,25),(x+12,85)],'#ffffff20',None)
 for x in (1220,1410,1595):
  rr(im,(x,24,x+140,91),'#d9e2d6','#899f96',2,1);line(im,[(x+70,26),(x+70,90)],'#8ca298',1)
  rr(im,(x+59,52,x+63,66),'#657f83',None,1);rr(im,(x+77,52,x+81,66),'#657f83',None,1)
 rr(im,(844,25,935,91),'#f6f0d8','#ad976e',3,1)
 for j in range(3):
  rr(im,(852+j*23,36,870+j*23,67),['#d4e4d5','#eddbac','#b7d3d9'][j],None,1)
  for k in range(3):line(im,[(855+j*23,43+k*5),(866+j*23,43+k*5)],'#839891',.8)
 rr(im,(1010,20,1110,96),'#9fbdc4','#617f8e',2)
 for j in range(12):rr(im,(1012+j*8,24,1018+j*8,96),['#96b5bd','#abc7c9','#b6cfcc'][j%3],None,1)
 for x in (240,920,1450):
  light=canvas(1800,350);ellipse(light,(x-80,-42,x+125,126),'#fff2c52b');im.alpha_composite(light.filter(ImageFilter.GaussianBlur(28*S)))
  rr(im,(x-60,2,x+85,10),'#fff7d3','#b1b5a1',2)
 rr(im,(0,338,1800,350),'#b1946c',None,0);line(im,[(0,338),(1800,338)],'#f3ecd9',2)
 return finish(im)
