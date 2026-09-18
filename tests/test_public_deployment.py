"""Check the deployed game with real keyboard inputs, never teleport helpers.

This is a publication test, not approval of production art or recipe realism.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = 'https://clinic-kitchen-2-0-rnbvw5.v2.appdeploy.ai/'
SOURCE_COMMIT = 'c80258df951dccc03602262165f74fd82f85130c'
OUT = Path('qa/public-deployment')
OUT.mkdir(parents=True, exist_ok=True)
checks = []


def record(name):
    checks.append({'name': name, 'status': 'PASS'})
    print(f'PASS: {name}', flush=True)


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=[
            '--no-sandbox', '--disable-dev-shm-usage',
            '--enable-unsafe-swiftshader', '--use-gl=angle',
            '--use-angle=swiftshader', '--enable-webgl',
        ])
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.set_default_timeout(20000)
        errors = []
        failures = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('requestfailed', lambda request: failures.append(request.url))
        response = page.goto(URL, wait_until='domcontentloaded', timeout=90000)
        assert response and response.status == 200
        page.wait_for_function(
            "document.documentElement.dataset.runtimeReady === 'true' && "
            "window.get3DStatus?.().initialized && window.get3DStatus?.().usingGlb",
            timeout=90000,
        )
        assert page.evaluate('document.documentElement.dataset.sourceCommit') == SOURCE_COMMIT
        record('Public HTTPS page loads the pinned Three.js runtime and GLB environment')
        page.screenshot(path=str(OUT / 'public-desktop.png'))
        info_response = page.request.get(URL + 'build-info.json')
        assert info_response.status == 200
        assert info_response.json()['source_commit'] == SOURCE_COMMIT
        record('Public build metadata matches the deployed source commit')

        def position():
            return page.evaluate('window.get3DStatus().playerPos')

        def walk_axis(axis, target):
            current = position()[axis]
            if abs(current - target) < 0.09:
                return
            increasing = target > current
            key = ('d' if increasing else 'a') if axis == 'x' else ('w' if increasing else 's')
            page.locator('#world').focus()
            page.keyboard.down(key)
            try:
                page.wait_for_function(
                    "([axis, target, increasing]) => { const value = window.get3DStatus().playerPos[axis]; "
                    "return increasing ? value >= target - 0.08 : value <= target + 0.08; }",
                    arg=[axis, target, increasing], timeout=25000,
                )
            finally:
                page.keyboard.up(key)
            assert abs(position()[axis] - target) < 0.5

        def approach(x, z):
            # The central aisle is free of furniture; approach each station from it.
            walk_axis('z', 0)
            walk_axis('x', x)
            walk_axis('z', z)

        def interact(expected_stage):
            page.locator('#world').focus()
            page.keyboard.press('e')
            expect(page.locator('#dialogModal')).to_be_visible()
            page.locator('#dialogActionBtn').click()
            page.wait_for_function('(n) => window.getMissionStage() === n', arg=expected_stage)

        initial = position()
        walk_axis('x', -7.6)
        assert position()['x'] > initial['x']
        page.keyboard.press('r')
        assert abs(position()['x'] + 8) < 0.1
        record('Real keyboard movement and reset work on the public page')
        expect(page.locator('#plateBtn')).to_be_disabled()
        record('Empty wok cannot be plated')

        approach(-7.3, -0.65)
        interact(1)
        record('Patient consultation advances to the order stage')
        approach(-9.0, -0.65)
        interact(2)
        record('Walking to the doctor desk opens and confirms the cooking order')
        approach(0.2, -1.4)
        interact(3)
        record('Walking from clinic to the refrigerator completes gathering')
        approach(5.0, -1.4)
        for food in ('tofu', 'pork', 'douban', 'garlic'):
            page.locator(f'[data-food="{food}"]').click()
            page.locator('#cutBtn').click()
        assert page.evaluate('window.getMissionStage()') == 4
        record('The lower workbench prepares the four required ingredients')
        approach(9.0, -1.35)
        page.locator('#heatBtn').click()
        page.locator('#addBtn').click()
        expect(page.locator('#plateBtn')).to_be_disabled()
        page.locator('#heatBtn').click()
        expect(page.locator('#stirBtn')).to_be_disabled()
        page.locator('#heatBtn').click()
        for _ in range(3):
            page.locator('#stirBtn').click()
        expect(page.locator('#plateBtn')).to_be_enabled()
        page.locator('#plateBtn').click()
        assert page.evaluate('window.get3DStatus().carryingTray') is True
        record('Heat guard, three stir actions, plating and carrying state work')
        page.screenshot(path=str(OUT / 'public-cooked.png'))
        approach(-7.3, -0.65)
        page.locator('#world').focus()
        page.keyboard.press('e')
        expect(page.locator('#dialogModal')).to_be_visible()
        expect(page.locator('#dialogTitle')).to_contain_text('第一口')
        page.screenshot(path=str(OUT / 'public-first-bite.png'))
        page.locator('#dialogActionBtn').click()
        assert page.evaluate('window.getMissionStage()') == 7
        assert page.evaluate('window.get3DStatus().patientDishVisible') is True
        record('Walking back to the clinic completes delivery and first-bite feedback')
        page.locator('#world').focus()
        page.keyboard.press('r')
        assert page.evaluate('window.getMissionStage()') == 0
        expect(page.locator('#wokContents')).to_have_text('空鍋')
        assert page.evaluate('window.get3DStatus().patientDishVisible') is False
        record('A complete mission can be reset for the next session')
        assert not errors, errors
        assert not failures, failures
        record('No uncaught JavaScript errors or failed network requests during walkthrough')

        page.set_viewport_size({'width': 390, 'height': 844})
        world = page.locator('#world').bounding_box()
        deck = page.locator('#cookingDeck').bounding_box()
        assert world and deck and world['height'] > 0 and deck['height'] > 0
        assert world['y'] + world['height'] <= deck['y'] + 2
        assert deck['y'] < 844
        page.screenshot(path=str(OUT / 'public-mobile.png'))
        record('Mobile viewport displays both exploration and lower cooking regions')
        browser.close()


try:
    main()
except Exception as error:
    checks.append({'name': 'Public deployment verification', 'status': 'FAIL', 'error': str(error)})
    raise
finally:
    (OUT / 'report.json').write_text(json.dumps({
        'url': URL, 'source_commit': SOURCE_COMMIT, 'checks': checks,
        'method': 'Real keyboard movement and UI actions; no teleport or mission-state mutation.',
        'art_status': '3D_PLACEHOLDER_PROTOTYPE',
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
