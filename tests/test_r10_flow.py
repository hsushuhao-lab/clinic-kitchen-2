"""R10 acceptance: chibi running map + kitchen prep/wok/serve gameplay."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

parser=argparse.ArgumentParser()
parser.add_argument('--base-url',required=True)
parser.add_argument('--output',default='qa/current/r10')
args=parser.parse_args()
out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];failed=[]

def done(name):
    checks.append({'name':name,'status':'PASS'});print('PASS:',name,flush=True)

def snap(page): return page.evaluate('CKR10.snapshot()')
def wait_stage(page,stage):
    page.wait_for_function('(s)=>window.CKR10&&CKR10.snapshot().stage===s&&!CKR10.snapshot().traveling',arg=stage,timeout=15000)

def set_portions(page,pres,correct):
    for food in ['douban','garlic','scallion','chili','pepper']:
        target=pres['portions'][food]
        value=target if correct else (1 if target==0 else 0)
        page.locator(f'.portion-btn[data-food="{food}"][data-portion="{value}"]').click()
        assert snap(page)['portions'][food]==value

def complete_order(page,correct,tag):
    start=snap(page);pres=start['prescription']
    start_x=start['world']['x']
    page.locator('#consultConfirmBtn').click()
    wait_stage(page,'prep')
    assert snap(page)['world']['x']>start_x+.15
    done(tag+': chibi doctor runs CONSULT -> PREP')

    set_portions(page,pres,correct)
    expect(page.locator('#boardFoodPreview')).to_be_visible()
    page.locator('#prepDoneBtn').click()
    wait_stage(page,'wok')

    expected={k for k,v in snap(page)['portions'].items() if v>0}
    actual=set(page.locator('#wokFoodLayer .wok-food').evaluate_all('(xs)=>xs.map(x=>x.dataset.food)'))
    assert expected==actual,(expected,actual)
    for food in expected:
        expect(page.locator(f'#wokFoodLayer .wok-food[data-food="{food}"]')).to_be_visible()
    done(tag+': selected ingredients are visibly in wok')

    expect(page.locator('#stirBtn')).to_be_disabled()
    page.locator('#fireBtn').click()
    expect(page.locator('#stirBtn')).to_be_enabled()
    for _ in range(3):
        page.locator('#stirBtn').click()
        page.wait_for_timeout(100)
    page.wait_for_function('()=>CKR10.snapshot().simmerReady===true',timeout=6000)
    expect(page.locator('#wokDoneBtn')).to_be_enabled()
    page.locator('#wokDoneBtn').click()
    wait_stage(page,'serve')
    done(tag+': fire, three stirs and simmer complete')

    rice='#riceHalfBtn' if pres['rice']=='半碗飯' else '#riceFullBtn'
    page.locator(rice).click()
    expect(page.locator('#trayRice')).to_be_visible()
    expected_rice='rice-half.webp' if pres['rice']=='半碗飯' else 'rice-full.webp'
    assert expected_rice in page.locator('#trayRice').get_attribute('src')

    soup='#misoYesBtn' if pres['miso'] else '#misoNoBtn'
    page.locator(soup).click()
    if pres['miso']:
        expect(page.locator('#traySoup')).to_be_visible()
        assert page.locator('#trayNoSoup').count()==0
    else:
        expect(page.locator('#trayNoSoup')).to_be_visible()
        assert page.locator('#traySoup').count()==0
    done(tag+': rice and miso tray preview changes with selection')

    expect(page.locator('#serveDoneBtn')).to_be_enabled()
    page.locator('#serveDoneBtn').click()
    page.wait_for_function("()=>CKR10.snapshot().stage==='result'",timeout=15000)
    result=snap(page)['result'];assert result is not None
    if correct:
        assert result['prescriptionFidelity']==100
        assert result['gateB_pass'] is True
        assert snap(page)['won'] is True
    else:
        assert result['prescriptionFidelity']<70
        assert result['gateB_pass'] is False
        assert result['hardFail'] is True
        assert snap(page)['won'] is False
    page.screenshot(path=str(out/f'{tag}-result.png'),full_page=True)
    return start,result

try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1536,'height':1024})
        page.set_default_timeout(15000)
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
        res=page.goto(args.base_url,wait_until='networkidle');assert res and res.status==200
        page.wait_for_function("()=>window.CKR10&&window.CKR10World&&CKR10.snapshot().version==='R10_KITCHEN_REBUILD'&&CKR10World.snapshot().ready",timeout=30000)

        assert page.locator('#worldCanvas').count()==1
        assert page.locator('.station-labels span').count()==4
        assert page.locator('[data-move],.scene-dpad').count()==0
        assert page.locator('#prescriptionGrid .rx-chip').count()==7
        page.wait_for_function("()=>Array.from(document.querySelectorAll('#prescriptionGrid img')).every(x=>x.complete&&x.naturalWidth>0)")
        done('R10 loads chibi world, seven prescription cards, no manual movement controls')

        start_ok,result_ok=complete_order(page,True,'correct')
        done('correct order completes kitchen flow with 100% fidelity')

        old=snap(page);page.locator('#nextPatientBtn').click();wait_stage(page,'consult')
        new=snap(page);assert new['ticket']==old['ticket']+1 and new['patient']['id']!=old['patient']['id']
        portrait=page.locator('.patient-card').bounding_box();complaint=page.locator('.complaint-card').bounding_box()
        assert portrait and complaint and complaint['y']>=portrait['y']+portrait['height']-1,(portrait,complaint)
        done('next patient refreshes rail cleanly without text over portrait')

        _,result_bad=complete_order(page,False,'gate-b-fail')
        assert result_bad['hardFail']
        done('wrong prescription reaches Gate B failure without breaking flow')
        page.locator('#nextPatientBtn').click();wait_stage(page,'consult')

        page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+2')
        expect(page.locator('#consultConfirmBtn')).to_be_visible()
        page.screenshot(path=str(out/'mobile-consult.png'),full_page=True)
        done('mobile layout remains usable without horizontal overflow')

        assert not errors,errors
        assert not failed,failed
        done('no uncaught JavaScript errors or failed runtime requests')
        browser.close()
finally:
    (out/'report.json').write_text(json.dumps({'base_url':args.base_url,'checks':checks,'errors':errors,'failed_requests':failed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
