"""Verify full image decoding, exact SHA-256, dimensions and original-image count."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'assets/manifest.json').read_text(encoding='utf-8'))
originals = 0
for item in manifest['assets']:
    path = ROOT / item['path']
    assert path.is_file(), f'Missing asset: {item["path"]}'
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == item['sha256'], f'Checksum mismatch: {item["path"]}'
    assert len(data) == item['bytes'], f'Length mismatch: {item["path"]}'
    with Image.open(path) as image:
        image.load()
        assert list(image.size) == [item['width'], item['height']], f'Dimensions: {path.name}'
        if item['role'] == 'approved_reference':
            originals += 1
            assert image.width >= 1400 and image.height >= 1000, f'Not a full-resolution original: {path.name}'
assert originals == 7, f'Expected seven originals, got {originals}'
assert manifest['production_models'] == 0, 'Do not claim raster sheets are 3D models.'
assert not (ROOT / 'assets/reference/private').exists(), 'Private photographs must remain outside the source package.'
print(f'Asset integrity PASS: {len(manifest["assets"])} images; {originals} full-resolution originals; 0 production 3D models.')
