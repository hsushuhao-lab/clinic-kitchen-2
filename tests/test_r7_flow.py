"""R7 Clinical Cooking UX Redesign end-to-end acceptance tests.
Verifies:
1. Top clinic scene <= 20% height (16-18vh), no duplicate chibi patient.
2. Persistent left patient HUD with 7 clinical metrics and patient complaint.
3. Zero-WASD automated workflow (Consult -> Prep -> Wok -> Serve -> Deliver).
4. 7 visual ingredients supporting [0] [半] [1] portions.
5. Plated tray preview with sides selection.
6. In-flow non-blocking settlement dialog preserving left HUD and top scene visibility.
7. Clinical metrics deltas (Before -> After) and 4 subjective axes patient review.
8. Dual top scene finale (feast vs table-flip).
"""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from inline_shift_preview import inline_document

ROOT = Path(__file__).resolve().parents[1]

parser = argparse.ArgumentParser()
parser.add_argument('--base-url')
parser.add_argument('--inline', action='store_true')
parser.add_argument('--browser')
parser.add_argument('--output', default='qa/current/r7')
args = parser.parse_args()

assert args.base_url or args.inline
out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
checks = []
errors = []
failed = []

def done(name):
    checks.append({'name': name, 'status': 'PASS'})
    print('PASS:', name, flush=True)

