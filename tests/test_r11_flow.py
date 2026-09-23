"""R11 M4 acceptance: doctor select + deliberate prep + manual wok + serve/delivery/result + timeout failure."""
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

try:
  with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1536,'height':1024});page.set_default_timeout(20000)
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failed.append(f'{r.status} {r.url}') if r.status>=400 else None)
    res=page.goto(args.base_url,wait_until='networkidle');assert res and res.status==200
    page.wait_for_function("()=>window.CKR11&&window.CKR11World&&CKR11.snapshot().version==='R11_INTERACTIVE_KITCHEN_M4'&&CKR11World.snapshot().ready",timeout=30000)

    expect(page.locator('#introOverlay')).to_be_visible()
    intro_paths=['title.webp','intro01.webp','intro02.webp']
    for step,path in enumerate(intro_paths):
        assert snap(page)['introStep']==step
        assert path in page.locator('#introArt').get_attribute('src')
        page.wait_for_function("()=>introArt.complete&&introArt.naturalWidth>0")
        assert page.locator('#introTitle').evaluate("el=>parseFloat(getComputedStyle(el).fontSize)")>=38
        page.screenshot(path=str(out/f'desktop-intro-{step}.png'))
        page.locator('#introNextBtn').click()
    expect(page.locator('#introOverlay')).to_be_hidden();assert snap(page)['introFinished'] is True and snap(page)['introSeen'] is True
    assert page.evaluate("()=>localStorage.getItem('clinic_kitchen_intro_seen_v11')")=='true'
    page.reload(wait_until='networkidle');page.wait_for_function("()=>window.CKR11&&CKR11World.snapshot().ready")
    expect(page.locator('#introOverlay')).to_be_visible();assert snap(page)['introStep']==0 and snap(page)['introSeen'] is True
    page.locator('#introNextBtn').click();expect(page.locator('#introOverlay')).to_be_hidden()
    page.locator('#introReplayBtn').click();expect(page.locator('#introOverlay')).to_be_visible();page.locator('#introNextBtn').click();assert snap(page)['introStep']==1
    page.locator('#introSkipBtn').click();expect(page.locator('#introOverlay')).to_be_hidden()
    done('intro persists: returning players keep title screen, PRESS START skips story, replay remains available')

    assert page.locator('.difficulty-btn').count()==3
    easy_rate=snap(page)['irritationRate']
    page.locator('[data-difficulty="normal"]').click();assert snap(page)['difficulty']=='normal'
    assert all(x=='?' for x in page.locator('#symptomList .symptom-row > strong').all_text_contents())
    assert '份' not in page.locator('#prescriptionGrid').inner_text()
    page.locator('[data-difficulty="hard"]').click();assert snap(page)['difficulty']=='hard'
    hard_rate=snap(page)['irritationRate'];assert abs(hard_rate/easy_rate-1.20)<0.02,(easy_rate,hard_rate)
    assert page.locator('#symptomList .symptom-row.is-qualitative').count()==7
    assert page.locator('#symptomList .symptom-bar').count()==0
    assert '處方份量已隱藏' in page.locator('#prescriptionGrid').inner_text()
    page.locator('[data-difficulty="easy"]').click();assert snap(page)['difficulty']=='easy'
    assert page.locator('#symptomList .symptom-bar').count()==7
    assert '份' in page.locator('#prescriptionGrid').inner_text()
    done('Easy / Normal / Hard change CONSULT information and HARD pressure is exactly +20%')

    assert page.locator('.doctor-card').count()==3
    for doctor in ['speed','heat','strategy']:
        art=page.locator(f'.doctor-card[data-doctor="{doctor}"] .doctor-art')
        expect(art).to_be_visible()
        assert f'assets/r11/doctors/doctor_{doctor}.webp' in art.get_attribute('src')
    page.wait_for_function("()=>Array.from(document.querySelectorAll('.doctor-art')).every(x=>x.complete&&x.naturalWidth>0)")
    assert '+50%' in page.locator('[data-doctor="heat"]').inner_text()
    assert '偏差扣分降低' in page.locator('[data-doctor="strategy"]').inner_text()
    page.screenshot(path=str(out/'desktop-doctor-select.png'),full_page=True);done('three doctors expose distinct SPEED / HEAT / STRATEGY mechanics')
    expect(page.locator('#soundToggle')).to_be_visible()
    page.locator('[data-doctor="heat"]').click();wait_stage(page,'consult');assert snap(page)['doctor']=='heat' and snap(page)['difficulty']=='easy' and snap(page)['world']['doctor']=='heat' and snap(page)['musicEnabled'] is True
    portrait=page.locator('#patientPortrait');expect(portrait).to_be_visible();assert portrait.get_attribute('src').endswith('/office.webp');page.wait_for_function("()=>patientPortrait.complete&&patientPortrait.naturalWidth>0")
    assert page.locator('.stage-head h1').evaluate("el=>parseFloat(getComputedStyle(el).fontSize)")>=29
    assert page.locator('#patientComplaint').evaluate("el=>parseFloat(getComputedStyle(el).fontSize)")>=16
    for level in [55,75,90]:
        assert page.evaluate("(l)=>CKR11.__qaTriggerComplaint(l)",level)
        expect(page.locator('#eventOverlay')).to_be_visible()
        assert f'complaint_{level}.webp' in page.locator('#eventArt').get_attribute('src')
        page.wait_for_function("()=>eventArt.complete&&eventArt.naturalWidth>0")
        assert page.locator('#eventTitle').evaluate("el=>parseFloat(getComputedStyle(el).fontSize)")>=26
        page.locator('#eventDismissBtn').click();expect(page.locator('#eventOverlay')).to_be_hidden()
    done('larger typography, tension music UI and all three patient complaint cut-ins are active')

    before=snap(page)['irritation'];page.wait_for_timeout(900);assert snap(page)['irritation']>before+.2
    page.evaluate('CKR11.__qaSetHidden(true)');paused=snap(page)['irritation'];page.wait_for_timeout(700);assert abs(snap(page)['irritation']-paused)<.08;page.evaluate('CKR11.__qaSetHidden(false)');done('patient timer runs and hidden-tab pause works')

    page.locator('#consultConfirmBtn').click();wait_stage(page,'prep');assert page.locator('.ingredient-card').count()==7
    for food in ['tofu','pork','douban','garlic','scallion','chili','pepper']:assert page.locator(f'.ingredient-card[data-food="{food}"] .portion-btn').count()==3
    assert page.locator('.fixed-pill').count()==0;done('all seven ingredients expose 0 / half / full controls')
    pres=snap(page)['prescription']
    for food,target in pres['portions'].items():
        value='0.5' if target==0.5 else str(int(target));page.locator(portion_selector(food,value)).click()
    page.locator('#prepDoneBtn').click();wait_stage(page,'wok');assert snap(page)['prepResult']['fidelity']==100 and snap(page)['prepResult']['gateB_pass'];done('R11 rules evaluator gives correct manual PREP 100 fidelity')

    assert snap(page)['heatLevel']=='off' and snap(page)['stirCount']==0 and snap(page)['wokPhase']=='heat'
    page.wait_for_timeout(500);assert snap(page)['stirCount']==0 and snap(page)['simmerSeconds']==0
    page.locator('.heat-btn[data-heat="medium"]').click();assert snap(page)['wokPhase']=='drop'
    batch_count=snap(page)['wokBatchCount'];assert batch_count>=2
    for i in range(batch_count):
        expect(page.locator('#dropIngredientBtn')).to_be_enabled();page.locator('#dropIngredientBtn').click();page.wait_for_timeout(430)
        assert snap(page)['dropIndex']==i+1
    assert snap(page)['wokPhase']=='stir'
    schedule=snap(page)['eventSchedule'];assert len(schedule)==2 and schedule[0]['stir'] in [2,3] and schedule[1]['stir'] in [4,5]
    page.evaluate("()=>CKR11.__qaSetEventSchedule(3,5)")
    page.locator('#stirBtn').click();page.wait_for_timeout(120);assert snap(page)['stirCount']==1
    page.locator('#stirBtn').click();page.wait_for_timeout(150);assert snap(page)['stirCount']==2 and snap(page)['combo']==0 and snap(page)['lastStirTiming']=='fast'
    for expected in range(3,7):
        page.wait_for_timeout(320)
        page.locator('#stirBtn').click();page.wait_for_timeout(120);assert snap(page)['stirCount']==expected
        if page.locator('#rescueBtn').count():
            page.locator('#rescueBtn').click();page.wait_for_timeout(120)
    assert snap(page)['maxCombo']>=3 and snap(page)['rescuedEvents']==2
    assert page.locator('.sizzle-particles b').count()==12
    done('WOK uses per-round event schedule and <300ms spam becomes TOO FAST with combo reset')

    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(250)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2');box=page.locator('#startSimmerBtn').bounding_box();assert box and box['height']>=54
    page.locator('#startSimmerBtn').click();page.wait_for_timeout(4700);sec=snap(page)['simmerSeconds'];assert 4.3<=sec<=5.6,sec
    page.locator('#finishSimmerBtn').click();wait_stage(page,'serve')
    result=snap(page)['cookingResult'];assert result and result['simmerKey']=='perfect' and result['cookingQuality']>=75,result
    assert result['ingredientTimingScore']>=90 and result['comboScore']>=50 and result['rescueScore']==100,result
    assert snap(page)['world']['stage']=='serve' and snap(page)['world']['x']>.8
    page.screenshot(path=str(out/'mobile-serve.png'),full_page=True);done('manual PERFECT simmer travels to SERVE on mobile')

    page.locator('#riceHalfBtn').click();half_src=page.locator('#trayRice').get_attribute('src')
    page.locator('#riceFullBtn').click();full_src=page.locator('#trayRice').get_attribute('src');assert half_src!=full_src
    page.locator('#misoYesBtn').click();expect(page.locator('#traySoup')).to_be_visible()
    page.locator('#misoNoBtn').click();expect(page.locator('#trayNoSoup')).to_be_visible()
    page.locator('#riceHalfBtn' if pres['rice']=='半碗飯' else '#riceFullBtn').click()
    page.locator('#misoYesBtn' if pres['miso'] else '#misoNoBtn').click()
    assert snap(page)['rice']==pres['rice'] and snap(page)['miso']==pres['miso']
    box=page.locator('#serveDoneBtn').bounding_box();assert box and box['height']>=54;done('rice/miso controls are manual, visible and mobile-sized')

    ticket=snap(page)['ticket'];patient_id=snap(page)['patient']['id']
    page.locator('#serveDoneBtn').click();page.wait_for_function("()=>CKR11.snapshot().stage==='victory'",timeout=5000)
    expect(page.locator('#victoryArt')).to_be_visible();assert 'assets/r11/events/victory.webp' in page.locator('#victoryArt').get_attribute('src')
    page.wait_for_function("()=>victoryArt.complete&&victoryArt.naturalWidth>0")
    assert page.locator('.victory-native-copy strong').evaluate("el=>parseFloat(getComputedStyle(el).fontSize)")>=34
    page.screenshot(path=str(out/'desktop-victory-clear.png'))
    page.locator('#victoryContinueBtn').click();page.wait_for_function("()=>CKR11.snapshot().stage==='result'",timeout=5000)
    final=snap(page)['finalResult'];assert final and final['won'] and final['valid'] and snap(page)['won'] is True and snap(page)['ordersCompleted']==1 and snap(page)['streak']==1
    expected_total=round(final['prescriptionFidelity']*.25+final['cookingQuality']*.25+final['serviceFidelity']*.20+final['speedScore']*.15+final['patientMood']*.15)
    assert final['total']==expected_total
    invalid=page.evaluate("()=>CKR11.__qaScoreFinal({prescriptionFidelity:95,cookingQuality:90,serviceFidelity:100,speedScore:90,patientMood:90,gateBPass:false,servicePass:true})")
    assert invalid['total']>=90 and invalid['valid'] is False and invalid['rank']=='—'
    assert snap(page)['serviceResult']['pass'] is True and page.locator('.score-card').count()==5
    expect(page.locator('.result-hero-r11.is-win')).to_be_visible();expect(page.locator('.result-rank')).to_be_visible();expect(page.locator('.result-detail-grid')).to_be_visible();assert page.locator('.cook-breakdown-chip').count()==5
    page.screenshot(path=str(out/'mobile-success-result.png'),full_page=True)
    page.set_viewport_size({'width':1536,'height':1024});page.wait_for_timeout(250)
    assert page.locator('#gameMain').evaluate("el=>el.classList.contains('is-result-mode')")
    assert page.locator('.result-shell').evaluate("el=>el.scrollHeight<=el.clientHeight+2")
    assert page.evaluate("()=>{const a=[...document.querySelectorAll('.result-shell .stage-actions button')];return a.length===2&&a.every(b=>{const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight-28&&r.width>0&&r.height>=40})}")
    page.screenshot(path=str(out/'desktop-result-one-screen.png'))
    done('RESULT fits 1536x1024 in one screen with both action buttons fully visible')
    for viewport in [{'width':1366,'height':768},{'width':810,'height':1080}]:
        page.set_viewport_size(viewport);page.wait_for_timeout(180)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
        for selector in ['#retryPatientBtn','#nextPatientBtn']:
            btn=page.locator(selector);btn.scroll_into_view_if_needed();box=btn.bounding_box();assert box and box['height']>=40 and box['width']>0
    page.set_viewport_size({'width':1536,'height':1024});page.wait_for_timeout(120)
    done('1366x768 and 810x1080 have no horizontal overflow and result actions remain reachable')

    page.locator('#nextPatientBtn').click();wait_stage(page,'consult')
    assert snap(page)['ticket']==ticket+1 and snap(page)['patient']['id']!=patient_id and snap(page)['doctor']=='heat'
    done('next patient advances ticket while keeping selected doctor for the shift')

    page.set_viewport_size({'width':1200,'height':900});page.goto(args.base_url,wait_until='networkidle');page.wait_for_function("()=>window.CKR11&&CKR11World.snapshot().ready")
    page.locator('#introSkipBtn').click();expect(page.locator('#introOverlay')).to_be_hidden()
    page.locator('[data-doctor="speed"]').click();wait_stage(page,'consult');page.evaluate('CKR11.__qaSetIrritation(99.9)')
    page.wait_for_function("()=>CKR11.snapshot().cutInActive===true",timeout=5000);expect(page.locator('#eventOverlay')).to_be_visible()
    assert 'complaint_90.webp' in page.locator('#eventArt').get_attribute('src');page.locator('#eventDismissBtn').click()
    page.wait_for_function("()=>CKR11.snapshot().stage==='fail-table-flip'",timeout=5000)
    expect(page.locator('.failure-table')).to_be_visible();src=page.locator('.failure-doctor').get_attribute('src');assert 'assets/r11/doctors/doctor_speed_bump.webp' in src,src
    page.screenshot(path=str(out/'desktop-timeout-failure.png'),full_page=True);done('patient timeout still triggers table flip with selected doctor reaction')

    assert not errors,errors;assert not failed,failed;done('no uncaught JavaScript errors or failed runtime requests')
    browser.close()
finally:
  (out/'report.json').write_text(json.dumps({'base_url':args.base_url,'checks':checks,'errors':errors,'failed_requests':failed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
