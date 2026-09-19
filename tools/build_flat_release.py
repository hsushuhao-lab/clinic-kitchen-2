"""Strict runtime-only build. Original boards stay in Git, not Pages."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
import hashlib,json,re,shutil,subprocess
from build_character_portraits import build as build_characters
from verify_character_assets import main as verify_characters
from build_workspace_art import build as build_workspace
from verify_workspace_art import main as verify_workspace
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'web-dist'
CORE=('index.html','styles.css','r2-fixes.css','clinic-shift.css','character-art.css','workspace-art.css','src/main.js','src/scene2d.js','src/shift-rules.js','src/clinic-shift.js','src/character-art.js','src/workspace-art.js')
class References(HTMLParser):
 def __init__(self):super().__init__();self.paths=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag in ('script','img','source') and a.get('src'):self.paths.append(a['src'])
  if tag=='link' and a.get('href'):self.paths.append(a['href'])
def main():
 build_characters();verify_characters()
 build_workspace();verify_workspace()
 for script in ('src/character-art.js','src/workspace-art.js'):
  subprocess.run(['node','--check',script],cwd=ROOT,check=True)
 audit=ROOT/'qa/current/characters';audit.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(ROOT/'assets/ui/character-manifest.json',audit/'asset-provenance.json')
 workspace_audit=ROOT/'qa/current/workspace';workspace_audit.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(ROOT/'assets/workspace/manifest.json',workspace_audit/'asset-provenance.json')
 files=list(CORE)
 for directory in ('assets/cooking','assets/ingredients/mapo_tofu','assets/ui'):
  files.extend(p.relative_to(ROOT).as_posix() for p in (ROOT/directory).iterdir() if p.is_file() and p.suffix in ('.png','.webp'))
 # Only generated manifest entries; no unrelated or stale workspace files.
 files.extend(e['path'] for e in json.loads((ROOT/'assets/workspace/manifest.json').read_text())['assets'])
 assert len(files)==len(set(files))
 if OUT.is_symlink():raise ValueError('Output must not be a symlink')
 if OUT.exists():shutil.rmtree(OUT)
 for rel in files:
  src=ROOT/rel
  if not src.is_file() or src.is_symlink():raise ValueError('Missing/nonregular runtime asset: '+rel)
  dest=OUT/rel;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dest)
 def check(owner,ref):
  u=urlsplit(ref.strip().strip('\"\''))
  if u.scheme=='data' or not u.path:return
  if u.scheme or u.netloc or u.path.startswith('/'):raise ValueError('Unexpected external resource: '+ref)
  target=((OUT/owner).parent/unquote(u.path)).resolve()
  if not target.is_relative_to(OUT.resolve()) or not target.is_file():raise ValueError('Unpackaged dependency: '+ref)
 refs=References();refs.feed((OUT/'index.html').read_text(encoding='utf-8'))
 for ref in refs.paths:check('index.html',ref)
 for rel in ('styles.css','r2-fixes.css','clinic-shift.css','character-art.css','workspace-art.css'):
  for ref in re.findall(r'url\(([^)]+)\)',(OUT/rel).read_text(encoding='utf-8')):check(rel,ref)
 manifest={'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'renderer':'canvas2d','release_status':'BUILD_VERIFIED_PENDING_DEPLOYMENT','art_status':'WORKSPACE_R1_ILLUSTRATED_VIEWS_LOOSE_FOOD_NOT_FULL_BODY_ANIMATION','files':[]}
 for rel in sorted(files):
  raw=(OUT/rel).read_bytes();manifest['files'].append({'path':rel,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
 (OUT/'build-info.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 assert {p.relative_to(OUT).as_posix() for p in OUT.rglob('*') if p.is_file()}==set(files)|{'build-info.json'}
 print('Runtime allowlist PASS:',len(files),'files; no private photos, full art boards, tests or legacy GLB/Three.js included')
if __name__=='__main__':main()
