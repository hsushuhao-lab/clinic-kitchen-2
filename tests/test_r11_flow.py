"""R11 M1 acceptance: doctor select + chibi consult/prep + deliberate portions + pressure timer."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

parser=argparse.ArgumentParser()
parser.add_argument('--base-url',required=True)
parser.add_argument('--output',default='qa/current/r11')
args=parser.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];failed=[]

def done(name):
    checks.append({'name':name,'status':'PASS'});print('PASS:',name,flush=True)

def snap(page): return page.evaluate('CKR11.snapshot()')
def wait_stage(page,stage):
    page.wait_for_function('(s)=>window.CKR11&&CKR11.snapshot().stage===s&&!CKR11.snapshot().traveling',arg=stage,timeout=15000)

def portion_selector(food,value):
    return f'.portion-btn[data-food="{food}"][data-portion="{value}"]'

try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1536,'height':1024})
        page.set_default_timeout(15000)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('response',lambda r:failed.append(f'{r.status} {r.url}') if r.status>=400 else None)
        res=page.goto(args.base_url,wait_until='networkidle');assert res and res.status==200
        page.wait_for_function("()=>window.CKR11&&window.CKR11World&&CKR11.snapshot().version==='R11_INTERACTIVE_KITCHEN_M1'&&CKR11World.snapshot().ready",timeout=30000)

        assert page.locator('.doctor-card').count()==3
        assert page.locator('[data-doctor="speed"]').count()==1
        assert page.locator('[data-doctor="heat"]').count()==1
        assert page.locator('[data-doctor="strategy"]').count()==1
        assert snap(page)['doctor'] is None and snap(page)['stage']=='doctor-select'
        page.screenshot(path=str(out/'desktop-doctor-select.png'),full_page=True)
        done('three playable doctors are visible before the shift begins')

        page.locator('[data-doctor="strategy"]').click()
        wait_stage(page,'consult')
        assert snap(page)['doctor']=='strategy'
        assert snap(page)['world']['doctor']=='strategy'
        expect(page.locator('#doctorHud')).to_contain_text('DR. STRATEGY')
        done('selected doctor persists in HUD and chibi route')

        before=snap(page)['irritation'];page.wait_for_timeout(1200);after=snap(page)['irritation']
        assert after>before+0.3,(before,after)
        done('patient irritation increases during active CONSULT gameplay')

        page.evaluate('CKR11.__qaSetHidden(true)')
        paused=snap(page)['irritation'];page.wait_for_timeout(1000);still=snap(page)['irritation']
        assert abs(still-paused)<0.08,(paused,still)
        assert snap(page)['paused'] is True
        page.evaluate('CKR11.__qaSetHidden(false)')
        assert snap(page)['paused'] is False
        done('visibility pause prevents hidden-tab timer catch-up')

        start_x=snap(page)['world']['x']
        page.locator('#consultConfirmBtn').click();wait_stage(page,'prep')
        assert snap(page)['world']['x']>start_x+.15
        done('chibi doctor automatically runs CONSULT -> PREP with no WASD controls')

        assert page.locator('[data-move],.scene-dpad').count()==0
        assert page.locator('.ingredient-card').count()==7
        for food in ['tofu','pork','douban','garlic','scallion','chili','pepper']:
            assert page.locator(f'.ingredient-card[data-food="{food}"] .portion-btn').count()==3
        assert page.locator('.fixed-pill').count()==0
        assert page.locator('#prepDoneBtn').is_disabled()
        done('all seven ingredients, including tofu and pork, expose 0 / half / full controls')

        pres=snap(page)['prescription']['portions']
        for food,target in pres.items():
            value='0.5' if target==0.5 else str(int(target))
            page.locator(portion_selector(food,value)).click()
            s=snap(page)
            assert s['touched'][food] is True
            assert s['portions'][food]==target,(food,target,s['portions'][food])
        expect(page.locator('#prepDoneBtn')).to_be_enabled()
        done('PREP requires explicit player decisions rather than auto-applying the prescription')

        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(350)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
        assert page.locator('#patientRail').evaluate('(x)=>x.classList.contains("is-compact")')
        expect(page.locator('#patientRailToggle')).to_be_visible()
        button_box=page.locator('#prepDoneBtn').bounding_box();assert button_box and button_box['height']>=52,button_box
        font_size=float(page.locator('.stage-head p').evaluate('(x)=>parseFloat(getComputedStyle(x).fontSize)'));assert font_size>=14,font_size
        page.screenshot(path=str(out/'mobile-prep-ready.png'),full_page=True)
        done('390x844 mobile-first layout has compact patient rail, readable type and 52px+ action target')

        page.locator('#prepDoneBtn').click();wait_stage(page,'m1-complete')
        result=snap(page)['prepResult'];assert result and result['fidelity']==100 and result['gateB_pass'] is True
        assert snap(page)['m1Complete'] is True
        expect(page.locator('#m2LockedBtn')).to_be_disabled()
        assert page.locator('#cookActionBtn').count()==0
        page.screenshot(path=str(out/'mobile-m1-checkpoint.png'),full_page=True)
        done('correct deliberate prep reaches the M1 checkpoint with WOK explicitly reserved for M2')

        frozen=snap(page)['irritation'];page.wait_for_timeout(700);assert abs(snap(page)['irritation']-frozen)<0.08
        done('patient pressure stops once the M1 checkpoint is complete')

        assert not errors,errors
        assert not failed,failed
        done('no uncaught JavaScript errors or failed runtime requests')
        browser.close()
finally:
    (out/'report.json').write_text(json.dumps({'base_url':args.base_url,'checks':checks,'errors':errors,'failed_requests':failed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')