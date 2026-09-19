"""Check four 2D portraits and four native-resolution tool cutouts, not model art."""
from pathlib import Path
import hashlib,json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'assets/ui/manifest.json').read_text(encoding='utf-8'))
expected={'doctor-speed','doctor-heat','doctor-strategy','patient-office','wok-clean','knife-clean','board-clean','spatula-clean'}
assert {Path(x['path']).stem for x in manifest['assets']}==expected
for entry in manifest['assets']:
    p=ROOT/entry['path'];raw=p.read_bytes()
    assert len(raw)==entry['bytes'],entry['path']
    assert hashlib.sha256(raw).hexdigest()==entry['sha256'],entry['path']
    source=ROOT/entry['source']
    assert hashlib.sha256(source.read_bytes()).hexdigest()==entry['source_sha256']
    with Image.open(p) as im:
        im.load();assert im.format=='WEBP'
        if 'mask_polygon' in entry:
            assert list(im.size)==entry['native_size'] and im.mode=='RGBA'
            assert im.getchannel('A').getextrema()==(0,255)
        else:assert im.size==(256,256)
print('Flat art integrity: 8/8 PASS; source hashes, dimensions, masks and decoded bytes verified')
