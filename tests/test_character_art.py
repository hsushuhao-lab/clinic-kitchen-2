"""Visual DOM/image regression for the approved native-resolution portrait pass.
Use --base-url for real HTTP/Pages; --inline is only offline transport review.
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from inline_shift_preview import inline_document

ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--base-url');p.add_argument('--inline',action='store_true');p.add_argument('--browser');p.add_argument('--output',default='qa/current/characters');args=p.parse_args()
assert args.base_url or args.inline
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def passed(name): checks.append({'name':name,'status':'PASS'});print('PASS:',name,flush=True)
try:
 with sync_playwright() as pw:
  opts={'headless':True,'args':['--no-sandbox']}
  if args.browser: opts['executable_path']=args.browser
  browser=pw.chromium.launch(**opts)
  page=browser.new_page(viewport={'width':1440,'height':900});page.set_default_timeout(15000)
  page.on('pageerror',lambda e:errors.append(str(e)))
  if args.inline: page.set_content(inline_document(ROOT),wait_until='load')
  else:
   response=page.goto(args.base_url,wait_until='networkidle');assert response and response.status==200
  page.wait_for_function('window.CKCharacterArt?.ready() && window.getSceneStatus?.().imagesReady')
  passed('four native RGBA character images decode before use')
  for w,h in [(1440,900),(768,1024),(390,844),(375,667)]:
   page.set_viewport_size({'width':w,'height':h})
   page.locator('#doctorPickerBtn').click();expect(page.locator('#doctorDialog')).to_be_visible()
   dims=page.locator('#doctorDialog').evaluate('''el => {const b=el.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,sw:el.scrollWidth,cw:el.clientWidth,sh:el.scrollHeight,ch:el.clientHeight};}''')
   assert dims['x']>=0 and dims['y']>=0 and dims['x']+dims['w']<=w+1 and dims['y']+dims['h']<=h+1,dims
   assert dims['sw']<=dims['cw']+1 and dims['sh']<=dims['ch']+1,dims
   assert page.locator('#doctorDialog.doctor-dialog').count()==1
   for id in ('speed','heat','strategy'):
    card=page.locator(f'.doctor-option[data-doctor="{id}"]')
    assert card.count()==1
    image=card.locator('img').evaluate('''im=>({width:im.naturalWidth,height:im.naturalHeight,fit:getComputedStyle(im).objectFit,src:im.getAttribute('src')})''')
    assert image['width']>=300 and image['height']>=300 and image['fit']=='contain',image
    assert image['src'].endswith(f'doctor-{id}-bust.webp') or (args.inline and image['src'].startswith('data:'))
    b=card.locator('span').bounding_box();assert b and b['x']>=dims['x'] and b['x']+b['width']<=dims['x']+dims['w']
   page.screenshot(path=str(out/f'selection-{w}.png'))
   page.locator('#closeDoctorBtn').click()
   passed(f'{w}x{h}: selection styled; native busts contained; text fits; no overflow')
  page.set_viewport_size({'width':1440,'height':900})
  for id in ('speed','heat','strategy'):
   page.locator('#doctorPickerBtn').click();page.locator(f'#doctorDialog [data-doctor="{id}"]').click()
   page.locator('[data-station="patient"]').click();page.wait_for_function('getSceneStatus().routeLength===0')
   page.locator('#world').focus();page.keyboard.press('e')
   expect(page.locator('#dialogModal')).to_be_visible()
   expect(page.locator('.consultation-portraits')).to_have_count(1)
   expect(page.locator('.consultation-portraits img')).to_have_count(2)
   expect(page.locator('.consultation-portraits figcaption').first).to_have_text('DR. '+id.upper())
   page.wait_for_timeout(350)
   assert page.locator('.consultation-portraits').count()==1
   assert page.evaluate('getMissionStage()')==0
   # Preference handlers survive moving the original DOM into the copy column.
   page.locator('[data-pref="scallion"] [data-val="no"]').click()
   if id=='strategy':page.screenshot(path=str(out/'consultation-1440.png'))
   page.keyboard.press('Escape')
   assert page.evaluate('currentOrder.scallion') is True
   passed(id+': correct selected doctor appears in consultation; cancellation is unchanged')
  page.set_viewport_size({'width':375,'height':667})
  page.locator('#world').focus();page.keyboard.press('e')
  expect(page.locator('.consultation-portraits')).to_have_count(1)
  for selector in ('#dialogActionBtn','#dialogCloseBtn'):
   box=page.locator(selector).bounding_box();assert box and box['y']+box['height']<=667 and box['x']>=0
  page.screenshot(path=str(out/'consultation-375.png'))
  page.keyboard.press('Escape')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight')
  passed('mobile consultation artwork preserves visible confirm/close and page viewport')
  assert not errors,errors
  passed('no uncaught JavaScript errors; scoped observer does not duplicate portraits')
  browser.close()
except Exception as e:
 checks.append({'name':'character pass','status':'FAIL','error':str(e)});raise
finally:
 (out/'report.json').write_text(json.dumps({'mode':'INLINE_OFFLINE_BROWSER' if args.inline else 'HTTP_BROWSER','base_url':args.base_url,'checks':checks,'errors':errors,'limitations':['2D native-resolution upper-body illustration, not a 3D or full-body animation asset.']},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
