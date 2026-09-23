"""R11 M2 acceptance: doctor select + deliberate prep + manual heat/stir/simmer + timeout failure."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

parser=argparse.ArgumentParser()
parser.add_argument('--base-url',required=True)
parser.add_argument('--output',default='qa/current/r11')
args=parser.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];failed=[]

def done(name):checks.append({'name':name,'status':'PASS'});print('PASS:',name,flush=True)
def snap(page):return page.evaluate('CKR11.snapshot()')
def wait_stage(page,stage):page.wait_for_function('(s)=>window.CKR11&&CKR11.snapshot().stage===s&&!CKR11.snapshot().traveling',arg=stage,timeout=20000)
def portion_selector(food,value):return f'.portion-btn[data-food="{food}"][data-portion="{value}"]'

def choose_and_prep(page,doctor='heat'):
    page.locator(f'[data-doctor="{doctor}"]').click();wait_stage(page,'consult')
    page.locator('#consultConfirmBtn').click();wait_stage(page,'prep')
    pres=snap(page)['prescription']['portions']
    for food,target in pres.items():
        value='0.5' if target==0.5 else str(int(target))
        page.locator(portion_selector(food,value)).click()
    expect(page.locator('#prepDoneBtn')).to_be_enabled();page.locator('#prepDoneBtn').click();wait_stage(page,'wok')

try:
  with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1536,'height':1024});page.set_default_timeout(20000)
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failed.append(f'{r.status} {r.url}') if r.status>=400 else None)
    res=page.goto(args.base_url,wait_until='networkidle');assert res and res.status==200
    page.wait_for_function("()=>window.CKR11&&window.CKR11World&&CKR11.snapshot().version==='R11_INTERACTIVE_KITCHEN_M2'&&CKR11World.snapshot().ready",timeout=30000)

    assert page.locator('.doctor-card').count()==3;page.screenshot(path=str(out/'desktop-doctor-select.png'),full_page=True);done('three playable doctors visible')
    page.locator('[data-doctor="heat"]').click();wait_stage(page,'consult');assert snap(page)['doctor']=='heat' and snap(page)['world']['doctor']=='heat';done('DR. HEAT persists in HUD and chibi world')

    before=snap(page)['irritation'];page.wait_for_timeout(1000);assert snap(page)['irritation']>before+.25
    page.evaluate('CKR11.__qaSetHidden(true)');paused=snap(page)['irritation'];page.wait_for_timeout(800);assert abs(snap(page)['irritation']-paused)<.08;page.evaluate('CKR11.__qaSetHidden(false)');done('patient timer runs and hidden-tab pause works')

    page.locator('#consultConfirmBtn').click();wait_stage(page,'prep');assert page.locator('.ingredient-card').count()==7
    for food in ['tofu','pork','douban','garlic','scallion','chili','pepper']:assert page.locator(f'.ingredient-card[data-food="{food}"] .portion-btn').count()==3
    assert page.locator('.fixed-pill').count()==0;done('all seven ingredients expose 0 / half / full controls')
    pres=snap(page)['prescription']['portions']
    for food,target in pres.items():
        value='0.5' if target==0.5 else str(int(target));page.locator(portion_selector(food,value)).click()
    expect(page.locator('#prepDoneBtn')).to_be_enabled();page.locator('#prepDoneBtn').click();wait_stage(page,'wok');assert snap(page)['prepResult']['fidelity']==100;done('manual PREP reaches WOK with 100 fidelity')

    # Nothing should cook automatically.
    assert snap(page)['heatLevel']=='off' and snap(page)['stirCount']==0 and snap(page)['wokPhase']=='heat'
    page.wait_for_timeout(900);assert snap(page)['stirCount']==0 and snap(page)['simmerSeconds']==0
    assert page.locator('.heat-btn').count()==4;expect(page.locator('#stirBtn')).to_be_disabled();done('WOK starts idle; no automatic fire, stir or simmer')

    page.locator('.heat-btn[data-heat="medium"]').click();expect(page.locator('#stirBtn')).to_be_enabled()
    for i in range(3):
        page.locator('#stirBtn').click();page.wait_for_timeout(420);assert snap(page)['stirCount']==i+1
    assert page.locator('#startSimmerBtn').count()==1;done('player manually controls medium heat and all three stir actions')

    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(300)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2');box=page.locator('#startSimmerBtn').bounding_box();assert box and box['height']>=54
    page.screenshot(path=str(out/'mobile-wok-ready.png'),full_page=True);done('mobile WOK remains readable and touch targets are large')

    page.locator('#startSimmerBtn').click();assert snap(page)['wokPhase']=='simmer';page.wait_for_timeout(4700)
    sec=snap(page)['simmerSeconds'];assert 4.3<=sec<=5.5,sec
    expect(page.locator('#finishSimmerBtn')).to_be_enabled();page.locator('#finishSimmerBtn').click();wait_stage(page,'m2-complete')
    result=snap(page)['cookingResult'];assert result and result['simmerKey']=='perfect' and result['cookingQuality']>=90,result
    expect(page.locator('#m3LockedBtn')).to_be_disabled();assert page.locator('#serveDoneBtn').count()==0
    page.screenshot(path=str(out/'mobile-m2-checkpoint.png'),full_page=True);done('manual simmer timing reaches PERFECT and M2 checkpoint without auto-serving')

    # Reload to prove timeout failure and doctor-specific bump art.
    page.set_viewport_size({'width':1200,'height':900});page.goto(args.base_url,wait_until='networkidle');page.wait_for_function("()=>window.CKR11&&CKR11World.snapshot().ready")
    page.locator('[data-doctor="speed"]').click();wait_stage(page,'consult');page.evaluate('CKR11.__qaSetIrritation(99.9)');page.wait_for_function("()=>CKR11.snapshot().stage==='fail-table-flip'",timeout=5000)
    expect(page.locator('.failure-table')).to_be_visible();src=page.locator('.failure-doctor').get_attribute('src');assert 'doctor_speed_bump.webp' in src,src
    page.screenshot(path=str(out/'desktop-timeout-failure.png'),full_page=True);done('patient timeout triggers table flip with the selected doctor reaction')

    assert not errors,errors;assert not failed,failed;done('no uncaught JavaScript errors or failed runtime requests')
    browser.close()
finally:
  (out/'report.json').write_text(json.dumps({'base_url':args.base_url,'checks':checks,'errors':errors,'failed_requests':failed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')