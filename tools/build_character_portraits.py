"""Extract approved realistic upper-body illustrations without redrawing identities.
Polygons were reviewed on a 1408x1056 preview of original 1448x1086 boards.
Outputs retain native resolution with antialiased alpha; not models or animations.
No photos, AI upscaling, color replacement or threshold removal of white coats.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = (1408, 1056)
# Lower boundaries stop before the slogan/cards/chibi strip. Interior pixels remain
# those of the approved hair, glasses, face, coat, clothing and characteristic props.
PORTRAITS = {
    'doctor-speed-bust': ('doctor_concepts.png', [
        (1,369),(17,341),(35,323),(58,300),(65,279),(75,263),(106,249),(124,246),
        (143,257),(188,264),(207,255),(208,229),(209,204),(212,180),(222,160),
        (239,153),(251,141),(270,139),(279,130),(293,137),(310,136),(322,143),
        (338,150),(348,169),(354,189),(351,215),(337,249),(324,280),(311,306),
        (313,324),(331,341),(342,358),(352,383),(357,412),(351,437),(350,464),
        (304,476),(62,476),(62,450),(38,449),(17,440),(1,423)
    ]),
    'doctor-heat-bust': ('doctor_concepts.png', [
        (478,477),(480,384),(476,353),(483,323),(499,295),(532,274),(568,257),
        (612,244),(620,232),(617,211),(610,193),(611,175),(619,162),(624,144),
        (624,126),(631,105),(645,90),(663,82),(681,76),(693,70),
        (704,77),(718,75),(732,85),(742,103),(746,123),(745,147),(743,167),
        (746,184),(738,207),(727,224),(715,246),(723,266),(745,281),(768,297),
        (789,322),(798,352),(804,394),(817,429),(829,445),(841,464),(843,479)
    ]),
    'doctor-strategy-bust': ('doctor_concepts.png', [
        (889,477),(883,449),(887,421),(898,393),(912,375),(923,349),(928,330),
        (936,309),(946,294),(975,280),(996,278),(1007,268),(1017,260),(1000,257),(1000,253),
        (1016,253),(1026,246),(1035,239),(1028,233),(1023,219),(1016,216),
        (1006,203),(1002,194),(1008,185),(1015,178),(1008,164),(1001,146),
        (997,127),(1000,113),(1005,100),(1016,89),(1034,80),(1046,73),
        (1059,70),(1069,70),(1085,73),
        (1097,79),(1110,86),(1120,105),(1127,123),(1130,145),(1131,162),
        (1138,160),(1145,165),(1143,183),(1138,195),(1130,202),(1133,224),
        (1139,236),(1149,250),(1185,271),(1213,284),(1233,298),(1235,477)
    ]),
    'patient-office-bust': ('patient_npcs.png', [
        (27,415),(27,347),(39,299),(48,278),(65,262),(93,248),(118,249),
        (145,236),(151,234),(150,225),(148,211),(148,199),(154,187),
        (161,183),(156,174),(156,158),(173,141),(188,135),(207,135),(218,124),
        (240,126),(252,130),(269,143),(278,147),(284,144),(291,147),(294,145),
        (300,158),(308,168),(313,187),(309,202),(308,217),(319,241),(332,263),
        (333,372),(302,376),(278,375),(266,394),(267,415)
    ])
}
SOURCE_HASHES = {
    'doctor_concepts.png': 'bbdb86634a431a7555a5c4c557bd90b885ce32adf75bd55b3c261d83e34b0dfb',
    'patient_npcs.png': 'f30774a30821d84d3d95d45d39b4a11830a7ef1d8814b29c47ee507bb2ccad67'
}

def build():
    out = ROOT / 'assets/ui'
    out.mkdir(parents=True, exist_ok=True)
    entries = []
    for name, (filename, polygon) in PORTRAITS.items():
        source = ROOT / 'assets/art_direction/approved' / filename
        source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        if source_hash != SOURCE_HASHES[filename]:
            raise ValueError('Approved source bytes changed; review crop coordinates: ' + filename)
        with Image.open(source) as original:
            original.load()
            if original.size != (1448,1086):
                raise ValueError('Native source size changed: ' + filename)
            coords = [(round(x*original.width/PREVIEW[0]), round(y*original.height/PREVIEW[1])) for x,y in polygon]
            xs,ys = zip(*coords)
            box=(max(0,min(xs)-2),max(0,min(ys)-2),min(original.width,max(xs)+3),min(original.height,max(ys)+3))
            crop=original.crop(box).convert('RGBA')
            alpha=Image.new('L',(crop.width*4,crop.height*4),0)
            ImageDraw.Draw(alpha).polygon([((x-box[0])*4,(y-box[1])*4) for x,y in coords],fill=255)
            crop.putalpha(alpha.resize(crop.size,Image.Resampling.LANCZOS))
            dest=out/(name+'.webp')
            crop.save(dest,'WEBP',quality=96,method=6,exact=True)
            with Image.open(dest) as check:
                check.load()
                if check.size != crop.size or check.mode != 'RGBA':
                    raise ValueError('Output lost native dimensions or alpha: '+name)
            entries.append({'path':dest.relative_to(ROOT).as_posix(),'source':source.relative_to(ROOT).as_posix(),
                'source_sha256':source_hash,'crop':box,'mask_polygon':coords,'native_size':list(crop.size),
                'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),
                'kind':'native-resolution 2D illustrated upper body; no new 3D or pose synthesis'})
    (out/'character-manifest.json').write_text(json.dumps({'version':'realistic-character-pass-1','assets':entries},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Approved character art: 4 native-resolution RGBA portraits verified.')

if __name__=='__main__': build()
