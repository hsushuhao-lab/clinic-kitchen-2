"""R5 actual-keyboard recipe, heat and reaction acceptance. No state mutation/teleports.
--inline is local offline transport, never reported as HTTP validation.
"""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from inline_shift_preview import inline_document
R=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--base-url');p.add_argument('--inline',action='store_true');p.add_argument('--browser');p.add_argument('--output',default='qa/current/service');a=p.parse_args()
assert a.base_url or a.inline
out=Path(a.output);out.mkdir(parents=True,exist_ok=True);checks=[];errors=[];failed=[]
def done(name):checks.append({'name':name,'status':'PASS'});print('PASS:',name,flush=True)
try:
 with sync_playwright() as pw:
  opts={'headless':True,'args':['--no-sandbox']}
  if a.browser:opts['executable_path']=a.browser
  b=pw.chromium.launch(**opts);page=b.new_page(viewport={'width':1366,'height':768});page.set_default_timeout(20000)
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
  if a.inline:page.set_content(inline_document(R),wait_until='load')
  else:assert page.goto(a.base_url,wait_until='networkidle').status==200
  page.wait_for_function('window.CKService && getSceneStatus().imagesReady')
  def c():return page.evaluate('getCookingStatus()')
  def s():return page.evaluate('getSceneStatus()')
  def service():return page.evaluate('CKService.snapshot()')
  def go(id):
   page.locator(f'[data-station="{id}"]').click();page.wait_for_function('getSceneStatus().routeLength===0');assert s()['interactiveTarget']['id']==id;page.locator('#world').focus()
  def enter(id):
   go(id);page.keyboard.press('e');expect(page.locator('#dialogModal')).to_be_visible();page.keyboard.press('e');expect(page.locator('#dialogModal')).not_to_be_visible()
  def setup():
   order=page.evaluate('CKClinic.snapshot().order')
   # Replaced 3 separate patient/desk/fridge stations: R6 consolidated consultation station
   enter('consult')
   # E away from prep must not cut or bypass the station gate.
   before=c()['prepped'];page.keyboard.press('1');page.keyboard.press('e');assert c()['prepped']==before
   if page.locator('#dialogModal').is_visible():page.keyboard.press('Escape')
   go('prep')
   keys=[('1',3),('2',1),('3',1),('4',1)]
   if order['scallion']:keys.append(('5',1))
   if order['spicy']=='重辣':keys.append(('6',1))
   for key,n in keys:
    page.keyboard.press(key)
    for _ in range(n):page.keyboard.press('e');page.wait_for_timeout(240)
   assert len(c()['prepped'])==len(keys)
   page.screenshot(path=str(out/'keyboard-prep.png'))
   # Replaced sequential addition: R6 batch wok drop in single E press
   go('wok');page.keyboard.press('f')
   page.keyboard.press('e');page.wait_for_timeout(80)
   for _ in range(3):page.keyboard.press('e');page.wait_for_timeout(250)
   page.wait_for_function('window.cookedDish.isSimmered')
   return order
  # Replaced 3 request chips: R6 adds miso soup preference (4 image-backed preference chips)
  assert page.locator('#requestIcons img').count()==4
  assert page.locator('#requestIcons img').evaluate_all('(xs)=>xs.every(x=>x.complete&&x.naturalWidth===144)')
  assert page.locator('#patientHUD .patient-portrait').evaluate('(x)=>x.complete&&x.naturalWidth>250')
  for w,h in [(1366,768),(375,667)]:
   page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(80);page.screenshot(path=str(out/f'initial-{w}.png'))
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight')
  page.set_viewport_size({'width':1366,'height':768});done('native patient bust and 4 image-backed preferences; desktop/mobile fit')
  order=setup();done('E plus 1–6 completes prep and cooking with no mouse ingredient/cut/stir actions')
  page.wait_for_function('getCookingStatus().simmerTimer>=7.2')
  assert service()['penalty']>=3 and c()['heated'] and c()['stage']==5
  page.screenshot(path=str(out/'overheat-running.png'))
  page.keyboard.press('p');page.wait_for_timeout(80);heat=service()['overheatSeconds'];page.wait_for_timeout(500)
  assert abs(service()['overheatSeconds']-heat)<1e-6
  page.locator('#sessionContinueBtn').click();page.locator('#world').focus()
  while c()['heated']:page.keyboard.press('f');page.wait_for_timeout(100)
  heat=service()['overheatSeconds'];page.wait_for_timeout(350);assert abs(service()['overheatSeconds']-heat)<1e-6
  penalty=service()['penalty'];assert penalty>=3
  done('heat continues beyond 4 seconds; deductions persist; pause and F-off stop accumulation')
  # Replaced remote delivery at rice station: R6 serve station + physical return to consult
  go('serve');page.keyboard.press('1' if order['rice']=='半碗飯' else '2')
  if bool(order.get('miso')) != bool(page.evaluate('!!window.cookedDish.miso')):
   page.keyboard.press('q')
  page.locator('#clinicPlateBtn').click()
  page.wait_for_function('getCookingStatus().plated')
  go('consult')
  pos=s()['playerPos'];page.keyboard.press('e')
  expect(page.locator('#clinicResult')).to_be_visible()
  # Replaced R5 soft mallet on minor penalty: R6 relative reduction >= 25% produces successful clinic meal feast
  expect(page.locator('#clinicResult .finale-banner[data-finale="success"]')).to_be_visible()
  assert page.evaluate('CKClinic.snapshot().result.quality')==100-penalty
  page.keyboard.down('d');page.wait_for_timeout(250);page.keyboard.up('d');assert s()['playerPos']==pos
  done('heat penalty applied accurately to quality; world and player position remain frozen during result')
  for w,h in [(1366,768),(375,667)]:
   page.set_viewport_size({'width':w,'height':h});page.wait_for_timeout(100)
   data=page.locator('#clinicResult').evaluate('(e)=>({h:e.clientHeight,sh:e.scrollHeight,y:e.getBoundingClientRect().y,b:e.getBoundingClientRect().bottom})')
   assert data['sh']<=data['h']+1 and data['y']>=0 and data['b']<=h+1,data
   # Replaced 6 comparison icons: R6 comparison includes 4 items (spicy, scallion, rice, miso) * 2 = 8
   assert page.locator('#clinicComparison .comparison-icon').count()==8
   page.screenshot(path=str(out/f'bonk-result-{w}.png'))
  done('result shows both requested and served icons and visible next button without scrolling')
  page.set_viewport_size({'width':1366,'height':768});page.locator('#clinicNextBtn').click();assert service()['reaction'] is None
  assert service()['overheatSeconds']==0 and service()['penalty']==0
  order=setup()
  while c()['heated']:page.keyboard.press('f');page.wait_for_timeout(100)
  assert service()['penalty']==0
  # Replaced remote delivery at rice station: R6 serve station + physical return to consult
  go('serve');page.keyboard.press('1' if order['rice']=='半碗飯' else '2')
  if bool(order.get('miso')) != bool(page.evaluate('!!window.cookedDish.miso')):
   page.keyboard.press('q')
  page.locator('#clinicPlateBtn').click()
  page.wait_for_function('getCookingStatus().plated')
  go('consult')
  page.keyboard.press('e')
  expect(page.locator('#clinicResult')).to_be_visible();assert page.evaluate('CKClinic.snapshot().result.quality')==100
  assert service()['reaction'] is None and page.locator('.bonk-actor').count()==0
  page.screenshot(path=str(out/'satisfied-result.png'));done('next patient resets heat/reaction; correct order gets 100% and no bonk')
  assert not errors and not failed,(errors,failed)
  done('no uncaught errors or failed HTTP resources')
  b.close()
except Exception as e:
 checks.append({'name':'R5 service acceptance','status':'FAIL','error':str(e)});raise
finally:
 (out/'report.json').write_text(json.dumps({'mode':'INLINE_OFFLINE' if a.inline else 'HTTP_REAL_INPUT','checks':checks,'errors':errors,'failed_requests':failed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
