"""Offline-only browser transport. Not evidence of HTTP or public deployment.
Preserves production scripts, embeds local runtime bytes, maps dynamic image paths.
Approved full-size source boards and unused 3D models are not embedded.
"""
import base64,json,mimetypes,re
from pathlib import Path
mimetypes.add_type('image/webp', '.webp')
def inline_document(root:Path)->str:
 assets={p.relative_to(root).as_posix():'data:'+(mimetypes.guess_type(p.name)[0] or 'image/webp')+';base64,'+base64.b64encode(p.read_bytes()).decode() for p in (root/'assets').rglob('*') if p.is_file() and p.suffix in ('.png','.webp','.jpg') and 'art_direction' not in p.parts}
 html=(root/'index.html').read_text(encoding='utf-8')
 html=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*/?>',lambda m:'<style>'+(root/re.search(r'href="([^"]+)"',m[0])[1].split('?')[0]).read_text(encoding='utf-8')+'</style>',html)
 html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+(root/m[1].split('?')[0]).read_text(encoding='utf-8').replace('</script','<\\/script')+'</script>',html)
 pre='<script>window.__offlineAssets='+json.dumps(assets)+''';const originalImageSrc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');Object.defineProperty(HTMLImageElement.prototype,'src',{get:originalImageSrc.get,set(value){originalImageSrc.set.call(this,window.__offlineAssets[value]||value);}});</script>'''
 for path,url in assets.items():html=html.replace('src="'+path+'"','src="'+url+'"').replace("url('"+path+"')","url('"+url+"')")
 return html.replace('<head>','<head>'+pre)
