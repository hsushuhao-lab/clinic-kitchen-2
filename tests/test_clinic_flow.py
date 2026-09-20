"""R4 acceptance: real keys/buttons through clinic, prep, cook and terminal results.
--inline is an offline transport only. CI/public runs use real HTTP and no state mutation.
"""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from inline_shift_preview import inline_document
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--base-url');p.add_argument('--inline',action='store_true');p.add_argument('--browser');p.add_argument('--output',default='qa/current/clinic');a=p.parse_args()
assert a.inline or a.base_url
out=Path(a.output);out.mkdir(parents=True,exist_ok=True);checks=[];errors=[];failed=[]
def done(name):checks.append({'name':name,'status':'PASS'});print('PASS:',name,flush=True)
try:
 with sync_playwright() as pw:
  opts={'headless':True,'args':['--no-sandbox']}
  if a.browser:opts['executable_path']=a.browser
  browser=pw.chromium.launch(**opts);page=browser.new_page(viewport={'width':1366,'height':768});page.set_default_timeout(16000)
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
  if a.inline:page.set_content(inline_document(ROOT),wait_until='load')
  else:
   response=page.goto(a.base_url,wait_until='networkidle');assert response and response.status==200
  page.wait_for_function('window.CKClinic && getSceneStatus().imagesReady')
  def snapshot():return page.evaluate('CKClinic.snapshot()')
  def scene():return page.evaluate('getSceneStatus()')
  def cook():return page.evaluate('getCookingStatus()')
  def go(id):
   page.locator(f'[data-station="{id}"]').click()
   page.wait_for_function('getSceneStatus().routeLength===0')
   assert scene()['interactiveTarget']['id']==id
  def confirm_station(id):
   go(id);page.locator('#world').focus();page.keyboard.press('e');expect(page.locator('#dialogModal')).to_be_visible();page.locator('#dialogActionBtn').click()
  def bounds(selector,w,h):
   data=page.locator(selector).evaluate('''e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,sw:e.scrollWidth,cw:e.clientWidth,sh:e.scrollHeight,ch:e.clientHeight};}''')
   assert data['x']>=-1 and data['y']>=-1 and data['x']+data['w']<=w+1 and data['y']+data['h']<=h+1,(selector,data,w,h)
   assert data['sw']<=data['cw']+1 and data['sh']<=data['ch']+1,(selector,'internal overflow',data)
  def layout(label):
   for w,h in [(1366,768),(1440,900),(768,1024),(390,844),(375,667)]:
    page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight')
    bounds('#cookingDeck',w,h)
    if page.locator('#clinicResult').is_visible():bounds('#clinicResult',w,h);bounds('#clinicNextBtn',w,h)
    else:
     visible=[id for id in ['prep','wok','serve'] if page.locator('#panel-'+id).is_visible()]
     assert len(visible)==(1 if cook()['stage']>=3 else 0),visible
     if visible:bounds('#panel-'+visible[0],w,h)
     assert page.locator('#precisionTrack').bounding_box()['height']>=25
    if w in (1366,375):page.screenshot(path=str(out/f'{label}-{w}.png'))
   page.set_viewport_size({'width':1366,'height':768})
  s=scene();assert [x['id'] for x in s['stations']]==['patient','desk','fridge','prep','wok','rice']
  assert all(s['stations'][i]['x']<s['stations'][i+1]['x'] for i in range(5))
  assert all(f['z']<0 for f in s['furniture']);assert not any(f['img'] in ['bed','table','cabinet'] for f in s['furniture'])
  done('six left-to-right stations; no foreground bed, carts, table or extra cabinets')
  assert snapshot()['number']==1;expect(page.locator('#clinicPreferences')).to_contain_text('不要蔥')
  layout('initial');done('fixed queue, large precision bar and no page overflow at five viewports')
  # Each selectable full-body doctor keeps walking/running and stops when keys release.
  for id in ['speed','heat','strategy']:
   page.locator('#doctorPickerBtn').click();page.locator(f'#doctorDialog [data-doctor="{id}"]').click()
   page.locator('#world').focus();x=scene()['playerPos']['x'];page.keyboard.down('d');page.wait_for_timeout(170)
   moving=scene();assert moving['playerPos']['x']>x and moving['actor']['animation']=='walk' and moving['actor']['fullBody']
   f=moving['actor']['frame'];page.wait_for_timeout(170);assert scene()['actor']['frame']!=f
   page.keyboard.up('d');page.wait_for_timeout(50);assert scene()['actor']['animation']=='idle'
   page.keyboard.down('Shift');page.keyboard.down('a');page.wait_for_timeout(220);assert scene()['actor']['animation']=='run';page.keyboard.up('a');page.keyboard.up('Shift')
  done('three selectable Q doctors retain animated walk/run/idle, not torso navigation')
  # Read a patient's request; cancel leaves stage zero and immutable order intact.
  before=snapshot()['order'];go('patient');page.locator('#world').focus();page.keyboard.press('e');expect(page.locator('#dialogModal')).to_be_visible()
  assert page.locator('#prefGrid').count()==0
  page.keyboard.press('Escape');assert cook()['stage']==0 and snapshot()['order']==before
  done('patient specifies the order; closing consultation cannot replace it')
  def play_one(tag,wrong_rice=False,check_layout=False):
   order=snapshot()['order'];confirm_station('patient');confirm_station('desk');confirm_station('fridge')
   assert page.evaluate('CKShift.snapshot().status')=='active'
   # Away-from-station buttons remain blocked even when a tab is opened.
   page.locator('[data-clinic-panel="prep"]').click();page.locator('button[data-food="tofu"]').click();expect(page.locator('#cutBtn')).to_be_disabled()
   go('prep')
   foods=[('tofu',3),('pork',1),('douban',1),('garlic',1)]
   if order['scallion']:foods.append(('scallion',1))
   if order['spicy']=='重辣':foods.append(('pepper',1))
   for id,n in foods:
    page.locator(f'button[data-food="{id}"]').click()
    for _ in range(n):page.locator('#cutBtn').click();page.wait_for_timeout(240)
   if check_layout:layout('prep')
   go('wok');page.locator('#heatBtn').click()
   for _ in foods:page.locator('#addBtn').click()
   for _ in range(3):page.locator('#stirBtn').click();page.wait_for_timeout(280)
   page.wait_for_function('window.cookedDish.isSimmered')
   # Take the heat off, then advance right. Never walk back for plating/settlement.
   page.locator('#heatBtn').click();assert not cook()['heated']
   if check_layout:layout('wok')
   go('rice');assert snapshot()['panel']=='serve'
   rice=order['rice']
   if wrong_rice:rice='正常飯' if rice=='半碗飯' else '半碗飯'
   page.locator('#riceHalfBtn' if rice=='半碗飯' else '#riceFullBtn').click()
   if check_layout:layout('serve')
   before_pos=scene()['playerPos'];page.locator('#clinicPlateBtn').click();expect(page.locator('#clinicResult')).to_be_visible()
   assert cook()['stage']==7 and snapshot()['result']['quality']==(95 if wrong_rice else 100)
   assert page.evaluate('CKShift.snapshot().status')=='won' and not cook()['heated']
   points=page.evaluate('CKShift.snapshot().points');time=page.evaluate('CKShift.snapshot().elapsed')
   page.keyboard.down('d');page.wait_for_timeout(220);page.keyboard.up('d');page.keyboard.press('Escape');page.wait_for_timeout(100)
   assert scene()['playerPos']==before_pos and page.evaluate('CKShift.snapshot().elapsed')==time
   assert page.evaluate('CKShift.snapshot().points')==points and snapshot()['resultOpen']
   page.screenshot(path=str(out/f'{tag}-result.png'))
   if check_layout:layout('result')
   done(tag+': real consultation/prep/cook/rice sequence; immediate stationary result; correct quality; no double score')
  play_one('practice-1',wrong_rice=True,check_layout=True)
  old=snapshot();page.locator('#clinicNextBtn').click();assert snapshot()['number']==2 and snapshot()['patient']['id']!=old['patient']['id']
  assert snapshot()['order']!=old['order'] and not snapshot()['resultOpen'] and cook()['stage']==0
  done('one click calls the next numbered patient with new fixed preferences and cleared cooking state')
  # Sound and pause are still owned by R3, not a duplicate scheduler.
  sound=page.evaluate('CKAudio.snapshot()')
  if not sound['enabled'] or not sound['unlocked']:page.locator('#musicToggle').click()
  page.wait_for_function('CKAudio.snapshot().rms>0.00001')
  assert page.evaluate('CKAudio.snapshot().contexts')==1
  page.keyboard.press('m');page.wait_for_timeout(150);assert not page.evaluate('CKAudio.snapshot().enabled')
  page.keyboard.press('m');page.wait_for_function('CKAudio.snapshot().rms>0.00001')
  page.locator('#pauseBtn').click();page.wait_for_timeout(200)
  assert page.evaluate('CKAudio.snapshot().schedulerCount')==0
  page.locator('#sessionContinueBtn').click()
  done('original adaptive soundtrack produces real audio; M mute/unmute and pause stop the single scheduler')
  page.locator('#rushMode').click();assert page.evaluate('CKRush.snapshot().mode')=='rush'
  for i in range(3):
   play_one(f'night-{i+1}')
   r=page.evaluate('CKRush.snapshot()');assert r['ticketIndex']==i and len(r['results'])==i+1
   if i<2:page.locator('#clinicNextBtn').click()
  assert page.evaluate('CKRush.snapshot().complete')
  expect(page.locator('#clinicNextBtn')).to_contain_text('再開一班')
  page.locator('#clinicNextBtn').click();assert page.evaluate('CKRush.snapshot().ticketIndex')==0 and cook()['stage']==0
  done('all three night-shift tickets completed with music retained; fresh shift resets challenge progress')
  # Mobile actual controls and result surfaces remain reachable.
  page.set_viewport_size({'width':375,'height':667});pos=scene()['playerPos']['x']
  btn=page.locator('[data-move="east"]');box=btn.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.wait_for_timeout(250);page.mouse.up()
  assert scene()['playerPos']['x']>pos
  stopped=scene()['playerPos'];page.wait_for_timeout(200);assert scene()['playerPos']==stopped
  page.locator('#pauseBtn').click();paused=scene()['playerPos'];page.keyboard.press('d');page.wait_for_timeout(200);assert scene()['playerPos']==paused
  page.locator('#sessionContinueBtn').click();done('mobile hold-to-move/release and pause preserve working control')
  assert not errors and not failed,(errors,failed)
  done('no uncaught JS errors or failed runtime requests')
  browser.close()
except Exception as e:
 checks.append({'name':'R4 acceptance','status':'FAIL','error':str(e)});raise
finally:
 (out/'report.json').write_text(json.dumps({'mode':'INLINE_OFFLINE' if a.inline else 'HTTP_REAL_INPUT','base_url':a.base_url,'checks':checks,'errors':errors,'failed_requests':failed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
