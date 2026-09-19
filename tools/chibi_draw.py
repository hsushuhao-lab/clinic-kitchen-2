"""Small supersampled raster drawing helpers for reproducible CK assets."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
S=3
INK='#3b5260'
def canvas(w,h):return Image.new('RGBA',(round(w*S),round(h*S)),(0,0,0,0))
def finish(im):return im.resize((im.width//S,im.height//S),Image.Resampling.LANCZOS)
def box(b):return tuple(round(v*S) for v in b)
def poly(im,points,fill,outline=INK,width=1):
 d=ImageDraw.Draw(im);p=[(round(x*S),round(y*S)) for x,y in points];d.polygon(p,fill=fill)
 if outline:d.line(p+[p[0]],fill=outline,width=max(1,round(width*S)),joint='curve')
def line(im,points,fill,width=1):ImageDraw.Draw(im).line([(round(x*S),round(y*S)) for x,y in points],fill=fill,width=max(1,round(width*S)),joint='curve')
def rr(im,b,fill,outline=None,r=2,width=1):ImageDraw.Draw(im).rounded_rectangle(box(b),radius=round(r*S),fill=fill,outline=outline,width=max(1,round(width*S)))
def ellipse(im,b,fill,outline=None,width=1):ImageDraw.Draw(im).ellipse(box(b),fill=fill,outline=outline,width=max(1,round(width*S)))
def paste(im,src,x,y,w=None,h=None):
 if w is not None:src=src.resize((round(w*S),round(h*S)),Image.Resampling.LANCZOS)
 im.alpha_composite(src,(round(x*S),round(y*S)))
def head_crop(original,points):
 xs,ys=zip(*points);b=(min(xs)-1,min(ys)-1,max(xs)+2,max(ys)+2)
 crop=original.crop(b).convert('RGBA');a=Image.new('L',(crop.width*4,crop.height*4),0)
 ImageDraw.Draw(a).polygon([((x-b[0])*4,(y-b[1])*4) for x,y in points],fill=255)
 crop.putalpha(a.resize(crop.size,Image.Resampling.LANCZOS));return crop,b
