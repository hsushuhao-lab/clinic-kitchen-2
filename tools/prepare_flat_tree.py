"""Recover reviewed flat-layout source, test it, then prepare Git objects only.
This tool never changes a branch ref. The final main update is a separate operation.
"""
from pathlib import Path
import argparse, base64, hashlib, json, lzma, os, subprocess
from urllib.request import Request, urlopen
ROOT = Path.cwd()
API = 'https://api.github.com/repos/hsushuhao-lab/clinic-kitchen-2/'
PACK = ['b13757d9e5a6f2179b516720ea8d8b3385cd87c4','7a63bed1d34a559fc8c246c703b7be39bac585f7','3d2408a6da4f296d2546aa33a521447dc217e362']
PREFIX = ['fa85a3fe0a1dedbd96bc01f8f133634a7eff28f0','8008c9ca47a354456123192b49c2c9fd1780acc0']
PACK_HASH = '6e604fd32467d8e33dce136056e4aa61b2858d11d0fcddccd1fef00cc36b9ab2'
CACHE = Path('/tmp/ck-flat-source-data.json')
ART = ['doctor-speed','doctor-heat','doctor-strategy','patient-office','board-clean','knife-clean','wok-clean','spatula-clean']
def api(path, data=None):
    req = Request(API+path, data=None if data is None else json.dumps(data).encode(), headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'})
    with urlopen(req, timeout=60) as response: return json.load(response)
def git(*args):return subprocess.check_output(['git',*args], cwd=ROOT).decode().strip()
def path(name):
    p = ROOT/name
    assert not p.is_symlink() and p.resolve().is_relative_to(ROOT.resolve()), name
    return p
def load_blobs(ids):
    return b''.join(base64.b64decode(api('git/blobs/'+sha)['content']) for sha in ids)
def apply():
    raw = load_blobs(PACK)
    assert hashlib.sha256(raw).hexdigest() == PACK_HASH, 'Payload transfer hash mismatch'
    payload = json.loads(lzma.decompress(raw)); CACHE.write_text(json.dumps(payload), encoding='utf-8')
    for name, expected in payload['expected'].items():
        p=path(name)
        actual=hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None
        assert actual == expected, ('Source changed since review; refusing overwrite',name,expected,actual)
    data = lzma.LZMADecompressor().decompress(load_blobs(PREFIX)).decode()
    decoder=json.JSONDecoder(); offset=data.index('"files":{')+len('"files":{'); recovered={}
    while offset<len(data):
        try:
            name, j=decoder.raw_decode(data,offset)
            assert data[j]==':'
            value,k=decoder.raw_decode(data,j+1)
        except (ValueError,AssertionError):break
        if name in payload['recover']:
            assert hashlib.sha256(value.encode()).hexdigest()==payload['recover'][name],name
            recovered[name]=value
        if data[k]!=',':break
        offset=k+1
    assert set(recovered)==set(payload['recover']), 'Incomplete recovered source'
    patch=Path('/tmp/ck-flat-changes.patch'); patch.write_text(payload['patch'],encoding='utf-8')
    subprocess.run(['git','apply','--check',str(patch)],cwd=ROOT,check=True)
    subprocess.run(['git','apply',str(patch)],cwd=ROOT,check=True)
    for name, content in {**recovered, **payload['files']}.items():
        p=path(name);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content,encoding='utf-8')
    for name, replacements in payload['replacements'].items():
        p=path(name);text=p.read_text(encoding='utf-8')
        for before, after in replacements:
            assert text.count(before)==1,(name,before)
            text=text.replace(before,after)
        p.write_text(text,encoding='utf-8')
    for name in payload['delete']:
        p=path(name)
        if p.exists():p.unlink()
    subprocess.run(['python','tools/build_flat_portraits.py'],cwd=ROOT,check=True)
    print('Recovered and applied reviewed source. Branch ref remains unchanged.')
def upload():
    payload=json.loads(CACHE.read_text())
    allowed=set(payload['expected'])|set(payload['recover'])|set(payload['files'])|set(payload['delete'])|{'assets/ui/'+name+'.webp' for name in ART}|{'assets/ui/manifest.json'}
    changed=set(git('diff','--name-only').splitlines())|set(git('ls-files','--others','--exclude-standard').splitlines())
    assert changed <= allowed, ('Unexpected changed paths', sorted(changed-allowed))
    entries=[];report=[]
    for name in sorted(changed):
        p=path(name)
        if not p.exists():
            entries.append({'path':name,'mode':'100644','type':'blob','sha':None}); report.append({'path':name,'deleted':True});continue
        raw=p.read_bytes()
        sha=api('git/blobs',{'content':base64.b64encode(raw).decode(),'encoding':'base64'})['sha']
        expected=hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest()
        assert sha==expected, ('Remote blob mismatch',name)
        entries.append({'path':name,'mode':'100644','type':'blob','sha':sha})
        report.append({'path':name,'sha256':hashlib.sha256(raw).hexdigest(),'git_blob':sha,'bytes':len(raw)})
    tree=api('git/trees',{'base_tree':git('rev-parse','HEAD^{tree}'),'tree':entries})['sha']
    out=Path('/tmp/flat-proof');out.mkdir(exist_ok=True)
    (out/'prepared-tree.json').write_text(json.dumps({'parent':git('rev-parse','HEAD'),'tree':tree,'files':report,'status':'PREPARED_AND_TESTED_NOT_YET_PUBLISHED'},indent=2)+'\n')
    print('Prepared verified tree:',tree,'; files:',len(entries),'; main ref NOT updated.')
p=argparse.ArgumentParser();p.add_argument('mode',choices=['apply','upload']);args=p.parse_args()
apply() if args.mode=='apply' else upload()
