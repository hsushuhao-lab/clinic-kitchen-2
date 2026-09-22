"""R9 clean-flow acceptance test using only visible UI interactions."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', required=True)
parser.add_argument('--output', default='qa/current/r9')
args = parser.parse_args()
out = Path(args.output); out.mkdir(parents=True, exist_ok=True)
checks=[]; errors=[]; failed=[]

def done(name):
    checks.append({'name':name,'status':'PASS'})
    print('PASS:',name,flush=True)

def snap(page):
    return page.evaluate('CKR9.snapshot()')

def wait_stage(page, stage):
    page.wait_for_function('(s)=>window.CKR9 && CKR9.snapshot().stage===s', arg=stage)

def set_portions(page, rx, correct):
    for food in ['douban','garlic','scallion','chili','pepper']:
        target = rx['portions'][food]
        value = target if correct else (1 if target == 0 else 0)
        selector = f'[data-portion-choice][data-food="{food}"][data-value="{value}"]'
        page.locator(selector).click()
        assert snap(page)['portions'][food] == value

def complete_order(page, correct, tag):
    start = snap(page)
    rx = start['prescription']
    page.locator('#consultConfirmBtn').click()
    wait_stage(page,'prep')
    set_portions(page,rx,correct)
    page.locator('#prepDoneBtn').click()
    wait_stage(page,'wok')

    expected = {k for k,v in snap(page)['portions'].items() if v > 0}
    for food in expected:
        expect(page.locator(f'.wok-item[data-food="{food}"]')).to_be_visible()
    done(f'{tag}: selected ingredients visibly enter wok')

    for _ in range(3):
        page.locator('#stirBtn').click()
    page.wait_for_function('()=>CKR9.snapshot().stirs===3')
    page.wait_for_function('()=>CKR9.snapshot().simmerReady===true', timeout=5000)
    expect(page.locator('#wokDoneBtn')).to_be_enabled()
    page.locator('#wokDoneBtn').click()
    wait_stage(page,'serve')

    rice = '#riceHalfBtn' if rx['rice'] == '半碗飯' else '#riceFullBtn'
    soup = '#misoYesBtn' if rx['miso'] else '#misoNoBtn'
    page.locator(rice).click()
    page.locator(soup).click()
    expect(page.locator('#serveDoneBtn')).to_be_enabled()
    page.locator('#serveDoneBtn').click()
    wait_stage(page,'result')
    result=snap(page)['result']
    assert result is not None
    if correct:
        assert result['prescriptionFidelity'] == 100
        assert result['gateB_pass'] is True
        assert snap(page)['won'] is True
    else:
        assert result['prescriptionFidelity'] < 70
        assert result['gateB_pass'] is False
        assert result['hardFail'] is True
        assert snap(page)['won'] is False
    page.screenshot(path=str(out/f'{tag}-result.png'), full_page=True)
    return start, result

try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True,args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1536,'height':1024})
        page.set_default_timeout(15000)
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.on('response',lambda r: failed.append(r.url) if r.status>=400 else None)
        response=page.goto(args.base_url,wait_until='networkidle')
        assert response and response.status==200
        page.wait_for_function("()=>window.CKR9 && CKR9.snapshot().version==='R9_CLEAN_FLOW'")

        assert snap(page)['stage']=='consult'
        assert page.locator('#prescriptionGrid .rx-card').count()==7
        page.wait_for_function("()=>Array.from(document.querySelectorAll('#prescriptionGrid img')).every(x=>x.complete&&x.naturalWidth>0)")
        assert page.locator('[data-move]').count()==0
        assert page.locator('.scene-dpad').count()==0
        done('clean consult screen; seven prescription cards; no manual movement controls')

        start_ok,result_ok=complete_order(page,True,'correct')
        done('correct order completes CONSULT -> PREP -> WOK -> SERVE -> RESULT')
        old_ticket=start_ok['ticket']; old_patient=start_ok['patient']['id']
        page.locator('#nextPatientBtn').click(); wait_stage(page,'consult')
        s=snap(page); assert s['ticket']==old_ticket+1 and s['patient']['id']!=old_patient
        done('next patient advances cleanly')

        start_bad,result_bad=complete_order(page,False,'gate-b-fail')
        assert result_bad['hardFail']
        done('wrong prescription reaches result and fails Gate B without breaking flow')
        page.locator('#nextPatientBtn').click(); wait_stage(page,'consult')

        page.set_viewport_size({'width':390,'height':844}); page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 2')
        expect(page.locator('#consultConfirmBtn')).to_be_visible()
        page.screenshot(path=str(out/'mobile-consult.png'), full_page=True)
        done('mobile consult remains usable without horizontal overflow')

        assert not errors, errors
        assert not failed, failed
        done('no uncaught JavaScript errors or failed runtime requests')
        browser.close()
finally:
    (out/'report.json').write_text(json.dumps({'base_url':args.base_url,'checks':checks,'errors':errors,'failed_requests':failed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
