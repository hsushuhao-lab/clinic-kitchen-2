"""Verify the deployed R11 runtime against the expected commit."""
import argparse,hashlib,json,time
from urllib.request import Request,urlopen
from urllib.parse import urljoin

p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--expect-sha',required=True);args=p.parse_args()
base=args.url.rstrip('/')+'/'

def fetch(path):
    with urlopen(Request(urljoin(base,path),headers={'Cache-Control':'no-cache','User-Agent':'Clinic-Kitchen-R11-release-check'}),timeout=30) as r:
        assert r.status==200,(path,r.status)
        return r.read()

for attempt in range(12):
    info=json.loads(fetch('build-info.json?verify='+str(time.time_ns())))
    if info['source_commit']==args.expect_sha:break
    if attempt==11:raise AssertionError(('Live source mismatch',info['source_commit'],args.expect_sha))
    time.sleep(10)

assert info['renderer']=='canvas-chibi-r11',info
assert info['gameplay_version']=='R11_INTERACTIVE_KITCHEN_M5',info
for entry in info['files']:
    raw=fetch(entry['path']+'?verify='+args.expect_sha)
    assert len(raw)==entry['bytes'] and hashlib.sha256(raw).hexdigest()==entry['sha256'],entry['path']
print('Public R11 HTTPS build verified:',args.expect_sha,len(info['files']),'runtime files')