"""Integration test for the unified 8-stage mission state machine in Clinic Kitchen 2.0.
Validates:
  1. STAGE_CONSULT (問診) -> Walk to patient chair & press E -> Consultation dialog
  2. STAGE_ORDER (開單) -> Walk to doctor desk / printer & press E -> Prescription printed
  3. STAGE_GATHER (取材) -> Walk to transition fridge & press E -> Cold storage gathered
  4. STAGE_PREP (備料) -> Walk to prep counter -> Cut required ingredients
  5. STAGE_COOK (翻炒) -> Walk to wok station -> Heat, add ingredients, stir 3x
  6. STAGE_PLATE (盛盤) -> Plate Mapo Tofu into ceramic bowl -> Carry tray in 3D
  7. STAGE_SERVE (送餐) -> Walk back to clinic patient chair & press E
  8. STAGE_FIRST_BITE (第一口) -> First bite cutscene, 100% satisfaction score, disclaimer
"""
import argparse
from pathlib import Path
import json
import shutil
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

def test_full_mission(base_url='http://127.0.0.1:8000/', output_dir=None):
    out = Path(output_dir or (ROOT / 'qa/current'))
    out.mkdir(parents=True, exist_ok=True)
    results = []

    def check(name, condition):
        assert condition, f"Assertion failed: {name}"
        results.append({'test': name, 'status': 'PASS'})
        print(f"  [PASS] {name}")

    with sync_playwright() as pw:
        gl_args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--enable-unsafe-swiftshader',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-webgl',
            '--in-process-gpu'
        ]
        browser = pw.chromium.launch(headless=True, args=gl_args)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.goto(base_url, wait_until='networkidle')
        page.wait_for_timeout(200)

        # 1. Verify 3D Scene Initialization
        status_3d = page.evaluate('window.get3DStatus()')
        check('3D scene initialized', status_3d['initialized'] is True)
        check('3D scene using verified GLB models', status_3d['usingGlb'] is True)
        check('Initial mission stage is STAGE_CONSULT (0)', page.evaluate('window.getMissionStage()') == 0)

        # 2. Stage 1: Walk to Patient Chair & Consult
        page.evaluate('window.teleportAndSync(-7.3, -0.6)')
        expect(page.locator('#prompt')).to_contain_text('病人')
        check('Prompt indicates consultation near patient', True)

        page.keyboard.press('e')
        page.wait_for_timeout(120)
        check('Consultation dialog modal opened', page.locator('#dialogModal').is_visible())
        title_text = page.locator('#dialogTitle').inner_text()
        check('Consultation dialog title correct', '問診' in title_text)

        page.keyboard.press('Enter')
        page.wait_for_timeout(100)
        check('Consultation dialog closed', not page.locator('#dialogModal').is_visible())
        check('Stage advanced to STAGE_ORDER (1)', page.evaluate('window.getMissionStage()') == 1)

        # 3. Stage 2: Walk to Doctor Desk & Order Prescription
        page.evaluate('window.teleportAndSync(-9.0, -1.0)')
        expect(page.locator('#prompt')).to_contain_text('處方')
        check('Prompt indicates ordering prescription near desk', True)

        page.keyboard.press('e')
        page.wait_for_timeout(120)
        check('Order prescription dialog modal opened', page.locator('#dialogModal').is_visible())
        title_text = page.locator('#dialogTitle').inner_text()
        check('Prescription dialog title correct', '料理' in title_text or '處方' in title_text or '出單' in title_text)

        page.keyboard.press('Enter')
        page.wait_for_timeout(100)
        check('Prescription dialog closed', not page.locator('#dialogModal').is_visible())
        check('Stage advanced to STAGE_GATHER (2)', page.evaluate('window.getMissionStage()') == 2)

        # 4. Stage 3: Walk to Transition Fridge & Gather Ingredients
        page.evaluate('window.teleportAndSync(0.2, -1.6)')
        expect(page.locator('#prompt')).to_contain_text('冰箱')
        check('Prompt indicates gathering ingredients near fridge', True)

        page.keyboard.press('e')
        page.wait_for_timeout(120)
        check('Fridge gather dialog modal opened', page.locator('#dialogModal').is_visible())
        title_text = page.locator('#dialogTitle').inner_text()
        check('Fridge dialog title correct', '取材' in title_text or '冷藏' in title_text)

        page.keyboard.press('Enter')
        page.wait_for_timeout(100)
        check('Fridge dialog closed', not page.locator('#dialogModal').is_visible())
        check('Stage advanced to STAGE_PREP (3)', page.evaluate('window.getMissionStage()') == 3)

        # 5. Stage 4: Walk to Prep Counter & Cut Ingredients
        page.evaluate('window.teleportAndSync(5.0, -1.5)')
        page.wait_for_timeout(100)
        for food in ['tofu', 'pork', 'douban', 'garlic']:
            page.locator(f'[data-food="{food}"]').click()
            cuts = 3 if food == 'tofu' else 1
            for _ in range(cuts):
                page.locator('#cutBtn').click()

        check('Required ingredients prepped', page.locator('[data-food="tofu"].is-prepped').count() == 1)
        check('Stage advanced to STAGE_COOK (4)', page.evaluate('window.getMissionStage()') == 4)

        # 6. Stage 5: Walk to Wok Station & Cook
        page.evaluate('window.teleportAndSync(9.0, -1.4)')
        page.wait_for_timeout(100)
        page.locator('#heatBtn').click()
        page.locator('#addBtn').click()
        for _ in range(3):
            page.locator('#stirBtn').click()

        check('Stage advanced to STAGE_PLATE (5)', page.evaluate('window.getMissionStage()') == 5)
        check('Plate button enabled', page.locator('#plateBtn').is_enabled())

        # 7. Stage 6: Plate Dish & Carry Tray
        page.locator('#plateBtn').click()
        page.wait_for_timeout(100)
        check('Dish plated into ceramic bowl', page.locator('#wokContents').inner_text() == '麻婆豆腐完成')
        check('Stage advanced to STAGE_SERVE (6)', page.evaluate('window.getMissionStage()') == 6)
        check('Dr. Speed is carrying tray in 3D', page.evaluate('window.get3DStatus().carryingTray') is True)

        # 8. Stage 7 & 8: Walk back to Clinic & First Bite Feedback
        page.evaluate('window.teleportAndSync(-7.3, -0.6)')
        expect(page.locator('#prompt')).to_contain_text('送餐')
        check('Prompt indicates serving to patient', True)

        page.keyboard.press('e')
        page.wait_for_timeout(150)
        check('First bite feedback modal opened', page.locator('#dialogModal').is_visible())

        # Screenshot the First Bite Modal
        page.screenshot(path=str(out / 'first_bite_modal.png'))

        # Verify First Bite Feedback Details
        content_text = page.locator('#dialogContent').inner_text()
        check('First bite description mentions aroma, numbing pepper, and relaxation',
              '麻婆豆腐' in content_text and ('花椒' in content_text or '放鬆' in content_text))

        score_text = page.locator('#dialogScoreText').inner_text()
        check('Satisfaction score is 100%', '100%' in score_text and page.locator('#dialogScore').is_visible())

        disclaimer_text = page.locator('#dialogDisclaimer').inner_text()
        check('Setting disclaimer correctly states fictional stress relief with no medical claims',
              '虛構' in disclaimer_text and ('非臨床醫療' in disclaimer_text or '不具戒菸' in disclaimer_text))

        # Close First Bite Modal
        page.keyboard.press('Enter')
        page.wait_for_timeout(100)
        check('First bite modal closed', not page.locator('#dialogModal').is_visible())
        check('Stage advanced to STAGE_FIRST_BITE (7)', page.evaluate('window.getMissionStage()') == 7)
        check('Dr. Speed tray dismissed after delivery', page.evaluate('window.get3DStatus().carryingTray') is False)
        check('Patient served dish visible on side table', page.evaluate('window.get3DStatus().patientDishVisible') is True)

        # Screenshot full completed mission
        page.screenshot(path=str(out / 'mission_chain_proof.png'))

        # 9. Test Reset functionality
        page.keyboard.press('r')
        page.wait_for_timeout(100)
        check('Reset brings stage back to STAGE_CONSULT (0)', page.evaluate('window.getMissionStage()') == 0)
        check('Reset empties wok', page.locator('#wokContents').inner_text() == '空鍋')
        check('Reset hides patient served dish', page.evaluate('window.get3DStatus().patientDishVisible') is False)

        report = {
            'suite': '8-Stage Unified Mission State Machine QA',
            'tests': results,
            'summary': f"{len(results)}/{len(results)} PASS",
            'artifacts': ['first_bite_modal.png', 'mission_chain_proof.png']
        }
        (out / 'mission-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        browser.close()

    print(f"\nAll {len(results)} Mission Chain tests PASSED successfully!")

if __name__ == '__main__':
    test_full_mission()
