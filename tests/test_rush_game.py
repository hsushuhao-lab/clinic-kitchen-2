"""R3 real-input three-ticket acceptance and actual audio-energy checks.
No gameplay teleportation or direct state mutation. Offline score rendering is an audio fixture.
--inline substitutes image transport only and is NOT public/HTTP evidence.
"""
import argparse, base64, json, wave
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from inline_shift_preview import inline_document
ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser();p.add_argument('--base-url');p.add_argument('--inline',action='store_true');p.add_argument('--browser');p.add_argument('--output',default='qa/current/rush');p.add_argument('--preview',action='store_true')
a=p.parse_args();assert a.inline or a.base_url
out=Path(a.output);out.mkdir(parents=True,exist_ok=True);checks=[];errors=[];failed=[]
def ok(name):checks.append({'name':name,'status':'PASS'});print('PASS:',name,flush=True)
try:
 with sync_playwright() as pw:
  opts={'headless':True,'args':['--no-sandbox']}
  if a.browser:opts['executable_path']=a.browser
  browser=pw.chromium.launch(**opts);page=browser.new_page(viewport={'width':1440,'height':900});page.set_default_timeout(20000)
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
  if a.inline:page.set_content(inline_document(ROOT),wait_until='load')
  else:
   r=page.goto(a.base_url,wait_until='networkidle');assert r and r.status==200
  page.wait_for_function('window.CKRush && getSceneStatus().imagesReady')
  assert page.evaluate('CKAudio.snapshot().contexts')==0
  page.locator('#rushMode').click();assert page.evaluate('CKRush.snapshot().mode')=='rush'
  page.wait_for_function('CKAudio.snapshot().rms > .0005')
  assert page.evaluate('CKAudio.snapshot().contexts')==1
  ok('no autoplay before gesture; first trusted input creates one audible score')
  page.keyboard.press('m');page.wait_for_function('CKAudio.snapshot().contextState==="suspended"')
  assert page.evaluate('CKAudio.snapshot().schedulerCount')==0
  page.keyboard.press('m');page.wait_for_function('CKAudio.snapshot().rms > .0005')
  page.locator('#rushStrip summary').click()
  page.locator('#musicVolume').fill('35');page.locator('#musicVolume').dispatch_event('input')
  assert abs(page.evaluate('CKAudio.snapshot().volume')-.35)<.001
  page.locator('#rushStrip summary').click()
  ok('M mute stops scheduler/audio; resume and volume use the same context')
  for w,h in [(1440,900),(1024,768),(390,844),(375,667)]:
   page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
   for selector in ('#rushMode','#musicToggle','#precisionTrack','#sceneInteractBtn','#cutBtn'):
    box=page.locator(selector).bounding_box();assert box and box['x']>=0 and box['x']+box['width']<=w+1 and box['y']+box['height']<=h+1,(w,selector,box)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight')
   page.screenshot(path=str(out/f'interface-{w}.png'))
  ok('four viewport sizes preserve visible controls, Q character and zero page overflow')
  page.set_viewport_size({'width':1440,'height':900})
  world=page.locator('#world')
  def go(station):
   page.locator(f'[data-station="{station}"]').click()
   page.wait_for_function('getSceneStatus().routeLength===0',timeout=15000)
   assert page.evaluate('getSceneStatus().interactiveTarget?.id')==station
  def interact(stage):
   world.focus();page.keyboard.press('e');expect(page.locator('#dialogModal')).to_be_visible()
   page.locator('#dialogActionBtn').click();page.wait_for_function('(s)=>getMissionStage()===s',arg=stage)
  def precise(button):
   page.wait_for_function('CKRush.snapshot().cursor>.43 && CKRush.snapshot().cursor<.49')
   page.locator(button).click();page.wait_for_timeout(240)
  totals=[]
  for ticket in range(3):
   assert page.evaluate('CKRush.snapshot().ticketIndex')==ticket
   go('patient');world.focus();page.keyboard.press('e')
   assert page.locator('#prefGrid button').evaluate_all('(els)=>els.length>0 && els.every(x=>x.disabled)')
   page.locator('#dialogActionBtn').click()
   pref=page.evaluate('currentOrder');assert pref['spicy']==('重辣' if ticket==1 else '正常') and pref['scallion']==(ticket!=0)
   go('desk');interact(2)
   expect(page.locator('#rushMode')).to_be_disabled()
   before=page.evaluate('CKRush.snapshot().elapsed');page.wait_for_timeout(250)
   assert page.evaluate('CKRush.snapshot().elapsed')>before
   go('fridge');interact(3);go('prep')
   foods=['tofu','pork','douban','garlic']+(['scallion'] if pref['scallion'] else [])+(['pepper'] if pref['spicy']=='重辣' else [])
   for food in foods:
    page.locator(f'[data-food="{food}"]').click()
    for _ in range(3 if food=='tofu' else 1):precise('#cutBtn')
   assert page.evaluate('CKRush.snapshot().perfect')>=1
   assert page.evaluate('CKRush.snapshot().bestCombo')>=3
   if ticket==0:
    page.locator('#pauseBtn').click();page.wait_for_function('CKAudio.snapshot().contextState==="suspended"')
    state=page.evaluate('[CKRush.snapshot().elapsed, CKShift.snapshot().craving, getSceneStatus().playerPos]');page.wait_for_timeout(450)
    assert page.evaluate('[CKRush.snapshot().elapsed, CKShift.snapshot().craving, getSceneStatus().playerPos]')==state
    page.locator('#sessionContinueBtn').click();page.wait_for_function('CKAudio.snapshot().rms>.0005')
    assert page.evaluate('CKAudio.snapshot().contexts')==1
    page.screenshot(path=str(out/'precision-combo.png'))
    ok('real knife actions award perfect/combo; pause freezes bonus, craving and audio together')
   go('wok');page.locator('#heatBtn').click()
   for _ in foods:page.locator('#addBtn').click()
   for _ in range(3):precise('#stirBtn')
   assert page.evaluate('CKAudio.snapshot().bpm')>=120
   page.wait_for_function('getMissionStage()===5')
   page.locator('#heatBtn').click()  # New safety choice: off-heat completed food can be plated.
   assert page.evaluate('getCookingStatus().heated') is False
   go('rice');page.locator('#riceHalfBtn' if pref['rice']=='半碗飯' else '#riceFullBtn').click()
   go('wok');expect(page.locator('#plateBtn')).to_be_enabled()
   if ticket==2:
    page.wait_for_function('CKRush.snapshot().remaining<14',timeout=90000)
    assert page.evaluate('CKShift.snapshot().status')=='active'
    page.wait_for_function('CKAudio.snapshot().bpm===144 && CKAudio.snapshot().rms>.0005')
    assert page.locator('#app').get_attribute('data-pressure')=='urgent'
    assert page.evaluate('cookedDish.isBurnt') is False
    page.screenshot(path=str(out/'final-ticket-urgent.png'))
    ok('last 15 seconds audibly reaches 144 BPM; extinguished food does not burn while preparing rice')
   page.locator('#plateBtn').click();page.wait_for_function('plated && getSceneStatus().carryingTray')
   assert page.evaluate('getSceneStatus().actor.animation')=='carry'
   go('patient');world.focus();page.keyboard.press('e');expect(page.locator('#dialogModal')).to_be_visible()
   assert page.evaluate('CKShift.snapshot().quality')==100
   r=page.evaluate('CKRush.snapshot()');assert len(r['results'])==ticket+1 and r['lastResult']['timeBonus']>0
   earned=page.evaluate('CKShift.snapshot().points');totals.append(r['lastResult']['points'])
   page.keyboard.press('Escape');world.focus();page.keyboard.press('e');assert page.evaluate('CKShift.snapshot().points')==earned
   if ticket<2:page.locator('#sessionContinueBtn').click()
   ok(f'ticket {ticket+1}: specified ingredients/rice, real walk, off-heat plating and exactly-once delivery score')
  assert page.evaluate('CKRush.snapshot().complete')
  assert page.evaluate('CKRush.snapshot().sessionPoints')==sum(totals)
  assert page.evaluate('CKRush.snapshot().best')>=sum(totals)
  page.screenshot(path=str(out/'three-ticket-result.png'))
  if not a.inline:
   assert page.evaluate('Number(localStorage.getItem("ck-rush-best-v1"))')==page.evaluate('CKRush.snapshot().best')
  page.locator('#sessionContinueBtn').click();assert page.evaluate('CKRush.snapshot().ticketIndex')==0
  assert page.evaluate('CKRush.snapshot().technique')==0 and not page.evaluate('getSceneStatus().carryingTray')
  assert page.evaluate('CKAudio.snapshot().contexts')==1 and page.evaluate('CKAudio.snapshot().schedulerCount')==1
  ok('three-ticket result/record is persisted where storage exists; restart clears combos/tray, no duplicate audio')
  if a.preview:
   audio=page.evaluate('''async()=>{const b=await CKAudio.preview(24),v=b.getChannelData(0),pcm=new Int16Array(v.length);let peak=0,sum=0;for(let i=0;i<v.length;i++){peak=Math.max(peak,Math.abs(v[i]));sum+=v[i]*v[i];pcm[i]=Math.max(-1,Math.min(1,v[i]))*32767;}const bytes=new Uint8Array(pcm.buffer);let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return{pcm:btoa(str),peak,rms:Math.sqrt(sum/v.length),frames:v.length};}''')
   assert audio['peak']<.99 and audio['rms']>.003,audio['peak']
   with wave.open(str(out/'CK_Night_Shift_Original_Preview.wav'),'wb') as f:
    f.setnchannels(1);f.setsampwidth(2);f.setframerate(44100);f.writeframes(base64.b64decode(audio.pop('pcm')))
   (out/'audio-signal.json').write_text(json.dumps(audio,indent=2)+'\n')
   ok('original three-intensity score renders 24 seconds of nonzero unclipped PCM')
  assert not errors and not failed,(errors,failed)
  ok('no uncaught JavaScript errors or failed HTTP resources')
  browser.close()
except Exception as e:
 checks.append({'name':'R3 acceptance','status':'FAIL','error':str(e)});raise
finally:
 (out/'report.json').write_text(json.dumps({'mode':'INLINE_OFFLINE_BROWSER' if a.inline else 'HTTP_REAL_INPUT','base_url':a.base_url,'checks':checks,'errors':errors,'failed_requests':failed,'notes':['No teleport or mission-stage mutation in the three-ticket walkthrough.','Audio signal checks are not a subjective listening-panel review.']},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