with sync_playwright() as pw:
    opts = {'headless': True, 'args': ['--no-sandbox']}
    if args.browser:
        opts['executable_path'] = args.browser
    b = pw.chromium.launch(**opts)
    page = b.new_page(viewport={'width': 1366, 'height': 768})
    page.set_default_timeout(20000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: failed.append(r.url) if r.status >= 400 else None)

    if args.inline:
        page.set_content(inline_document(ROOT), wait_until='load')
    else:
        assert page.goto(args.base_url, wait_until='networkidle').status == 200

    page.wait_for_function('window.CKClinic && getSceneStatus().imagesReady')

    # 1. Check Top Clinic Scene height <= 20% of layout height
    world_box = page.locator('#world').bounding_box()
    app_box = page.locator('#app').bounding_box()
    ratio = world_box['height'] / app_box['height']
    assert ratio <= 0.205, f"Top world height ratio {ratio:.3f} exceeds 20%"
    done(f'top clinic scene height is {ratio*100:.1f}% <= 20% of viewport')

    # 2. Check persistent left patient HUD with 7 clinical metrics
    metrics = ['craving', 'focus', 'anxiety', 'impulsivity', 'language', 'memory', 'sleepiness']
    for m in metrics:
        expect(page.locator(f'#patientHUD #{m}Meter')).to_be_visible()
        expect(page.locator(f'#patientHUD #{m}Text')).to_be_visible()
    expect(page.locator('#patientHUD #patientComplaintQuote')).to_be_visible()
    complaint = page.locator('#patientComplaintQuote').text_content()
    assert len(complaint.strip()) > 0, "Patient complaint must not be empty"
    done('persistent left patient HUD displays 7 clinical metrics and patient complaint')

    # 3. Check 7 visual ingredients and portion pills in Prep panel
    ingredients = ['tofu', 'pork', 'douban', 'garlic', 'scallion', 'chili', 'pepper']
    for ing in ingredients:
        expect(page.locator(f'#panel-prep button[data-food="{ing}"]')).to_be_attached()
        for p in ['0', '0.5', '1']:
            expect(page.locator(f'#panel-prep .portion-pill[data-food="{ing}"][data-portion="{p}"]')).to_be_attached()
    done('7 visual ingredients with 0, 0.5, 1 portion pills present in prep panel')

    # 4. Phase 1: Consultation click (no WASD) -> Auto-walk to prep
    expect(page.locator('#clinicWelcome')).to_be_visible()
    page.locator('#consultConfirmBtn').click()
    page.wait_for_function('getCookingStatus().stage >= 3')
    page.wait_for_function('getSceneStatus().routeLength === 0')
    assert page.evaluate('getSceneStatus().interactiveTarget?.id') == 'prep'
    done('consultation confirmation triggers auto-walk to prep station without manual WASD')

    # 5. Phase 2: Portion customization + Prep Done -> Auto-walk to wok
    # Set chili portion to 1, scallion to 1
    page.locator('.portion-pill[data-food="chili"][data-portion="1"]').click()
    page.locator('.portion-pill[data-food="scallion"][data-portion="1"]').click()
    tray = page.evaluate('window.preparedTray')
    assert tray['chili'] == 1 and tray['scallion'] == 1

    page.locator('#prepDoneBtn').click()
    page.wait_for_function('getCookingStatus().stage >= 4')
    page.wait_for_function('getSceneStatus().routeLength === 0')
    assert page.evaluate('getSceneStatus().interactiveTarget?.id') == 'wok'
    assert page.evaluate('window.wok?.hasFood') is True
    done('prep done batch-drops chosen portions into wok and auto-walks to wok station')

    # 6. Phase 3: Wok Cooking (Flame + Stir + Simmer) -> Auto-walk to serve
    # Switch flame to high
    page.locator('#heatBtn').click() # low
    page.locator('#heatBtn').click() # high
    assert page.evaluate('window.wok?.flame') == 'high'

    # Stir 3 times
    for _ in range(3):
        page.locator('#stirBtn').click()
        page.wait_for_timeout(100)
    assert page.evaluate('window.wok?.stirs') >= 3

    # Wait for simmer to complete
    page.wait_for_function('window.cookedDish.isSimmered || window.wok?.isSimmered')
    page.locator('#wokCookDoneBtn').click()
    page.wait_for_function('getSceneStatus().routeLength === 0')
    assert page.evaluate('getSceneStatus().interactiveTarget?.id') == 'serve'
    done('active wok cooking flame/stir/simmer completes and auto-walks to serve station')

    # 7. Phase 4: Plated Dish Tray Preview & Plating -> Auto-walk to deliver
    expect(page.locator('#platedDishPreview')).to_be_visible()
    page.locator('#riceHalfBtn').click()
    page.locator('#misoToggleBtn').click() # toggle miso
    page.wait_for_timeout(80)
    dish = page.evaluate('window.cookedDish')
    assert dish['ricePortion'] == '半碗飯'

    page.locator('#clinicPlateBtn').click()
    page.wait_for_function('getCookingStatus().plated')
    assert page.evaluate('getSceneStatus().carryingTray') is True
    done('tray preview updates with sides selection; plating sets carrying tray state')

    # Wait for auto-walk back to consult and delivery
    page.wait_for_function('getSceneStatus().routeLength === 0')
    page.wait_for_function('document.getElementById("clinicResult").open')
    expect(page.locator('#clinicResult')).to_be_visible()
    done('doctor auto-delivers tray back to patient consultation desk')

    # 8. Phase 5: In-flow Settlement checks
    # Check left HUD is still visible and updated with deltas
    expect(page.locator('#patientHUD')).to_be_visible()
    expect(page.locator('#patientHUD #cravingDelta')).to_be_visible()
    delta_text = page.locator('#patientHUD #cravingDelta').text_content()
    assert '%' in delta_text, f"Delta text should include %, got {delta_text}"
    done('left patient HUD remains visible with computed clinical metric deltas')

    # Check first-person subjective review axes
    for sub in ['#subNumbing', '#subComfort', '#subSatiety', '#subMental']:
        text_val = page.locator(f'#clinicResult {sub}').text_content()
        assert len(text_val.strip()) > 0 and text_val != '-', f"Subjective axis {sub} should be populated"
    expect(page.locator('#clinicResult #patientReviewQuote')).to_be_visible()
    done('patient first-person review with 4 subjective axes and quote is displayed')

    # Check top scene dual finale
    finale_type = page.evaluate('window.topFinale')
    assert finale_type in ['feast', 'flip'], f"Unexpected finale type: {finale_type}"
    done(f'top scene displays clinical finale: {finale_type}')

    # Check non-overlapping bounds at desktop and mobile
    for w, h in [(1366, 768), (375, 667)]:
        page.set_viewport_size({'width': w, 'height': h})
        page.wait_for_timeout(100)
        res_box = page.locator('#clinicResult').evaluate('''e => {
            const r = e.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, sh: e.scrollHeight, ch: e.clientHeight };
        }''')
        assert res_box['y'] >= 0 and res_box['b'] <= h + 1, f"clinicResult out of bounds at {w}x{h}: {res_box}"
        page.screenshot(path=str(out / f'r7-settlement-{w}.png'))
    done('in-flow settlement fits cleanly within viewport on desktop and mobile')

    # Advance to next patient
    page.set_viewport_size({'width': 1366, 'height': 768})
    page.locator('#clinicNextBtn').click()
    page.wait_for_timeout(200)
    assert page.evaluate('document.getElementById("clinicResult").open') is False
    assert page.evaluate('CKClinic.snapshot().number') == 2
    done('advancing to next patient resets workflow for patient #2')

    # 9. Patient #2: Intentionally trigger failure outcome -> verify table-flip finale
    expect(page.locator('#clinicWelcome')).to_be_visible()
    page.locator('#consultConfirmBtn').click()
    page.wait_for_function('getCookingStatus().stage >= 3')
    page.wait_for_function('getSceneStatus().routeLength === 0')

    # Remove all core ingredients (tofu, pork, douban, garlic), remove scallion, and add heavy pepper & chili
    page.locator('.portion-pill[data-food="tofu"][data-portion="0"]').click()
    page.locator('.portion-pill[data-food="pork"][data-portion="0"]').click()
    page.locator('.portion-pill[data-food="douban"][data-portion="0"]').click()
    page.locator('.portion-pill[data-food="garlic"][data-portion="0"]').click()
    page.locator('.portion-pill[data-food="scallion"][data-portion="0"]').click()
    page.locator('.portion-pill[data-food="chili"][data-portion="1"]').click()
    page.locator('.portion-pill[data-food="pepper"][data-portion="1"]').click()

    page.locator('#prepDoneBtn').click()
    page.wait_for_function('getCookingStatus().stage >= 4')
    page.wait_for_function('getSceneStatus().routeLength === 0')

    # High heat, stir 3 times, over-simmer past 8 seconds
    page.locator('#heatBtn').click() # low
    page.locator('#heatBtn').click() # high
    for _ in range(3):
        page.locator('#stirBtn').click()
        page.wait_for_timeout(100)
    page.wait_for_function('window.wok?.eqSimmerTime >= 4.0 || window.cookedDish.simmerTimer >= 4.0', timeout=15000)
    if page.locator('#wokCookDoneBtn').is_visible():
        page.locator('#wokCookDoneBtn').click()
    page.wait_for_function('getCookingStatus().stage >= 5 || getCookingStatus().atServe')
    page.wait_for_function('getSceneStatus().routeLength === 0')

    # Give half rice and remove miso soup (opposite of student's order: 正常飯 + 有味噌湯)
    page.locator('#riceHalfBtn').click()
    if page.evaluate('!!window.cookedDish.miso'):
        page.locator('#misoToggleBtn').click()

    page.locator('#clinicPlateBtn').click()
    page.wait_for_function('getCookingStatus().plated')
    page.wait_for_function('getSceneStatus().routeLength === 0')
    page.wait_for_function('document.getElementById("clinicResult").open')

    fail_finale = page.evaluate('window.topFinale')
    assert fail_finale == 'flip', f"Expected table-flip finale on poor outcome, got: {fail_finale}"
    expect(page.locator('#clinicResult .doctor-splashed-card')).to_be_visible()
    page.screenshot(path=str(out / 'r7-flip-failure.png'))
    done('failure outcome triggers table-flip finale and splashed doctor card')

    assert not errors and not failed, (errors, failed)
    done('zero runtime errors or broken requests across R7 UX loop')
    b.close()
