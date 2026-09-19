"""Flat-clinic viewport and first-version rules regression.
--inline is offline browser review with transport substitution, NOT HTTP/live QA.
Use --base-url on the runtime-only HTTP directory for CI/release acceptance.
All mission changes below are produced by real keyboard/clicks, never teleport.
"""
import argparse,json,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from inline_shift_preview import inline_document

ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--inline',action='store_true');p.add_argument('--base-url');p.add_argument('--output',default='qa/shift');p.add_argument('--browser');args=p.parse_args()
assert args.inline or args.base_url, 'Specify --base-url for release testing or --inline for offline review.'
OUT=Path(args.output);OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def record(label):
 checks.append({'name':label,'status':'PASS'});print('PASS:',label,flush=True)

def main():
 with sync_playwright() as pw:
  opts={'headless':True,'args':['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
  if args.browser:opts['executable_path']=args.browser
  browser=pw.chromium.launch(**opts)
  page=browser.new_page(viewport={'width':1440,'height':900});page.set_default_timeout(15000)
  page.on('pageerror',lambda e: errors.append(str(e)))
  if args.inline:page.set_content(inline_document(ROOT),wait_until='load')
  else:
   response=page.goto(args.base_url,wait_until='networkidle');assert response and response.status==200
  page.wait_for_function('window.CKShift && window.getSceneStatus?.().renderer === "canvas2d" && window.getSceneStatus().imagesReady')
  assert page.locator('#scene2dCanvas').count()==1 and page.locator('#scene3dCanvas').count()==0
  assert page.locator('.work-tabs,.cook-head,[data-worktab]').count()==0
  record('Canvas2D active; no WebGL canvas, duplicate workspace title or tab strip')
  for w,h in [(1920,1080),(1440,900),(1366,768),(1024,768),(768,1024),(390,844),(375,667)]:
   page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(80)
   dims=page.evaluate('''() => { const a=document.querySelector('#world').getBoundingClientRect();const b=document.querySelector('#cookingDeck').getBoundingClientRect();return {ratio:(a.height+document.querySelector('.hud').getBoundingClientRect().height)/b.height,bottom:b.bottom,h:innerHeight,sh:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,w:innerWidth}; }''')
   assert abs(dims['ratio']-.5)<.015,dims
   assert dims['sh']<=h+1 and dims['sw']<=w+1 and dims['bottom']<=h+1,dims
   for tab in (('prep','wok','serve') if w>=700 else ('prep',)):
    panel=page.locator('#panel-'+tab);assert panel.is_visible()
    box=panel.bounding_box();assert box and box['y']+box['height']<=h
    controls={'prep':['#cutBtn','[data-food="tofu"]'],'wok':['#heatBtn','#addBtn','#stirBtn','#plateBtn'],'serve':['#riceHalfBtn','#riceFullBtn']}[tab]
    for selector in controls:
     cb=page.locator(selector).bounding_box();assert cb and cb['y']>=box['y'] and cb['y']+cb['height']<=h-8,(w,h,selector,cb)
   record(f'{w}x{h}: 1:2 viewport ratio, no page scrolling, all station controls reachable')
   if w in (1440,390,375):page.screenshot(path=str(OUT/f'layout-{w}.png'))
  page.set_viewport_size({'width':1440,'height':900})
  for role in ('heat','speed','strategy'):
   page.locator('#doctorPickerBtn').click();expect(page.locator('#doctorDialog')).to_be_visible()
   if role=='strategy':page.screenshot(path=str(OUT/'doctor-selection.png'))
   page.locator(f'[data-doctor="{role}"]').click();assert page.evaluate('CKShift.snapshot().doctorId')==role and page.evaluate('getSceneStatus().doctorId')==role
  record('all three doctor choices update their real rule profile before accepting an order')
  page.locator('#pauseBtn').click();expect(page.locator('#sessionOverlay')).to_be_visible();page.keyboard.press('r')
  assert page.evaluate('CKShift.snapshot().status')=='ready' and not page.evaluate('CKShift.snapshot().paused')
  record('R restarts cleanly even while the pause button has keyboard focus')
  world=page.locator('#world')
  snap=lambda:page.evaluate('CKShift.snapshot()')
  pos=lambda:page.evaluate('get3DStatus().playerPos')
  def walk(axis,target):
   start=pos()[axis]
   if abs(start-target)<.1:return
   inc=target>start;key=('d' if inc else 'a') if axis=='x' else ('s' if inc else 'w')
   world.focus();page.keyboard.down(key)
   try:page.wait_for_function('''([a,t,inc])=>{const x=get3DStatus().playerPos[a]; return inc?x>=t-.07:x<=t+.07;}''',arg=[axis,target,inc],timeout=25000)
   finally:page.keyboard.up(key)
   page.wait_for_timeout(75)
   assert abs(pos()[axis]-target)<.55
  def approach(x,z):walk('z',0);walk('x',x);walk('z',z)
  def interact(stage):
   world.focus();page.keyboard.press('e');expect(page.locator('#dialogModal')).to_be_visible();page.locator('#dialogActionBtn').click()
   page.wait_for_function('(n)=>getMissionStage()===n',arg=stage)
  old=pos();walk('z',old['z']-.3);deeper=pos();assert deeper['z']<old['z']-.1
  walk('z',old['z']+.08);assert pos()['z']>deeper['z']+.1
  page.keyboard.press('r');assert snap()['craving']==40;record('W goes up/deeper, S goes down/toward camera, R resets the round')
  before=pos();page.locator('[data-station="prep"]').click();page.wait_for_timeout(40)
  after=pos();assert abs(after['x']-before['x'])<1 and after['x']<4
  page.wait_for_function('getSceneStatus().routeLength===0',timeout=15000)
  assert abs(pos()['x']-5)<.15 and abs(pos()['z']+1.4)<.15
  world.focus();page.keyboard.press('r');record('Map click walks through the aisle without teleporting')
  approach(-7.3,-.65);world.focus();page.keyboard.press('e');expect(page.locator('#dialogModal')).to_be_visible()
  page.locator('[data-pref="scallion"] [data-val="no"]').click();page.keyboard.press('Escape')
  assert page.evaluate('getMissionStage()')==0 and page.evaluate('currentOrder.scallion') is True
  record('Escape cancels unconfirmed preferences without starting craving')
  interact(1);approach(-9.2,-1.0);interact(2)
  assert snap()['status']=='active';expect(page.locator('#doctorPickerBtn')).to_be_disabled()
  before=snap();page.wait_for_timeout(1200);assert snap()['craving']>before['craving'] and snap()['focus']<before['focus']
  page.locator('#pauseBtn').click();frozen=snap();at=pos();page.wait_for_timeout(600);world.focus();page.keyboard.press('d');assert pos()==at and snap()['craving']==frozen['craving']
  page.locator('#sessionContinueBtn').click();record('accepting the order starts craving; doctor locks; pause freezes timers and movement')
  approach(.2,-1.4);interact(3);approach(5,-1.4)
  for food in ('tofu','pork','douban','garlic','scallion'):
   page.locator(f'[data-food="{food}"]').click()
   n=3 if food=='tofu' else 1
   prev=snap()['focus']
   for _ in range(n):page.locator('#cutBtn').click();page.wait_for_timeout(240)
   assert snap()['focus']>prev+2,(food,snap(),prev)
  record('completed preparations award the selected doctor bonus once per ingredient')
  page.screenshot(path=str(OUT/'prep-with-craving.png'))
  approach(9,-1.35);page.locator('#heatBtn').click()
  for _ in range(5):page.locator('#addBtn').click()
  assert page.evaluate('cookedDish.hasTofu && cookedDish.hasPork && cookedDish.hasScallion')
  for _ in range(3):page.locator('#stirBtn').click();page.wait_for_timeout(150)
  expect(page.locator('#plateBtn')).to_be_disabled();page.wait_for_timeout(500)
  page.locator('#pauseBtn').click();simmer=page.evaluate('cookedDish.simmerProgress');before=snap();page.wait_for_timeout(700)
  assert page.evaluate('cookedDish.simmerProgress')==simmer and snap()['craving']==before['craving'];page.locator('#sessionContinueBtn').click()
  record('new timer preserves discrete addition and timed simmer; pause freezes both')
  approach(11.5,-1.35);page.locator('#riceFullBtn').click();approach(9,-1.35)
  expect(page.locator('#plateBtn')).to_be_enabled();page.locator('#plateBtn').click()
  assert page.evaluate('isPlating && !plated && !get3DStatus().carryingTray')
  page.wait_for_function('plated && get3DStatus().carryingTray')
  record('rice preparation and transactional plating remain functional')
  page.screenshot(path=str(OUT/'cooked-with-craving.png'))
  approach(-7.3,-.65);world.focus();page.keyboard.press('e');expect(page.locator('#dialogModal')).to_be_visible()
  assert snap()['status']=='won' and snap()['served']==1 and snap()['points']>0
  page.wait_for_timeout(100);page.screenshot(path=str(OUT/'first-bite-score.png'))
  earned=snap()['points'];c=snap()['craving'];page.wait_for_timeout(400);assert snap()['craving']==c
  page.keyboard.press('Escape');assert page.evaluate('getMissionStage()')==7
  page.keyboard.press('e');assert snap()['served']==1 and snap()['points']==earned
  record('real walk back and serving score once; feedback dismissal cannot duplicate delivery')
  page.locator('#sessionContinueBtn').click();assert snap()['status']=='ready' and snap()['points']==earned and snap()['streak']==1 and snap()['craving']==40
  expect(page.locator('#wokContents')).to_have_text('空鍋');expect(page.locator('#doctorPickerBtn')).to_be_enabled()
  record('next order resets transient state while preserving doctor, earned score and streak')
  page.set_viewport_size({'width':390,'height':844})
  for station,panel in [('prep','prep'),('wok','wok'),('rice','serve')]:
   page.locator(f'[data-station="{station}"]').click()
   page.wait_for_function('getSceneStatus().routeLength===0',timeout=15000)
   expect(page.locator('#panel-'+panel)).to_be_visible()
   box=page.locator('#panel-'+panel).bounding_box();assert box['y']+box['height']<=844
  record('Mobile map movement reveals the matching work panel without duplicate tabs')
  assert page.evaluate("Array.from(document.images).filter(x=>x.getAttribute('src') && !x.hidden).every(x=>x.complete && x.naturalWidth>0)")
  assert not errors,errors;record('all visible image assets decode; no uncaught JavaScript errors')
  browser.close()
try:main()
except Exception as e:
 checks.append({'name':'browser walkthrough','status':'FAIL','error':str(e)});raise
finally:
 (OUT/'report.json').write_text(json.dumps({'mode':'INLINE_OFFLINE_BROWSER' if args.inline else 'HTTP_BROWSER','base_url':args.base_url,'checks':checks,'errors':errors,'limitations':['Not a live deployment check when --inline is used.','Fixed 2D map and approved-art portraits; not new high-resolution production art.']},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
