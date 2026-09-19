"""Offline transport for local visual review only. NOT an HTTP or deployment test.
Embeds the exact local JS/CSS/GLB bytes and replaces only asset URLs with data URLs.
"""
import base64
import mimetypes
from pathlib import Path
from html.parser import HTMLParser
import re

def inline_document(root: Path) -> str:
    html = (root / 'index.html').read_text(encoding='utf-8')
    resources = {}
    for p in (root / 'assets').rglob('*'):
        if p.is_file() and p.suffix in ('.png','.jpg','.webp','.glb'):
            media = 'model/gltf-binary' if p.suffix == '.glb' else mimetypes.guess_type(p.name)[0]
            resources[p.relative_to(root).as_posix()] = 'data:'+media+';base64,'+base64.b64encode(p.read_bytes()).decode()
    def css(m):
        return '<style>'+(root/re.search(r'href="([^"]+)"',m.group(0)).group(1).split('?')[0]).read_text(encoding='utf-8')+'</style>'
    html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*/?>',css,html)
    def script(m):
        source=(root/m.group(1).split('?')[0]).read_text(encoding='utf-8')
        if 'scene2d.js' in m.group(1):
            import json
            scene_images={name:resources['assets/'+path] for name,path in {'speed':'ui/doctor-speed.webp','heat':'ui/doctor-heat.webp','strategy':'ui/doctor-strategy.webp','patient':'ui/patient-office.webp','board':'ui/board-clean.webp','dish':'cooking/dish_plated.png'}.items()}
            source=source.replace("im.src='assets/'+path;",'im.src=('+json.dumps(scene_images)+')[id];')
        if 'clinic-shift.js' in m.group(1):
            import json
            portraits = {i:resources['assets/ui/doctor-'+i+'.webp'] for i in ('speed','heat','strategy')}
            source=source.replace('`assets/ui/doctor-${round.doctorId}.webp`','('+json.dumps(portraits)+')[round.doctorId]')
        return '<script>'+source.replace('</script','<\\/script')+'</script>'
    html=re.sub(r'<script src="([^"]+)"></script>',script,html)
    for path,url in sorted(resources.items(),key=lambda pair:-len(pair[0])):
        html=html.replace(path,url)
    return html
