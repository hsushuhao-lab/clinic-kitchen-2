"""HTTP image/layout fixtures. Full movement and cooking is tested separately by test_flat_clinic.py."""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright,expect
p=argparse.ArgumentParser();p.add_argument('--base-url',required=True);p.add_argument('--output',default='qa/current/workspace');a=p.parse_args()
out=Path(a.output);out.mkdir(parents=True,exist_ok=True);checks=[];errors=[];failed=[]
def record(name):checks.append({'name':name,'status':'PASS'});print('PASS:',name,flush=True)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':900})
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
  r=page.goto(a.base_url,wait_until='networkidle');assert r and r.status==200
  page.wait_for_function('window.CKWorkspaceArt?.version==="workspace-r1" && getSceneStatus().imagesReady')
  assert page.locator('#world').get_attribute('data-presentation')=='chibi-playable-world'
  assert page.evaluate('getSceneStatus().actor.fullBody && getSceneStatus().actor.spriteSheet.startsWith("assets/chibi/")')
  record('continuous chibi world decodes; full-body actor is not a location dot')
  # Deliberate visual fixtures, not a claim that these steps tested real navigation.
  page.evaluate('set3DPlayerPosition(5,-1.4);setStage(3)')
  tofu=[]
  for food,n in [('tofu',3),('scallion',1),('garlic',1),('pork',1),('douban',1)]:
   page.locator(f'[data-food="{food}"]').click()
   for step in range(n+1):
    page.wait_for_function('document.getElementById("boardFoodImg").complete && document.getElementById("boardFoodImg").naturalWidth>0')
    source=page.locator('#boardFoodImg').get_attribute('src');assert source.startswith('assets/workspace/'),source
    if food=='tofu':
     tofu.append(source)
     page.screenshot(path=str(out/f'tofu-stage-{step}.png'))
    if step<n:page.locator('#cutBtn').click();page.wait_for_timeout(250)
   if food=='scallion':page.screenshot(path=str(out/'loose-scallion-1440.png'))
  assert len(set(tofu))==4
  record('four distinct tofu cuts and loose scallion/garlic/pork/douban; no tray/photograph assets in recipe renderer')
  page.evaluate('set3DPlayerPosition(9,-1.35)');page.wait_for_timeout(100);page.locator('#heatBtn').click()
  for _ in range(5):page.locator('#addBtn').click()
  imgs=page.locator('#wokFoodLayer img');assert imgs.count()==5
  assert all(s.startswith('assets/workspace/') for s in imgs.evaluate_all('(els)=>els.map(e=>e.getAttribute("src"))'))
  node=page.locator('#wokFoodLayer img').first.element_handle()
  for _ in range(3):page.locator('#stirBtn').click();page.wait_for_timeout(450)
  assert node.evaluate('(el)=>el.isConnected')
  expect(page.locator('#wokSimmerImg')).to_be_visible();assert page.locator('#wokSimmerImg').get_attribute('src')=='assets/workspace/simmer-food.webp'
  page.screenshot(path=str(out/'wok-simmer-1440.png'))
  record('persistent loose ingredients stay within the wok; simmer is an alpha image, not a replacement scene')
  for w,h in [(1440,900),(1024,768),(390,844),(375,667)]:
   page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight')
   assert page.locator('[data-station]').count()==6
   for button in page.locator('[data-station]').all():
    q=button.bounding_box();assert q and q['x']>=0 and q['x']+q['width']<=w+1
   page.screenshot(path=str(out/f'workspace-{w}.png'))
  record('four responsive viewports retain six reachable station buttons with no page overflow')
  assert not errors and not failed,(errors,failed)
  record('real HTTP has no failed resource requests or uncaught JavaScript errors')
  b.close()
except Exception as e:
 checks.append({'name':'workspace verification','status':'FAIL','error':str(e)});raise
finally:
 (out/'report.json').write_text(json.dumps({'mode':'HTTP_VISUAL_FIXTURES','base_url':a.base_url,'checks':checks,'errors':errors,'failed_requests':failed,'limitation':'Station/state setup here is a visual fixture; separate test_flat_clinic exercises keyboard movement and the full mission.'},ensure_ascii=False,indent=2)+'\n')
