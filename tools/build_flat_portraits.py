"""Create UI portraits from the existing approved boards, never from private photos.
These are 2D headshots/map markers, not new character models. Originals are unchanged.
"""
from pathlib import Path
from PIL import Image
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
ASSETS={
 'doctor-speed':('doctor_concepts.png',(98,132,364,398)),
 'doctor-heat':('doctor_concepts.png',(520,73,780,333)),
 'doctor-strategy':('doctor_concepts.png',(950,75,1230,355)),
 'patient-office':('patient_npcs.png',(82,128,342,388)),
}
out=ROOT/'assets/ui';out.mkdir(parents=True,exist_ok=True)
entries=[]
for name,(source,box) in ASSETS.items():
 p=ROOT/'assets/art_direction/approved'/source
 with Image.open(p) as im:
  assert box[2]<=im.width and box[3]<=im.height
  im.crop(box).convert('RGB').resize((256,256),Image.Resampling.LANCZOS).save(out/(name+'.webp'),'WEBP',quality=94,method=6)
 dest=out/(name+'.webp');data=dest.read_bytes()
 entries.append({'path':dest.relative_to(ROOT).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'source':p.relative_to(ROOT).as_posix(),'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'crop':box,'usage':'2D selection portrait and map marker, not a production model'})
(out/'manifest.json').write_text(json.dumps({'purpose':'Approved character illustration for 2D UI; no private photos','assets':entries},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Built 4 approved-art portraits; original source boards unchanged.')

# Hand-reviewed outline masks preserve steel highlights and exclude nearby utensils/text.
# Coordinates refer to the unchanged 1448x1086 approved prop sheet, not enlarged crops.
from PIL import ImageDraw
props=ROOT/'assets/art_direction/approved/props_station.png'
polygons={
 'wok-clean':[(1050,208),(1059,189),(1086,174),(1110,164),(1151,157),(1192,160),(1222,171),(1240,183),(1246,180),(1254,177),(1297,149),(1308,148),(1312,155),(1310,165),(1258,190),(1255,204),(1253,222),(1243,244),(1228,263),(1201,278),(1164,286),(1131,286),(1098,278),(1073,263),(1057,242),(1050,221)],
 'knife-clean':[(1067,345),(1070,337),(1083,332),(1140,338),(1169,346),(1196,356),(1216,370),(1220,377),(1191,380),(1130,375),(1136,355),(1074,356),(1067,352)],
 'board-clean':[(1222,392),(1265,327),(1275,327),(1421,345),(1425,352),(1412,434),(1403,443),(1227,416),(1221,410)],
 'spatula-clean':[(1343,283),(1365,248),(1372,235),(1386,233),(1402,207),(1408,188),(1420,157),(1425,154),(1430,154),(1434,158),(1432,167),(1414,208),(1405,211),(1396,238),(1404,245),(1401,293),(1399,299),(1350,291)],
}
with Image.open(props) as im:
 for name,polygon in polygons.items():
  xs,ys=zip(*polygon);box=(min(xs)-2,min(ys)-2,max(xs)+3,max(ys)+3)
  crop=im.crop(box).convert('RGBA');mask=Image.new('L',(crop.width*4,crop.height*4),0)
  ImageDraw.Draw(mask).polygon([((x-box[0])*4,(y-box[1])*4) for x,y in polygon],fill=255)
  crop.putalpha(mask.resize(crop.size,Image.Resampling.LANCZOS))
  dest=out/(name+'.webp');crop.save(dest,'WEBP',lossless=True,method=6);data=dest.read_bytes()
  entries.append({'path':dest.relative_to(ROOT).as_posix(),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'source':props.relative_to(ROOT).as_posix(),'source_sha256':hashlib.sha256(props.read_bytes()).hexdigest(),'crop':box,'mask_polygon':polygon,'native_size':list(crop.size),'usage':'Native-resolution prop cutout; no claim of new high-resolution render'})
(out/'manifest.json').write_text(json.dumps({'purpose':'Approved art UI and masked utensils; no private photos','assets':entries},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Built 4 native-resolution masked props; no threshold-based removal of metal highlights.')
