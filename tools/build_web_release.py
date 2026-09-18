"""Build a runtime-only static site; never publish the private repository root.

Usage: python tools/build_web_release.py
Output: web-dist/ (fixed output directory, deliberately excluded from Git).
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import hashlib
import json
import re
import shutil
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'web-dist'

CORE_FILES = (
    'index.html', 'styles.css', 'r2-fixes.css',
    'src/three.min.js', 'src/scene3d.js', 'src/main.js',
    'assets/models/environment/clinic_kitchen_scene.glb',
    'assets/models/characters/dr_speed_placeholder.glb',
    'assets/models/characters/patient_office_placeholder.glb',
)

CULINARY_ASSETS = tuple(sorted([
    p.relative_to(ROOT).as_posix()
    for p in (ROOT / 'assets/ingredients/mapo_tofu').glob('*.png')
] + [
    p.relative_to(ROOT).as_posix()
    for p in (ROOT / 'assets/cooking').glob('*.png')
]))

FILES = CORE_FILES + CULINARY_ASSETS


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'img', 'source') and attrs.get('src'):
            self.paths.append(attrs['src'])
        if tag == 'link' and attrs.get('href'):
            self.paths.append(attrs['href'])

def check_local_reference(owner, ref):
    uri = urlsplit(ref.strip().strip('\"\''))
    if uri.scheme == 'data' or not uri.path:
        return
    if uri.scheme or uri.netloc or uri.path.startswith('/'):
        raise ValueError(f'Unreviewed remote/root resource: {owner}: {ref}')
    target = (OUT / owner).parent / unquote(uri.path)
    resolved = target.resolve()
    if not resolved.is_relative_to(OUT.resolve()) or not resolved.is_file():
        raise ValueError(f'Unpackaged dependency: {owner}: {ref}')

def inspect_glb(path):
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', raw)
    if magic != b'glTF' or version != 2 or length != len(raw):
        raise ValueError(f'Invalid or truncated GLB: {path.name}')
    offset = 12
    document = None
    while offset < length:
        size, kind = struct.unpack_from('<II', raw, offset)
        offset += 8
        if offset + size > length:
            raise ValueError(f'Truncated GLB chunk: {path.name}')
        if kind == 0x4e4f534a:
            document = json.loads(raw[offset:offset + size].decode('utf-8').rstrip(' \0'))
        offset += size
    if offset != length or document is None:
        raise ValueError(f'Missing GLB JSON: {path.name}')
    for item in document.get('buffers', []) + document.get('images', []):
        if item.get('uri') and not item['uri'].startswith('data:'):
            raise ValueError(f'External GLB dependency requires review: {path.name}')
    return {key: len(document.get(key, [])) for key in ('meshes', 'materials', 'textures', 'skins', 'animations')}

def main():
    for rel in FILES:
        source = ROOT / rel
        if source.is_symlink() or not source.is_file():
            raise ValueError(f'Missing/non-regular release input: {rel}')
    if OUT.is_symlink():
        raise ValueError('Refusing symlink output directory')
    if OUT.exists():
        shutil.rmtree(OUT)
    for rel in FILES:
        target = OUT / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / rel, target)
    parser = References()
    parser.feed((OUT / 'index.html').read_text(encoding='utf-8'))
    for ref in parser.paths:
        check_local_reference('index.html', ref)
    for rel in ('styles.css', 'r2-fixes.css'):
        for ref in re.findall(r'url\(([^)]+)\)', (OUT / rel).read_text(encoding='utf-8')):
            check_local_reference(rel, ref)
    scene = (OUT / 'src/scene3d.js').read_text(encoding='utf-8')
    for ref in re.findall(r"loader\.load\(['\"]([^'\"]+)", scene):
        check_local_reference('index.html', ref)
    # The browser is served only from web-dist, never from ROOT.
    manifest = {
        'source_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'release_status': 'CANDIDATE_NOT_PUBLICLY_DEPLOYED',
        'art_status': '3D_PLACEHOLDER_PROTOTYPE',
        'files': [],
    }
    for rel in FILES:
        raw = (OUT / rel).read_bytes()
        item = {'path': rel, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
        if rel.endswith('.glb'):
            item['glb'] = inspect_glb(OUT / rel)
        manifest['files'].append(item)
    (OUT / 'build-info.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    actual = {p.relative_to(OUT).as_posix() for p in OUT.rglob('*') if p.is_file()}
    assert actual == set(FILES) | {'build-info.json'}
    print(f'Runtime allowlist PASS: {len(actual)} files; {sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())} bytes')
    print('No reference photos, concept boards, private history, QA source, or credentials included.')

if __name__ == '__main__':
    main()
