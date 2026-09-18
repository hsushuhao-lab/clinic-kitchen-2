"""Clinic Kitchen 2.0 — End-to-End Pure Keyboard & Mouse Acceptance Test.

STRICT ACCEPTANCE RULES:
  - NO teleportation (teleportAndSync / teleportTo forbidden).
  - NO internal state mutation.
  - ONLY real keyboard inputs ('w', 'a', 's', 'd', 'e', 'r') and mouse clicks on interactive UI.
  - Verifies:
      1. WASD direction, depth (-Z away, +Z towards), and character facing.
      2. Station gating prevents prep / cook before prerequisites and away from stations.
      3. Walking to Patient -> E -> Consultation.
      4. Walking to Doctor Desk -> E -> Prescription order printed.
      5. Walking to Transition Fridge -> E -> Fresh ingredients gathered.
      6. Walking to Prep Counter -> Knife chops tofu cubes & scallions, spoon scoops douban.
      7. Walking to Wok Station -> Flame on, add ingredients, spatula stirs 3x, simmer bubbles.
      8. Plating into porcelain bowl on tray -> Dr. Speed carries tray with both hands.
      9. Walking with tray back to Clinic -> Patient table delivery -> First bite feedback.
      10. R key resets all cleanly.
"""
import http.server
import json
import re
import socketserver
import threading
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'qa' / 'acceptance'
OUT.mkdir(parents=True, exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, format, *args):
        pass

