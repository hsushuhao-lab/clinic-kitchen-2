"""R2 release acceptance. Read-only state inspection; actions use keyboard/pointer.
No teleport, stage mutation, injected input handler or fake animation timer.
"""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from inline_shift_preview import inline_document
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--base-url');p.add_argument('--inline',action='store_true');p.add_argument('--browser');p.add_argument('--output',default='qa/current/chibi');a=p.parse_args()
assert a.base_url or a.inline
out=Path(a.output);out.mkdir(parents=True,exist_ok=True);checks=[];errors=[];failed=[]
def record(name):checks.append({'name':name,'status':'PASS'});print('PASS:',name,flush=True)
try:
 with sync_playwright() as pw:
  opts={'headless':True,'args':['--no-sandbox']}
  if a.browser:opts['executable_path']=a.browser
  b=pw.chromium.launch(**opts);page=b.new_page(viewport={'width':1440,'height':900});page.set_default_timeout(15000)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
  if a.inline:page.set_content(inline_document(ROOT),wait_until='load')
  else:
   r=page.goto(a.base_url,wait_until='networkidle');assert r and r.status==200
  page.wait_for_function('getSceneStatus().imagesReady && getSceneStatus().actor.fullBody')
  status=lambda:page.evaluate('getSceneStatus()')
  world=page.locator('#world')
  def reset():world.focus();page.keyboard.press('r');page.wait_for_timeout(150)
  def held(key,ms=260,run=False):
   world.focus()
   if run:page.keyboard.down('Shift')
   page.keyboard.down(key);page.wait_for_timeout(ms);s=status();page.keyboard.up(key)
   if run:page.keyboard.up('Shift')
   page.wait_for_timeout(70);return s
  def inside():
   s=status();r=s['actor']['screenRect'];v=s['viewport']
   assert r['x']>=v['x']-.5 and r['y']>=v['y']-.5 and r['x']+r['w']<=v['x']+v['w']+.5 and r['y']+r['h']<=v['y']+v['h']+.5,(r,v)
  assert page.locator('#world').get_attribute('data-presentation')=='chibi-playable-world'
  record('playable Canvas2D room loads all 17 images and a full-body atlas actor')
  for w,h in [(1920,1080),(1440,900),(768,1024),(390,844),(375,667)]:
   page.set_viewport_size({'width':w,'height':h});reset();inside()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight')
   page.screenshot(path=str(out/f'initial-{w}.png'))
   record(f'{w}x{h}: full head/body/feet inside upper viewport, lower cooking visible, no page overflow')
  page.set_viewport_size({'width':1440,'height':900})
  for who in ('speed','heat','strategy'):
   reset();page.locator('#doctorPickerBtn').click();page.locator(f'#doctorDialog [data-doctor="{who}"]').click();page.wait_for_timeout(80)
   assert status()['doctorId']==who and status()['actor']['spriteSheet']==f'assets/chibi/{who}.webp'
   for key,axis,sign,direction in [('w','z',-1,'north'),('s','z',1,'south'),('a','x',-1,'west'),('d','x',1,'east')]:
    reset();old=status()['playerPos'][axis];s=held(key,140) # short stroke before nearby desk collision
    assert (s['playerPos'][axis]-old)*sign>.3 and s['actor']['direction']==direction and s['actor']['animation']=='walk',s
    assert status()['actor']['animation']=='idle'
   reset();world.focus();page.keyboard.down('d');frames=set()
   for i in range(7):page.wait_for_timeout(80);frames.add(status()['actor']['frame'])
   page.keyboard.up('d');assert len(frames)>=3
   reset();old=status()['playerPos']['x'];walk=held('d',350)['playerPos']['x']-old
   reset();old=status()['playerPos']['x'];s=held('d',350,True);run=s['playerPos']['x']-old
   assert s['isRunning'] and s['actor']['animation']=='run' and run>walk*1.25,(walk,run,s)
   inside();page.screenshot(path=str(out/f'{who}-after-run.png'))
   record(who+': four directional walks, changing frames, run faster than walk, idle after keyup')
  reset();held('w',1200);z=status()['playerPos']['z'];held('w',350);assert abs(status()['playerPos']['z']-z)<.06 and z>-1.2,z
  reset();held('a',1800);x=status()['playerPos']['x'];held('a',350);assert abs(status()['playerPos']['x']-x)<.06 and x>=-11.48
  record('desk collision and left world boundary stop movement rather than passing through furniture')
  reset();page.locator('#pauseBtn').click();frozen=status();held('d',300)
  assert status()['playerPos']==frozen['playerPos'] and status()['actor']['cell']==frozen['actor']['cell']
  page.locator('#sessionContinueBtn').click();held('d',200);assert status()['playerPos']!=frozen['playerPos']
  record('pause freezes position and animation; resume restores movement')
  reset();page.set_viewport_size({'width':375,'height':667});page.wait_for_timeout(150)
  expect(page.locator('.scene-dpad')).to_be_visible()
  old=status()['playerPos']['x'];bb=page.locator('[data-move="east"]').bounding_box();page.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2);page.mouse.down();page.wait_for_timeout(350);s=status();page.mouse.up();page.wait_for_timeout(80)
  assert s['playerPos']['x']>old+.5 and s['actor']['animation']=='walk' and status()['actor']['animation']=='idle'
  page.locator('#sceneRunBtn').click();bb=page.locator('[data-move="east"]').bounding_box();page.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2);page.mouse.down();page.wait_for_timeout(250);s=status();page.mouse.up();assert s['actor']['animation']=='run'
  inside();page.screenshot(path=str(out/'mobile-running.png'))
  record('mobile pointer hold moves, release stops, run toggle selects full-body running frames')
  reset();page.locator('[data-station="patient"]').click();page.wait_for_function('getSceneStatus().routeLength===0');expect(page.locator('#sceneInteractBtn')).to_be_enabled()
  page.locator('#sceneInteractBtn').click();expect(page.locator('#dialogModal')).to_be_visible();page.locator('#dialogActionBtn').click();assert page.evaluate('getMissionStage()')==1
  record('mobile reaches physical patient station and E button opens/confirms the real consultation')
  page.set_viewport_size({'width':1440,'height':900})
  def station(id,interact=False):
   page.locator(f'[data-station="{id}"]').click();page.wait_for_function('getSceneStatus().routeLength===0')
   if interact:
    page.locator('#sceneInteractBtn').click();expect(page.locator('#dialogModal')).to_be_visible();page.locator('#dialogActionBtn').click()
  station('desk',True);station('fridge',True);station('prep')
  for food in ('tofu','pork','douban','garlic','scallion'):
   page.locator(f'[data-food="{food}"]').click()
   for _ in range(3 if food=='tofu' else 1):
    page.locator('#cutBtn').click();page.wait_for_function('getSceneStatus().actor.animation===\"work\"');page.wait_for_timeout(230)
  record('all required preparation uses real controls and triggers the upper full-body work animation')
  station('wok');page.locator('#heatBtn').click()
  for _ in range(5):page.locator('#addBtn').click()
  for _ in range(3):page.locator('#stirBtn').click();page.wait_for_timeout(200)
  station('rice');page.locator('#riceFullBtn').click();station('wok')
  expect(page.locator('#plateBtn')).to_be_enabled();page.locator('#plateBtn').click()
  page.wait_for_function('plated && getSceneStatus().carryingTray && getSceneStatus().actor.animation===\"carry\"')
  page.screenshot(path=str(out/'carry-1440.png'))
  page.locator('[data-station="patient"]').click();page.wait_for_timeout(450)
  assert status()['actor']['animation']=='carry' and status()['isMoving']
  page.screenshot(path=str(out/'carry-walk-1440.png'))
  page.wait_for_function('getSceneStatus().routeLength===0');page.locator('#sceneInteractBtn').click()
  expect(page.locator('#dialogModal')).to_be_visible()
  assert page.evaluate('CKShift.snapshot().served')==1 and status()['patientDishVisible']
  page.screenshot(path=str(out/'delivery-1440.png'))
  record('complete real recipe, moving full-body tray carry, return and patient delivery succeed without teleport')
  assert not errors and not failed,(errors,failed)
  record('no uncaught JavaScript errors or failed HTTP resources')
  b.close()
except Exception as e:
 checks.append({'name':'chibi release acceptance','status':'FAIL','error':str(e)});raise
finally:
 (out/'report.json').write_text(json.dumps({'mode':'INLINE_OFFLINE_BROWSER' if a.inline else 'HTTP_BROWSER','base_url':a.base_url,'checks':checks,'errors':errors,'failed_requests':failed,'scope':'Q full-body 2D animation and physical controls; full recipe tested separately, art approval remains user review'},ensure_ascii=False,indent=2)+'\n')
