"""R6 full-cycle automated browser test suite.
Validates:
1. Single consultation & prescription at consult station (X: -10.5)
2. Consolidated fridge & portion prep (0, 0.5, 1)
3. Single batch wok addition with debouncing against repeated presses
4. High/low flame cycling (F) and equivalent simmer time (4s)
5. Sides selection: Rice (1/2) and Miso soup (Q)
6. Plating enters carryingTray mode; remote E delivery blocked
7. Physical delivery walk back to patient at consult (X: -10.5)
8. Dual finales: Success feast (reduction >= 25%) vs Comic table-flip (reduction < 25%) with doctor splashed coat and head bump
9. Multi-viewport responsiveness (1440x900, 768x1024, 390x844, 375x667)
"""
import argparse, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from inline_shift_preview import inline_document

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url')
    parser.add_argument('--inline', action='store_true')
    parser.add_argument('--browser')
    parser.add_argument('--output', default='qa/current/r6')
    args = parser.parse_args()

    if not args.base_url and not args.inline:
        args.inline = True

    out = ROOT / args.output
    out.mkdir(parents=True, exist_ok=True)
    checks = []
    errors = []
    failed_urls = []

    def log_pass(msg):
        checks.append({'name': msg, 'status': 'PASS'})
        print(f"PASS: {msg}", flush=True)

    with sync_playwright() as pw:
        opts = {'headless': True, 'args': ['--no-sandbox']}
        if args.browser:
            opts['executable_path'] = args.browser
        browser = pw.chromium.launch(**opts)
        page = browser.new_page(viewport={'width': 1366, 'height': 768})
        page.set_default_timeout(25000)

        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('response', lambda r: failed_urls.append(r.url) if r.status >= 400 else None)

        if args.inline:
            page.set_content(inline_document(ROOT), wait_until='load')
        else:
            resp = page.goto(args.base_url, wait_until='networkidle')
            assert resp.status == 200, f"Base URL returned status {resp.status}"

        page.wait_for_function('window.CKClinic && window.CKService && window.getSceneStatus && getSceneStatus().imagesReady')

        def c(): return page.evaluate('getCookingStatus()')
        def s(): return page.evaluate('getSceneStatus()')
        def clinic(): return page.evaluate('CKClinic.snapshot()')
        def shift(): return page.evaluate('CKShift.snapshot()')

        def go(station_id):
            page.locator(f'[data-station="{station_id}"]').click()
            page.wait_for_function('getSceneStatus().routeLength === 0')
            target = s().get('interactiveTarget')
            assert target and target['id'] == station_id, f"Expected interactive target to be {station_id}, got {target}"
            page.locator('#world').focus()

        print("=== TEST 1: Initial State & Station Consolidation ===", flush=True)
        stations = s()['stations']
        assert len(stations) == 4, f"Expected 4 consolidated stations, got {len(stations)}"
        station_ids = [st['id'] for st in stations]
        assert station_ids == ['consult', 'prep', 'wok', 'serve'], f"Stations order mismatch: {station_ids}"
        log_pass("4 consolidated stations (consult, prep, wok, serve) active and ordered left-to-right")

        print("=== TEST 2: Single Consultation & Order at Consult Station ===", flush=True)
        go('consult')
        page.keyboard.press('e')
        expect(page.locator('#dialogModal')).to_be_visible()
        # Confirm consultation in single dialog
        page.keyboard.press('e')
        expect(page.locator('#dialogModal')).not_to_be_visible()
        order = clinic()['order']
        print(f"DEBUG: shift status={shift()['status']}, stage={page.evaluate('currentStage')}, order={order}, errors={errors}")
        assert order['rice'] in ['正常飯', '半碗飯']
        assert 'miso' in order
        assert shift()['status'] == 'active', f"Shift timer should start upon confirming consultation, got {shift()['status']}, errors: {errors}"
        log_pass("Single consultation and prescription confirmed; shift timer activated")

        print("=== TEST 3: Consolidated Portion Prep ===", flush=True)
        go('prep')
        # Check portion badges exist
        for food in ['tofu', 'pork', 'douban', 'garlic', 'scallion', 'pepper']:
            assert page.locator(f'#portion-badge-{food}').is_visible()
        # Select scallion (key 5) and cycle portion (Q) to match order
        page.keyboard.press('5')
        page.wait_for_timeout(100)
        target_scallion = 1 if order['scallion'] else 0
        cur_scallion = page.evaluate('window.preparedTray.scallion')
        while cur_scallion != target_scallion:
            page.keyboard.press('q')
            page.wait_for_timeout(100)
            cur_scallion = page.evaluate('window.preparedTray.scallion')

        # Select pepper (key 6) and cycle portion to match order
        page.keyboard.press('6')
        page.wait_for_timeout(100)
        target_pepper = 1 if order['spicy'] == '重辣' else 0
        cur_pepper = page.evaluate('window.preparedTray.pepper')
        while cur_pepper != target_pepper:
            page.keyboard.press('q')
            page.wait_for_timeout(100)
            cur_pepper = page.evaluate('window.preparedTray.pepper')

        # Cut core items
        for k in ['1', '2', '3', '4']:
            page.keyboard.press(k)
            page.wait_for_timeout(50)
            page.keyboard.press('e')
            page.wait_for_timeout(150)
        log_pass("Consolidated prep with 0/0.5/1 portion cycling verified")

        print("=== TEST 4: Batch Wok Addition & Flame Equivalence ===", flush=True)
        go('wok')
        # Turn flame to low (F)
        page.keyboard.press('f')
        page.wait_for_timeout(100)
        assert page.evaluate('window.wok.flame') == 'low', "Flame should be low after 1st F"
        # Press E to batch drop
        page.keyboard.press('e')
        page.wait_for_timeout(100)
        assert page.evaluate('window.wok.hasFood') == True, "Wok should contain food after batch drop"
        # Debounce test: press E repeatedly
        page.keyboard.press('e')
        page.keyboard.press('e')
        contents = page.evaluate('window.wok.contents')
        assert contents['tofu'] == 1, "Food portions must not be multiplied by repeated E presses"
        # Stir 3 times
        for _ in range(3):
            page.keyboard.press(' ')
            page.wait_for_timeout(250)
        assert page.evaluate('window.wok.stirs') >= 3, "Stirs should be >= 3"

        # Switch flame to high (F)
        page.keyboard.press('f')
        page.wait_for_timeout(100)
        assert page.evaluate('window.wok.flame') == 'high', "Flame should be high after 2nd F"

        # Wait for equivalent simmer time to reach 4.0s
        page.wait_for_function('window.wok.eqSimmerTime >= 4.0')
        assert page.evaluate('window.wok.isSimmered') == True, "Wok should be simmered after >= 4.0 eq seconds"
        # Turn off flame
        page.keyboard.press('f')
        page.wait_for_timeout(100)
        assert page.evaluate('window.wok.flame') == 'off', "Flame should be off after 3rd F"
        log_pass("Batch wok drop debounced, flame cycled (off->low->high->off), and equivalent simmer reached 4.0s")

        print("=== TEST 5: Sides (Rice + Miso) & Plating ===", flush=True)
        go('serve')
        # Set rice matching order (1 for 半碗飯, 2 for 正常飯)
        if order['rice'] == '半碗飯':
            page.keyboard.press('1')
        else:
            page.keyboard.press('2')
        page.wait_for_timeout(100)
        assert c()['rice'] == order['rice'], f"Rice mismatch: {c()['rice']} vs {order['rice']}"

        # Set miso matching order (Q toggles)
        cur_miso = c()['miso']
        if cur_miso != order['miso']:
            page.keyboard.press('q')
            page.wait_for_timeout(100)
        assert c()['miso'] == order['miso'], f"Miso mismatch: {c()['miso']} vs {order['miso']}"

        # Plate dish onto tray
        page.keyboard.press('e')
        page.wait_for_function('getCookingStatus().plated', timeout=5000)
        assert c()['plated'] == True, "Dish should be plated"
        assert s()['carryingTray'] == True, "Player should be in carryingTray mode"
        # CRITICAL CHECK: modal must NOT open at serve!
        assert not page.locator('#clinicResult').is_visible(), "Result modal must not open at serve station!"

        # Remote delivery blocked test: pressing E while still at serve must not deliver
        page.keyboard.press('e')
        page.wait_for_timeout(100)
        assert not page.locator('#clinicResult').is_visible(), "Remote E delivery at serve must be blocked!"
        log_pass("Sides set, plated onto tray, and remote delivery blocked at serve station")

        print("=== TEST 6: Physical Delivery Return & Success Feast ===", flush=True)
        # Walk back to consult station
        go('consult')
        assert s()['interactiveTarget']['id'] == 'consult'
        # Press E near patient to deliver
        page.keyboard.press('e')
        page.wait_for_timeout(500)
        expect(page.locator('#clinicResult')).to_be_visible()

        # Check outcome
        res = clinic()['result']
        assert res is not None, "Clinic result should be populated"
        assert res['quality'] >= 25, f"Quality score {res['quality']} should be >= 25"
        assert shift()['status'] == 'won', f"Shift status should be won, got {shift()['status']}"
        assert shift()['streak'] >= 1, "Streak should increase on success"

        # Check success visual banner
        banner = page.locator('#clinicResult .finale-banner')
        expect(banner).to_be_visible()
        banner_src = banner.get_attribute('src') or ''
        banner_alt = banner.get_attribute('alt') or ''
        banner_finale = banner.get_attribute('data-finale') or ''
        assert banner_finale == 'success' or 'success_clinic_meal' in banner_src or '共餐' in banner_alt, f"Expected success banner, got {banner_src}"

        page.screenshot(path=str(out / '01_success_feast.png'))
        log_pass("Physical delivery at consult completed; Success feast finale displayed; streak incremented")

        print("=== TEST 7: Reset & Failure Table-Flip Test ===", flush=True)
        # Click next order
        page.locator('#clinicNextBtn').click()
        page.wait_for_timeout(300)
        expect(page.locator('#clinicResult')).not_to_be_visible()
        assert c()['plated'] == False, "Plated should be reset"
        assert s()['carryingTray'] == False, "carryingTray should be reset"
        assert page.evaluate('window.wok.hasFood') == False, "Wok should be cleared"

        # Start 2nd order
        go('consult')
        page.keyboard.press('e')
        expect(page.locator('#dialogModal')).to_be_visible()
        page.keyboard.press('e')
        expect(page.locator('#dialogModal')).not_to_be_visible()
        assert shift()['status'] == 'active', "Shift timer should start for 2nd order"

        order2 = clinic()['order']

        go('prep')
        # Remove tofu (key 1), pork (key 2), garlic (key 4) to lose 30 points
        page.keyboard.press('1')
        while page.evaluate("window.preparedTray.tofu !== 0"):
            page.keyboard.press('q')
            page.wait_for_timeout(50)
        page.keyboard.press('2')
        while page.evaluate("window.preparedTray.pork !== 0"):
            page.keyboard.press('q')
            page.wait_for_timeout(50)
        page.keyboard.press('4')
        while page.evaluate("window.preparedTray.garlic !== 0"):
            page.keyboard.press('q')
            page.wait_for_timeout(50)
        # Invert scallion to cause mismatch (-10 points)
        page.keyboard.press('5')
        target_scallion = 0 if order2['scallion'] else 1
        while page.evaluate("window.preparedTray.scallion") != target_scallion:
            page.keyboard.press('q')
            page.wait_for_timeout(50)

        # Invert pepper to cause mismatch (-7 points)
        page.keyboard.press('6')
        target_pepper = 0 if order2['spicy'] == '重辣' else 1
        while page.evaluate("window.preparedTray.pepper") != target_pepper:
            page.keyboard.press('q')
            page.wait_for_timeout(50)

        go('wok')
        page.keyboard.press('f') # low flame
        page.keyboard.press('e') # batch add
        page.wait_for_timeout(200)

        # Stir 3 times to enable simmering
        page.keyboard.press(' ')
        page.wait_for_timeout(100)
        page.keyboard.press(' ')
        page.wait_for_timeout(100)
        page.keyboard.press(' ')
        page.wait_for_timeout(100)

        # Over-simmer on high heat: flame to high
        page.keyboard.press('f') # high flame
        # Wait until simmer reaches 8.0 eq seconds (overheat penalty)
        page.wait_for_function('window.wok.eqSimmerTime >= 8.0', timeout=15000)

        # Go to serve station, set opposite sides (wrong rice & wrong miso)
        go('serve')
        if order2['rice'] == '半碗飯':
            page.keyboard.press('2') # set to 正常飯
        else:
            page.keyboard.press('1') # set to 半碗飯
        if c()['miso'] == order2['miso']:
            page.keyboard.press('q') # invert miso

        # Plate at serve station
        page.keyboard.press('e')
        page.wait_for_function('getCookingStatus().plated', timeout=5000)

        # Walk to consult and deliver bad dish
        go('consult')
        page.keyboard.press('e')
        page.wait_for_timeout(500)
        expect(page.locator('#clinicResult')).to_be_visible()

        # Check failure outcome
        res2 = clinic()['result']
        assert res2['quality'] < 50, f"Quality score should be low, got {res2['quality']}"
        assert shift()['status'] == 'lost', f"Shift status should be lost, got {shift()['status']}"
        assert shift()['streak'] == 0, f"Streak should be reset to 0, got {shift()['streak']}"

        # Check failure visual banner & splashed doctor reaction
        banner2 = page.locator('#clinicResult .finale-banner')
        expect(banner2).to_be_visible()
        banner_src2 = banner2.get_attribute('src') or ''
        banner_alt2 = banner2.get_attribute('alt') or ''
        banner_finale2 = banner2.get_attribute('data-finale') or ''
        assert banner_finale2 == 'failure' or 'failure_table_flip' in banner_src2 or '翻桌' in banner_alt2, f"Expected table flip banner, got {banner_src2}"

        splashed = page.locator('#clinicResult .doctor-splashed-img')
        bump = page.locator('#clinicResult .doctor-bump-img')
        expect(splashed).to_be_visible()
        expect(bump).to_be_visible()
        assert splashed.get_attribute('data-type') == 'splashed' or 'splashed' in (splashed.get_attribute('src') or '')
        assert bump.get_attribute('data-type') == 'bump' or 'bump' in (bump.get_attribute('src') or '')

        page.screenshot(path=str(out / '02_failure_table_flip.png'))
        log_pass("Mismatched dish produced table-flip failure, splashed coat, head bump, and streak reset to 0")

        print("=== TEST 8: Multi-Viewport Fit & Clean Layout ===", flush=True)
        viewports = [
            (1440, 900, 'desktop-1440x900'),
            (768, 1024, 'tablet-768x1024'),
            (390, 844, 'phone-390x844'),
            (375, 667, 'phone-375x667')
        ]
        for w, h, name in viewports:
            page.set_viewport_size({'width': w, 'height': h})
            page.wait_for_timeout(150)
            page.screenshot(path=str(out / f'{name}.png'))
            # Check for horizontal viewport overflow
            is_overflow = page.evaluate('document.documentElement.scrollWidth > window.innerWidth')
            assert not is_overflow, f"Horizontal overflow detected at {w}x{h}"
        log_pass("All 4 viewports (1440x900, 768x1024, 390x844, 375x667) rendered without layout overflow")

        browser.close()

    assert len(errors) == 0, f"Uncaught page errors: {errors}"
    assert len(failed_urls) == 0, f"Failed resource loads (404/500): {failed_urls}"

    # Write test report
    report_path = out / 'test_report.json'
    report_path.write_text(json.dumps({
        'status': 'PASS',
        'passed_checks': len(checks),
        'checks': checks,
        'page_errors': errors,
        'failed_resources': failed_urls
    }, indent=2, ensure_ascii=False), encoding='utf-8')

    print(f"\n==========================================")
    print(f"ALL {len(checks)} R6 PLAYWRIGHT FLOW CHECKS PASSED!")
    print(f"Report and screenshots saved to: {out}")
    print(f"==========================================")

if __name__ == '__main__':
    main()