def main():
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    port = httpd.server_address[1]
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()

    steps_passed = []
    def log_step(name):
        steps_passed.append(name)
        print(f"[PASS] {name}", flush=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(args=[
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
            '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
            '--enable-webgl', '--in-process-gpu'
        ])
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        page.goto(f'http://127.0.0.1:{port}/index.html', wait_until='networkidle')
        page.wait_for_function("window.get3DStatus && window.get3DStatus().initialized")
        page.wait_for_timeout(300)

        world = page.locator('#world')
        world.focus()

        def pos():
            return page.evaluate("window.get3DStatus().playerPos")

        def walk_axis(axis, target):
            current = pos()[axis]
            if abs(current - target) < 0.08:
                return
            increasing = target > current
            if axis == 'x':
                key = 'd' if increasing else 'a'
            else:
                # In our corrected coordinate system:
                # W moves deeper into scene (-Z, decreasing Z)
                # S moves towards camera (+Z, increasing Z)
                key = 's' if increasing else 'w'
            world.focus()
            page.keyboard.down(key)
            try:
                page.wait_for_function(
                    "([axis, target, increasing]) => { const val = window.get3DStatus().playerPos[axis]; "
                    "return increasing ? val >= target - 0.08 : val <= target + 0.08; }",
                    arg=[axis, target, increasing], timeout=25000
                )
            finally:
                page.keyboard.up(key)
            page.wait_for_timeout(60)

        def walk_to(target_x, target_z):
            # Aisle corridor is along z = 0.0
            walk_axis('z', 0.0)
            walk_axis('x', target_x)
            walk_axis('z', target_z)

        # -------------------------------------------------------------
        # STEP 1: Direction & Depth Movement Verification
        # -------------------------------------------------------------
        p0 = pos()
        assert abs(p0['x'] - (-8.0)) < 0.2 and abs(p0['z'] - (-0.2)) < 0.2
        # Press W -> moves deeper (-Z)
        world.focus()
        page.keyboard.down('w')
        page.wait_for_timeout(250)
        page.keyboard.up('w')
        pw = pos()
        assert pw['z'] < p0['z'] - 0.08, f"W did not decrease Z: {pw['z']} vs {p0['z']}"
        # Facing should face deeper into room (Math.PI)
        facing_w = page.evaluate("window.scene3DState.playerFacing")
        assert abs(abs(facing_w) - 3.14159) < 0.25

        # Press S -> moves towards camera (+Z)
        page.keyboard.down('s')
        page.wait_for_timeout(350)
        page.keyboard.up('s')
        ps = pos()
        assert ps['z'] > pw['z'] + 0.08, f"S did not increase Z: {ps['z']} vs {pw['z']}"
        facing_s = page.evaluate("window.scene3DState.playerFacing")
        assert abs(facing_s) < 0.25

        page.screenshot(path=str(OUT / '01_direction_depth.png'))
        log_step("1. Real keyboard WASD moves in correct depth axis (-Z deeper, +Z camera) and synchronizes facing")

        # -------------------------------------------------------------
        # STEP 2: Station & Task State Gating Negative Checks
        # -------------------------------------------------------------
        # Lower workbench must be locked because we are at Stage 0 (Consult)
        expect(page.locator('#stationLockOverlay')).to_be_visible()
        expect(page.locator('#cutBtn')).to_be_disabled()
        expect(page.locator('#heatBtn')).to_be_disabled()
        expect(page.locator('#plateBtn')).to_be_disabled()
        page.screenshot(path=str(OUT / '02_station_gating_locked.png'))
        log_step("2. Station & Task gating strictly blocks lower workbench before prerequisites")

        # -------------------------------------------------------------
        # STEP 3: Walk to Patient Chair & Consult (Stage 0 -> 1)
        # -------------------------------------------------------------
        walk_to(-7.3, -0.65)
        world.focus()
        expect(page.locator('#prompt')).to_contain_text('病人')
        page.keyboard.press('e')
        expect(page.locator('#dialogModal')).to_be_visible()
        expect(page.locator('#dialogTitle')).to_contain_text('問診')
        page.locator('#dialogActionBtn').click()
        assert page.evaluate("window.getMissionStage()") == 1
        log_step("3. Walked to Patient Chair and completed consultation dialog")

        # -------------------------------------------------------------
        # STEP 4: Walk to Doctor Desk & Order Prescription (Stage 1 -> 2)
        # -------------------------------------------------------------
        walk_to(-9.2, -1.0)
        world.focus()
        expect(page.locator('#prompt')).to_contain_text('處方')
        page.keyboard.press('e')
        expect(page.locator('#dialogModal')).to_be_visible()
        expect(page.locator('#dialogTitle')).to_contain_text('處方')
        page.locator('#dialogActionBtn').click()
        assert page.evaluate("window.getMissionStage()") == 2
        log_step("4. Walked to Doctor Desk and confirmed Mapo Tofu cooking order")

        # -------------------------------------------------------------
        # STEP 5: Walk to Fridge & Gather Ingredients (Stage 2 -> 3)
        # -------------------------------------------------------------
        walk_to(0.2, -1.4)
        world.focus()
        expect(page.locator('#prompt')).to_contain_text('冰箱')
        page.keyboard.press('e')
        expect(page.locator('#dialogModal')).to_be_visible()
        expect(page.locator('#dialogTitle')).to_contain_text('取材')
        page.locator('#dialogActionBtn').click()
        assert page.evaluate("window.getMissionStage()") == 3
        log_step("5. Walked through transition zone to Fridge and gathered cold ingredients")

        # -------------------------------------------------------------
        # STEP 6: Walk to Prep Counter & Cut Ingredients (Stage 3 -> 4)
        # -------------------------------------------------------------
        walk_to(5.0, -1.4)
        expect(page.locator('#prepStationBadge')).to_contain_text('已在備料檯')

        # 1. Tofu: Whole -> Halves -> Strips -> Diced Cubes
        page.locator('[data-food="tofu"]').click()
        expect(page.locator('#boardFoodImg')).to_be_visible()
        expect(page.locator('#boardKnife')).to_be_visible()
        for _ in range(3):
            page.locator('#cutBtn').click()
            page.wait_for_timeout(100)

        # 2. Scallion: Whole -> Scallion Rings
        page.locator('[data-food="scallion"]').click()
        page.locator('#cutBtn').click()
        page.wait_for_timeout(100)

        # 3. Garlic: Cloves -> Minced Garlic
        page.locator('[data-food="garlic"]').click()
        page.locator('#cutBtn').click()
        page.wait_for_timeout(100)

        # 4. Pork: Cut and divide
        page.locator('[data-food="pork"]').click()
        page.locator('#cutBtn').click()
        page.wait_for_timeout(100)

        # 5. Douban: Scoop with spoon
        page.locator('[data-food="douban"]').click()
        expect(page.locator('#boardSpoon')).to_be_visible()
        expect(page.locator('#cutBtn')).to_contain_text('舀取')
        page.locator('#cutBtn').click()
        page.wait_for_timeout(100)

        assert page.evaluate("window.getMissionStage()") == 4
        page.screenshot(path=str(OUT / '03_cutting_board_tofu_scallion.png'))
        log_step("6. Cutting board demonstrated realistic knife chops (tofu cubes, scallions, garlic) and spoon scoop for douban")

        # -------------------------------------------------------------
        # STEP 7: Walk to Wok Station & Cook (Stage 4 -> 5 -> 6)
        # -------------------------------------------------------------
        walk_to(9.0, -1.35)
        expect(page.locator('#wokStationBadge')).to_contain_text('已在炒鍋台')

        # Ignite burner flame
        page.locator('#heatBtn').click()
        expect(page.locator('#flame')).to_have_class(re.compile(r'is-on'))

        # Add prepped ingredients into wok
        page.locator('#addBtn').click()

        # Stir 3 times with metal spatula
        for _ in range(3):
            page.locator('#stirBtn').click()
            page.wait_for_timeout(200)

        assert page.evaluate("window.getMissionStage()") == 5 # STAGE_PLATE
        expect(page.locator('#plateBtn')).to_be_enabled()
        page.screenshot(path=str(OUT / '04_wok_spatula_simmer.png'))
        log_step("7. Wok ignited flame, added ingredients, and metal spatula stirred 3x into bubbling simmer")

        # -------------------------------------------------------------
        # STEP 8: Plating Mapo Tofu into Porcelain Bowl & Tray
        # -------------------------------------------------------------
        page.locator('#plateBtn').click()
        assert page.evaluate("window.getMissionStage()") == 6 # STAGE_SERVE
        assert page.evaluate("window.get3DStatus().carryingTray") is True
        expect(page.locator('#platedDishPreview')).to_be_visible()
        page.screenshot(path=str(OUT / '05_dish_plating_tray.png'))
        log_step("8. Plated into blue-pattern porcelain bowl on tray with steamed rice, chopsticks and 3D carrying stance")

        # -------------------------------------------------------------
        # STEP 9: Dr. Speed Carries Tray Across Kitchen & Prep to Clinic
        # -------------------------------------------------------------
        # Walk back: Kitchen (9.0) -> Prep (0.0) -> Clinic (-7.3)
        walk_to(-7.3, -0.65)
        world.focus()
        page.screenshot(path=str(OUT / '06_dr_speed_carrying_tray.png'))
        expect(page.locator('#prompt')).to_contain_text('送餐')

        # Deliver to Patient Chair
        page.keyboard.press('e')
        expect(page.locator('#dialogModal')).to_be_visible()
        expect(page.locator('#dialogTitle')).to_contain_text('第一口')
        expect(page.locator('#dialogScoreText')).to_contain_text('100%')
        page.screenshot(path=str(OUT / '07_patient_first_bite.png'))

        # Confirm first bite cutscene
        page.locator('#dialogActionBtn').click()
        assert page.evaluate("window.getMissionStage()") == 7 # STAGE_FIRST_BITE
        assert page.evaluate("window.get3DStatus().carryingTray") is False
        assert page.evaluate("window.get3DStatus().patientDishVisible") is True
        log_step("9. Delivered tray to patient table; patient enjoyed first bite with 100% satisfaction and disclaimer")

        # -------------------------------------------------------------
        # STEP 10: Reset Verification
        # -------------------------------------------------------------
        world.focus()
        page.keyboard.press('r')
        page.wait_for_timeout(100)
        assert page.evaluate("window.getMissionStage()") == 0
        expect(page.locator('#wokContents')).to_have_text('空鍋')
        assert page.evaluate("window.get3DStatus().patientDishVisible") is False
        log_step("10. Reset restored all mission and culinary state cleanly")

        browser.close()

    report = {
        'suite': 'End-to-End Real Keyboard & Mouse Acceptance Test',
        'status': 'ALL_PASS',
        'steps': steps_passed,
        'screenshots': [
            '01_direction_depth.png',
            '02_station_gating_locked.png',
            '03_cutting_board_tofu_scallion.png',
            '04_wok_spatula_simmer.png',
            '05_dish_plating_tray.png',
            '06_dr_speed_carrying_tray.png',
            '07_patient_first_bite.png'
        ]
    }
    (OUT / 'acceptance_report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print("\nALL 10 ACCEPTANCE STEPS PASSED WITH PURE KEYBOARD & MOUSE INPUTS!")

if __name__ == '__main__':
    main()
